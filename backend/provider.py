import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional, Any
import openai

from backend.errors import (
    RouterError,
    AuthError,
    RateLimitedError,
    DeadModelError,
    ServerError,
    TimeoutError,
    ConnectionError,
)

logger = logging.getLogger(__name__)


@dataclass
class ProviderResult:
    content: str
    model_slug: str
    latency_ms: int


class LLMProvider(ABC):
    """Abstract base class for LLM completion providers."""

    @abstractmethod
    def complete(
        self,
        messages: List[Dict[str, Any]],
        model_slug: str,
        timeout_s: Optional[int] = None,
    ) -> ProviderResult:
        """Execute chat completion for the given messages and model slug.

        Raises RouterError subclasses on failure.
        """
        pass


class RealProvider(LLMProvider):
    """Concrete provider communicating with NVIDIA NIM OpenAI-compatible API."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        timeout_s: int = 8,
        client: Optional[openai.OpenAI] = None,
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.timeout_s = timeout_s
        self.client = client or openai.OpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            max_retries=0,  # CRITICAL: router owns retries, not the SDK
            timeout=self.timeout_s,
        )

    def complete(
        self,
        messages: List[Dict[str, Any]],
        model_slug: str,
        timeout_s: Optional[int] = None,
    ) -> ProviderResult:
        t0 = time.perf_counter()
        effective_timeout = timeout_s if timeout_s is not None else self.timeout_s
        try:
            resp = self.client.chat.completions.create(
                model=model_slug,
                messages=messages,
                stream=False,
                timeout=effective_timeout,
            )
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            msg = resp.choices[0].message
            content = msg.content or getattr(msg, "reasoning_content", None) or ""
            return ProviderResult(
                content=content,
                model_slug=model_slug,
                latency_ms=elapsed_ms,
            )
        except openai.AuthenticationError as e:
            logger.debug("AuthenticationError on slug %s: %s", model_slug, e.__class__.__name__)
            raise AuthError(f"Authentication failed for model {model_slug}") from None
        except openai.RateLimitError as e:
            logger.debug("RateLimitError on slug %s: %s", model_slug, e.__class__.__name__)
            raise RateLimitedError(f"HTTP 429 Rate limit exceeded for {model_slug}") from None
        except openai.NotFoundError as e:
            logger.debug("NotFoundError on slug %s: %s", model_slug, e.__class__.__name__)
            raise DeadModelError(f"HTTP 404 Model not found: {model_slug}") from None
        except openai.InternalServerError as e:
            logger.debug("InternalServerError on slug %s: %s", model_slug, e.__class__.__name__)
            raise ServerError(f"HTTP 500 Internal server error for {model_slug}", status_code=500) from None
        except openai.APITimeoutError as e:
            logger.debug("APITimeoutError on slug %s: %s", model_slug, e.__class__.__name__)
            raise TimeoutError(f"Timeout for {model_slug}") from None
        except openai.APIConnectionError as e:
            logger.debug("APIConnectionError on slug %s: %s", model_slug, e.__class__.__name__)
            raise ConnectionError(f"Connection failed for {model_slug}") from None
        except openai.APIStatusError as e:
            code = getattr(e, "status_code", None)
            logger.debug("APIStatusError on slug %s: %s (status_code=%s)", model_slug, e.__class__.__name__, code)
            raise ServerError(f"HTTP status error ({code}) for {model_slug}", status_code=code) from None


class MockProvider(LLMProvider):
    """Deterministic mock provider that raises failures according to fail_plan

    or returns a canned success response once the plan for a slug is exhausted.
    """

    def __init__(self, fail_plan: Optional[Dict[str, List[str]]] = None):
        self.fail_plan: Dict[str, List[str]] = (
            {k: list(v) for k, v in fail_plan.items()} if fail_plan else {}
        )
        self.calls: List[Dict[str, Any]] = []

    def set_fail_plan(self, fail_plan: Dict[str, List[str]]) -> None:
        self.fail_plan = {k: list(v) for k, v in fail_plan.items()}

    def complete(
        self,
        messages: List[Dict[str, Any]],
        model_slug: str,
        timeout_s: Optional[int] = None,
    ) -> ProviderResult:
        self.calls.append({"model_slug": model_slug, "messages": messages, "timeout_s": timeout_s})

        # Check if there is an active failure plan for this slug
        if model_slug in self.fail_plan and self.fail_plan[model_slug]:
            failure_mode = self.fail_plan[model_slug].pop(0)

            if isinstance(failure_mode, Exception):
                raise failure_mode
            elif isinstance(failure_mode, type) and issubclass(failure_mode, Exception):
                raise failure_mode(f"Simulated failure {failure_mode.__name__} for {model_slug}")

            failure_str = str(failure_mode).lower().strip()
            if failure_str == "rate_limited":
                raise RateLimitedError(f"HTTP 429: Rate limit exceeded for {model_slug}")
            elif failure_str == "dead_model":
                raise DeadModelError(f"HTTP 404: Model slug '{model_slug}' not found")
            elif failure_str == "server_error":
                raise ServerError(f"HTTP 500: Server error from {model_slug}", status_code=500)
            elif failure_str == "timeout":
                raise TimeoutError(f"Timeout: Request timed out for {model_slug}")
            elif failure_str == "connection_error":
                raise ConnectionError(f"Connection error connecting to {model_slug}")
            elif failure_str == "auth_error":
                raise AuthError(f"Authentication failed for {model_slug}")
            elif failure_str == "value_error":
                raise ValueError(f"Simulated unexpected ValueError for {model_slug}")
            else:
                raise RouterError(f"Failure mode '{failure_mode}' for {model_slug}")

        # Once plan is exhausted or if no plan, succeed immediately with canned reply
        last_user = ""
        for m in reversed(messages):
            if isinstance(m, dict) and m.get("role") == "user":
                last_user = m.get("content", "")
                break

        canned = (
            f"Hello! This is a mock response from {model_slug}. "
            f"Received: \"{last_user}\". "
            "Cascade routing succeeded."
        ) if last_user else f"Mock response from {model_slug}. Cascade routing succeeded."

        return ProviderResult(
            content=canned,
            model_slug=model_slug,
            latency_ms=10,
        )
