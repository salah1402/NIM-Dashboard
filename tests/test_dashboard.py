import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from backend.main import app
from backend.db import get_db
from backend.models import Conversation, Message, RoutingLog


def test_dashboard_stats_empty(temp_db):
    """Verifies dashboard stats on empty database."""
    session_factory = temp_db["session_factory"]

    def _override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db

    try:
        client = TestClient(app)
        res = client.get("/api/dashboard/stats")
        assert res.status_code == 200
        data = res.json()

        assert data["total_requests"] == 0
        assert data["success_rate"] == 0.0
        assert data["avg_latency_ms"] == 0.0
        assert data["total_fallbacks"] == 0
        assert data["model_performance"] == []
        assert data["error_breakdown"] == []
    finally:
        app.dependency_overrides.clear()


def test_dashboard_stats_and_logs_with_data(temp_db):
    """Verifies stats aggregations and logs pagination with seeded routing data."""
    session_factory = temp_db["session_factory"]

    def _override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db

    # Seed data
    with session_factory() as session:
        c = Conversation(id="conv-test-1", title="Dashboard test conv")
        session.add(c)
        session.flush()

        # 1 user message, 1 assistant message with fallback_count = 1
        m_user = Message(
            id="msg-u1",
            conversation_id=c.id,
            role="user",
            content="Hello dashboard",
        )
        m_asst = Message(
            id="msg-a1",
            conversation_id=c.id,
            role="assistant",
            content="Hello world response",
            model_slug="model/slug-a",
            latency_ms=200,
            fallback_count=1,
        )
        session.add_all([m_user, m_asst])
        session.flush()

        # Seed routing logs:
        # attempt 1 on model/slug-a: rate_limited
        # attempt 2 on model/slug-a: success (latency 100ms)
        # another success on model/slug-a: success (latency 200ms)
        # attempt 1 on model/slug-b: dead_model
        log1 = RoutingLog(
            id="log-1",
            message_id=m_asst.id,
            conversation_id=c.id,
            model_slug="model/slug-a",
            tier="tier1",
            status="rate_limited",
            error="429 Rate limited",
            latency_ms=45,
            attempt_num=1,
            created_at=datetime.now(timezone.utc),
        )
        log2 = RoutingLog(
            id="log-2",
            message_id=m_asst.id,
            conversation_id=c.id,
            model_slug="model/slug-a",
            tier="tier1",
            status="success",
            latency_ms=100,
            attempt_num=2,
            created_at=datetime.now(timezone.utc),
        )
        log3 = RoutingLog(
            id="log-3",
            message_id=None,
            conversation_id=c.id,
            model_slug="model/slug-a",
            tier="tier1",
            status="success",
            latency_ms=200,
            attempt_num=1,
            created_at=datetime.now(timezone.utc),
        )
        log4 = RoutingLog(
            id="log-4",
            message_id=None,
            conversation_id=c.id,
            model_slug="model/slug-b",
            tier="tier2",
            status="dead_model",
            error="404 Not found",
            latency_ms=30,
            attempt_num=1,
            created_at=datetime.now(timezone.utc),
        )
        session.add_all([log1, log2, log3, log4])
        session.commit()

    try:
        client = TestClient(app)

        # 1. Test /api/dashboard/stats
        stats_res = client.get("/api/dashboard/stats")
        assert stats_res.status_code == 200
        stats = stats_res.json()

        assert stats["total_requests"] == 4
        assert stats["success_rate"] == 50.0  # 2 successes / 4 total = 50%
        assert stats["avg_latency_ms"] == 150.0  # (100 + 200) / 2 = 150
        assert stats["total_fallbacks"] == 1

        # Check model performance
        perf = {m["model_slug"]: m for m in stats["model_performance"]}
        assert "model/slug-a" in perf
        assert perf["model/slug-a"]["count"] == 3
        assert perf["model/slug-a"]["success_count"] == 2
        assert perf["model/slug-a"]["error_count"] == 1
        assert perf["model/slug-a"]["avg_latency_ms"] == 150.0

        assert "model/slug-b" in perf
        assert perf["model/slug-b"]["count"] == 1
        assert perf["model/slug-b"]["success_count"] == 0
        assert perf["model/slug-b"]["error_count"] == 1

        # Check error breakdown
        errors = {e["status"]: e["count"] for e in stats["error_breakdown"]}
        assert errors.get("rate_limited") == 1
        assert errors.get("dead_model") == 1

        # 2. Test /api/dashboard/logs
        logs_res = client.get("/api/dashboard/logs?limit=50")
        assert logs_res.status_code == 200
        logs_data = logs_res.json()

        assert "logs" in logs_data
        assert "conversations" in logs_data
        assert len(logs_data["logs"]) == 4
        assert len(logs_data["conversations"]) == 1

        first_log = logs_data["logs"][0]
        assert "model_slug" in first_log
        assert "tier" in first_log
        assert "status" in first_log
        assert "latency_ms" in first_log
        assert "attempt_num" in first_log

    finally:
        app.dependency_overrides.clear()
