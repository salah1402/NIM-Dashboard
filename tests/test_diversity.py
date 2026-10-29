import pytest
from backend.router import FallbackRouter
from backend.circuit_breaker import CircuitBreaker
from backend.provider import MockProvider
from backend.main import MessageOut


def test_non_nemotron_prioritized_in_tier1():
    mock_prov = MockProvider()
    breaker = CircuitBreaker()
    tiers = {
        "tier1": ["openai/gpt-oss-20b", "mistralai/mistral-large-2-instruct"],
        "tier2": ["moonshotai/kimi-k2.6", "qwen/qwen2.5-72b-instruct"],
        "tier3": ["nvidia/nemotron-3.5-super-vl-120b-a12b", "deepseek-ai/deepseek-v4.1-flash"],
    }
    router = FallbackRouter(
        provider=mock_prov,
        breaker=breaker,
        tiers=tiers,
        exclude=set(),
    )

    # Simple text prompt routes to Tier 1 first (GPT-OSS), NOT Nemotron
    outcome = router.route(
        messages=[{"role": "user", "content": "hi"}],
        mode="auto",
    )
    assert outcome.model_slug == "openai/gpt-oss-20b"
    assert outcome.tier == "tier1"
    assert outcome.attempts[0].model_slug == "openai/gpt-oss-20b"


def test_nemotron_injected_at_front_for_vision():
    mock_prov = MockProvider()
    breaker = CircuitBreaker()
    # Tiers do NOT even include nemotron
    tiers = {
        "tier1": ["mistralai/mistral-large-2-instruct"],
        "tier2": ["qwen/qwen2.5-7b-instruct", "openai/gpt-oss-20b"],
        "tier3": ["deepseek-ai/deepseek-v4.1-flash"],
    }
    router = FallbackRouter(
        provider=mock_prov,
        breaker=breaker,
        tiers=tiers,
        exclude=set(),
    )

    # Route with image_b64 must inject nemotron-3.5-super-vl at index 0
    outcome = router.route(
        messages=[{"role": "user", "content": "What is in this image?"}],
        image_b64="data:image/png;base64,samplebase64",
    )
    first_attempt = outcome.attempts[0]
    assert first_attempt.model_slug == "nvidia/nemotron-3.5-super-vl-120b-a12b"
    assert outcome.model_slug == "nvidia/nemotron-3.5-super-vl-120b-a12b"


def test_message_out_serializes_fallback_attempts():
    msg = MessageOut(
        id="msg-1",
        conversation_id="conv-1",
        role="assistant",
        content="Hello!",
        model_slug="01-ai/yi-large",
        latency_ms=1200,
        fallback_count=2,
        attempts=[
            {"slug": "qwen/qwen2.5-7b-instruct", "status": "rate_limited", "error": "HTTP 429"},
            {"slug": "microsoft/phi-3-medium-128k-instruct", "status": "timeout", "error": "Timeout"},
            {"slug": "01-ai/yi-large", "status": "success", "error": None},
        ],
        created_at="2026-10-29T12:00:00",
    )
    data = msg.model_dump()
    assert data["fallback_count"] == 2
    assert len(data["attempts"]) == 3
    assert data["attempts"][0]["slug"] == "qwen/qwen2.5-7b-instruct"
    assert data["attempts"][0]["status"] == "rate_limited"
