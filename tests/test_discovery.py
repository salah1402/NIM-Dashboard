import logging
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from backend.discovery import discover_live_models, DiscoveryResult
from backend.main import app, setup_app_state
import backend.main


class DummyModel:
    def __init__(self, model_id: str):
        self.id = model_id


def test_discovery_prunes_missing_model(monkeypatch):
    """Monkeypatch client.models.list to return a set missing one tier1 slug;

    assert that slug is pruned from live_tiers and GET /api/models reports it under "pruned".
    """
    yaml_tiers = {
        "tier1": ["meta/llama-4-maverick-17b-128e-instruct", "meta/llama-3.1-8b-instruct"],
        "tier2": ["openai/gpt-oss-120b"],
        "tier3": ["meta/llama-3.1-70b-instruct"],
    }

    pruned_slug = "meta/llama-4-maverick-17b-128e-instruct"
    live_slugs = [
        "meta/llama-3.1-8b-instruct",
        "openai/gpt-oss-120b",
        "meta/llama-3.1-70b-instruct",
        "other/some-live-model",
    ]

    mock_client = MagicMock()
    mock_client.models.list.return_value = MagicMock(data=[DummyModel(s) for s in live_slugs])

    result = discover_live_models(client=mock_client, yaml_tiers=yaml_tiers)

    assert pruned_slug in result.pruned
    assert pruned_slug not in result.tiers["tier1"]
    assert "meta/llama-3.1-8b-instruct" in result.tiers["tier1"]
    assert "openai/gpt-oss-120b" in result.tiers["tier2"]

    # Verify through GET /api/models endpoint
    monkeypatch.setattr(backend.main, "discovery_result", result)
    client = TestClient(app)
    resp = client.get("/api/models")
    assert resp.status_code == 200
    data = resp.json()
    assert pruned_slug in data["pruned"]
    assert pruned_slug not in data["tiers"]["tier1"]
    assert "meta/llama-3.1-8b-instruct" in data["tiers"]["tier1"]


def test_discovery_failure_falls_back_to_yaml_with_warning(caplog):
    """Monkeypatch models.list to raise -> assert app uses raw yaml with a WARNING log."""
    yaml_tiers = {
        "tier1": ["meta/llama-4-maverick-17b-128e-instruct", "meta/llama-3.1-8b-instruct"],
        "tier2": ["openai/gpt-oss-120b"],
        "tier3": ["meta/llama-3.1-70b-instruct"],
    }

    mock_client = MagicMock()
    mock_client.models.list.side_effect = Exception("Network timeout")

    with caplog.at_level(logging.WARNING):
        result = discover_live_models(client=mock_client, yaml_tiers=yaml_tiers)

    assert "Discovery failed, using unverified yaml tiers; dead slugs will be skipped at request time" in caplog.text
    assert result.tiers["tier1"] == yaml_tiers["tier1"]
    assert result.tiers["tier2"] == yaml_tiers["tier2"]
    assert result.tiers["tier3"] == yaml_tiers["tier3"]
    assert result.pruned == []
