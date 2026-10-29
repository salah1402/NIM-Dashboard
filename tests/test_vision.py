import json
import pytest
from unittest.mock import MagicMock
from backend.router import FallbackRouter, is_vision_model
from backend.circuit_breaker import CircuitBreaker
from backend.provider import MockProvider, RealProvider
from backend.main import ChatRequest, MessageOut, app
from backend.models import Message
from fastapi.testclient import TestClient


def test_is_vision_model():
    assert is_vision_model("meta/llama-3.2-90b-vision-instruct") is True
    assert is_vision_model("nvidia/nemotron-3.5-super-vl-120b-a12b") is True
    assert is_vision_model("microsoft/phi-3-vision-128k-instruct") is True
    assert is_vision_model("openai/gpt-oss-20b") is False
    assert is_vision_model("deepseek-ai/deepseek-v4-pro") is False


def test_chat_request_accepts_image_b64():
    req = ChatRequest(
        message="What is in this image?",
        image_b64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    )
    assert req.image_b64 is not None
    assert "data:image/png;base64" in req.image_b64


def test_router_prioritizes_vision_model_when_image_present():
    mock_prov = MockProvider()
    breaker = CircuitBreaker()
    tiers = {
        "tier1": ["deepseek-ai/deepseek-v4.1-flash"],
        "tier2": [
            "meta/llama-3.2-90b-vision-instruct",
            "nvidia/nemotron-3.5-super-vl-120b-a12b",
            "openai/gpt-oss-20b",
        ],
        "tier3": ["deepseek-ai/deepseek-v4-pro"],
    }
    router = FallbackRouter(
        provider=mock_prov,
        breaker=breaker,
        tiers=tiers,
        exclude=set(),
    )

    # When image is present, candidates should prioritize vision models
    outcome = router.route(
        messages=[{"role": "user", "content": "Analyze this chart"}],
        image_b64="data:image/jpeg;base64,fake-image-bytes",
    )
    # The first model attempted should be a vision model
    first_attempt_model = outcome.attempts[0].model_slug
    assert is_vision_model(first_attempt_model)
    # In Phase 13, nemotron is injected at the very front for vision
    assert first_attempt_model == "nvidia/nemotron-3.5-super-vl-120b-a12b"


def test_real_provider_formats_openai_vision_schema():
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "I see a chart with blue and red lines."
    mock_choice.message.tool_calls = None
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response

    provider = RealProvider(
        api_key="test-key",
        base_url="https://test.api.nvidia.com/v1",
        client=mock_client,
    )

    messages = [{"role": "user", "content": "What is in this image?"}]
    img_b64 = "data:image/png;base64,abc123"

    res = provider.complete(
        messages=messages,
        model_slug="meta/llama-3.2-90b-vision-instruct",
        image_b64=img_b64,
    )

    assert res.content == "I see a chart with blue and red lines."

    # Verify OpenAI client call was passed the vision schema
    mock_client.chat.completions.create.assert_called_once()
    called_kwargs = mock_client.chat.completions.create.call_args[1]
    called_messages = called_kwargs["messages"]
    assert len(called_messages) == 1
    user_msg = called_messages[0]
    assert user_msg["role"] == "user"
    assert isinstance(user_msg["content"], list)
    assert user_msg["content"][0] == {"type": "text", "text": "What is in this image?"}
    assert user_msg["content"][1] == {"type": "image_url", "image_url": {"url": img_b64}}
