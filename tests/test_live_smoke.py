import os
import json
import pytest
from fastapi.testclient import TestClient
from backend.main import app, setup_app_state, router
import backend.main


@pytest.mark.live
@pytest.mark.skipif(os.getenv("NVIDIA_LIVE_TEST") != "1", reason="live")
def test_live_smoke_chat(monkeypatch):
    """Sends one chat message with USE_MOCK=false against the real API

    using the first tier1 slug that's in the live set; asserts 200 with non-empty content.
    """
    monkeypatch.setenv("USE_MOCK", "false")
    setup_app_state()

    try:
        # Get first tier1 slug from live set
        tier1_slugs = backend.main.router.tiers.get("tier1", [])
        assert len(tier1_slugs) > 0, "No tier1 slugs available in live tiers"
        target_slug = tier1_slugs[0]

        client = TestClient(app)
        response = client.post(
            "/api/chat",
            json={
                "message": "Hello from NIM smoke test. Respond with 'Pong'.",
                "force_model": target_slug,
            },
        )

        assert response.status_code == 200
        response_text = response.text
        assert "data: " in response_text

        # Extract tokens from SSE stream
        tokens = []
        for line in response_text.split("\n"):
            if line.startswith("data: "):
                try:
                    data = json.loads(line[6:].strip())
                    if data.get("event") == "token" and data.get("token"):
                        tokens.append(data["token"])
                    elif data.get("token") and not data.get("done"):
                        tokens.append(data["token"])
                except Exception:
                    pass

        content = "".join(tokens).strip()
        assert len(content) > 0, "Response content was empty"
    finally:
        # Restore mock state
        monkeypatch.setenv("USE_MOCK", "true")
        setup_app_state()
