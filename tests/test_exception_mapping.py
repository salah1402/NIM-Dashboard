import pytest
from unittest.mock import MagicMock
import httpx2 as httpx
import openai
from backend.provider import RealProvider
from backend.router import FallbackRouter
from backend.circuit_breaker import CircuitBreaker
from backend.errors import (
    RateLimitedError,
    DeadModelError,
    ServerError,
    TimeoutError,
    ConnectionError,
    AuthError,
)

req = httpx.Request("POST", "https://integrate.api.nvidia.com/v1")
resp_429 = httpx.Response(status_code=429, request=req)
resp_404 = httpx.Response(status_code=404, request=req)
resp_500 = httpx.Response(status_code=500, request=req)
resp_502 = httpx.Response(status_code=502, request=req)
resp_401 = httpx.Response(status_code=401, request=req)


@pytest.mark.parametrize(
    "openai_exc,expected_error_cls",
    [
        (openai.RateLimitError(message="429 Rate limited", response=resp_429, body=None), RateLimitedError),
        (openai.NotFoundError(message="404 Not found", response=resp_404, body=None), DeadModelError),
        (openai.InternalServerError(message="500 Internal error", response=resp_500, body=None), ServerError),
        (openai.APITimeoutError(request=req), TimeoutError),
        (openai.APIConnectionError(request=req), ConnectionError),
        (openai.APIStatusError(message="502 Bad Gateway", response=resp_502, body=None), ServerError),
        (openai.AuthenticationError(message="401 Unauthorized", response=resp_401, body=None), AuthError),
    ],
)
def test_real_provider_exception_translation(openai_exc, expected_error_cls):
    """Assert RealProvider catches openai exceptions and raises corresponding typed RouterError subclasses."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = openai_exc
    provider = RealProvider(api_key="test-key", base_url="https://example.com", client=mock_client)

    with pytest.raises(expected_error_cls):
        provider.complete(
            messages=[{"role": "user", "content": "hello"}],
            model_slug="meta/llama-3.1-8b-instruct",
        )


def test_auth_error_does_not_fallback(temp_db):
    """Assert AuthenticationError raises AuthError and the router does NOT fall back when AuthError is raised."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = openai.AuthenticationError(
        message="Invalid key", response=resp_401, body=None
    )
    provider = RealProvider(api_key="bad-key", base_url="https://example.com", client=mock_client)
    breaker = CircuitBreaker()
    router = FallbackRouter(
        provider=provider,
        breaker=breaker,
        tiers={
            "tier1": ["slug-1", "slug-2"],
            "tier2": ["slug-3"],
            "tier3": ["slug-4"],
        },
        exclude=set(),
        session_factory=temp_db["session_factory"],
    )

    with pytest.raises(AuthError):
        router.route(messages=[{"role": "user", "content": "test auth"}])

    # Assert client was called exactly ONCE (for slug-1) and did NOT fallback to slug-2 or subsequent tiers
    assert mock_client.chat.completions.create.call_count == 1
    assert mock_client.chat.completions.create.call_args.kwargs["model"] == "slug-1"
