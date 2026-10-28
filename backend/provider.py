from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from backend.errors import (
    RouterError,
    RateLimitedError,
    DeadModelError,
    ServerError,
    TimeoutError,
    ConnectionError,
)


@dataclass
class ProviderResult:
    content: str
    model_slug: str
    latency_ms: int


class LLMProvider(ABC):
    """Abstract base class for LLM completion providers."""

    @abstractmethod
    def complete(self, messages: List[Dict[str, Any]], model_slug: str) -> ProviderResult:
        """Execute chat completion for the given messages and model slug.

        Raises RouterError subclasses on failure.
        """
        pass


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

    def complete(self, messages: List[Dict[str, Any]], model_slug: str) -> ProviderResult:
        self.calls.append({"model_slug": model_slug, "messages": messages})

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
                raise ServerError(f"HTTP 500: Server error from {model_slug}")
            elif failure_str == "timeout":
                raise TimeoutError(f"Timeout: Request timed out for {model_slug}")
            elif failure_str == "connection_error":
                raise ConnectionError(f"Connection error connecting to {model_slug}")
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
