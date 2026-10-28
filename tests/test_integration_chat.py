import json
import pytest
from fastapi.testclient import TestClient
from backend.main import app, mock_provider, router
from backend.db import get_db
from backend.models import Message, RoutingLog


def test_chat_integration_cascade_fallback(temp_db):
    """POST /api/chat with a fail_plan wired into the app -> response streams,

    messages table has assistant row with fallback_count>0, routing_logs has multiple rows for that message.
    """
    session_factory = temp_db["session_factory"]

    # Override get_db dependency
    def _override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db

    # Wire temp session factory into router and main.py
    import backend.main
    from backend.provider import MockProvider

    orig_session_local = backend.main.SessionLocal
    orig_router_factory = router.session_factory
    orig_provider = router.provider
    orig_mock_provider = backend.main.mock_provider

    if backend.main.mock_provider is None:
        active_mock = MockProvider()
        backend.main.mock_provider = active_mock
        router.provider = active_mock
    else:
        active_mock = backend.main.mock_provider

    orig_fail_plan = dict(active_mock.fail_plan)

    backend.main.SessionLocal = session_factory
    router.session_factory = session_factory

    tier1_first_slug = router.tiers["tier1"][0]
    tier1_second_slug = router.tiers["tier1"][1]

    # Wire fail plan: first slug fails once with 429
    active_mock.set_fail_plan({
        tier1_first_slug: ["rate_limited"],
    })

    try:
        client = TestClient(app)
        response = client.post(
            "/api/chat",
            json={"message": "Cascade integration test"},
        )

        assert response.status_code == 200
        response_text = response.text
        assert "data: " in response_text

        # Verify SSE chunks contain stream tokens and final completion
        lines = [line.strip() for line in response_text.split("\n") if line.startswith("data: ")]
        assert len(lines) > 0

        final_chunk = None
        for line in lines:
            data = json.loads(line[6:])
            if data.get("done") is True:
                final_chunk = data
                break

        assert final_chunk is not None
        assert final_chunk["model_slug"] == tier1_second_slug
        assert final_chunk["fallback_count"] == 1
        assert "conversation_id" in final_chunk
        conversation_id = final_chunk["conversation_id"]

        # Check DB state
        with session_factory() as session:
            # Check messages table
            assistant_msg = (
                session.query(Message)
                .filter(Message.conversation_id == conversation_id, Message.role == "assistant")
                .first()
            )
            assert assistant_msg is not None
            assert assistant_msg.model_slug == tier1_second_slug
            assert assistant_msg.fallback_count > 0
            assert assistant_msg.fallback_count == 1

            # Check routing_logs table for this message
            logs_for_msg = (
                session.query(RoutingLog)
                .filter(RoutingLog.message_id == assistant_msg.id)
                .order_by(RoutingLog.attempt_num.asc())
                .all()
            )

            # routing_logs has multiple rows for that message
            assert len(logs_for_msg) >= 2
            assert logs_for_msg[0].model_slug == tier1_first_slug
            assert logs_for_msg[0].status == "rate_limited"
            assert logs_for_msg[0].attempt_num == 1

            assert logs_for_msg[1].model_slug == tier1_second_slug
            assert logs_for_msg[1].status == "success"
            assert logs_for_msg[1].attempt_num == 2

    finally:
        # Restore app state
        app.dependency_overrides.clear()
        backend.main.SessionLocal = orig_session_local
        router.session_factory = orig_router_factory
        router.provider = orig_provider
        backend.main.mock_provider = orig_mock_provider
        if orig_mock_provider is not None:
            orig_mock_provider.set_fail_plan(orig_fail_plan)


def test_router_state_endpoint(temp_db):
    """GET /api/router/state returns breaker state for all slugs."""
    client = TestClient(app)
    response = client.get("/api/router/state")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    # Check that tier1 models are present in state
    assert len(data) > 0
    first_tier1 = router.tiers["tier1"][0]
    assert first_tier1 in data
    assert "state" in data[first_tier1]
