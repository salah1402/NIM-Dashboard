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
    tool_calls: Optional[List[Dict[str, Any]]] = None


class LLMProvider(ABC):
    """Abstract base class for LLM completion providers."""

    @abstractmethod
    def complete(
        self,
        messages: List[Dict[str, Any]],
        model_slug: str,
        timeout_s: Optional[int] = None,
        max_tokens: Optional[int] = 4096,
        tools: Optional[List[Dict[str, Any]]] = None,
        image_b64: Optional[str] = None,
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
        timeout_s: Optional[int] = None,
        client: Optional[openai.OpenAI] = None,
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.timeout_s = timeout_s
        self.client = client or openai.OpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            max_retries=0,  # CRITICAL: router owns retries, not the SDK
            timeout=self.timeout_s or 180.0,
        )

    def complete(
        self,
        messages: List[Dict[str, Any]],
        model_slug: str,
        timeout_s: Optional[int] = None,
        max_tokens: Optional[int] = 4096,
        tools: Optional[List[Dict[str, Any]]] = None,
        image_b64: Optional[str] = None,
    ) -> ProviderResult:
        t0 = time.perf_counter()
        effective_timeout = timeout_s if timeout_s is not None else (self.timeout_s or 30)
        effective_max_tokens = max_tokens if max_tokens is not None else 4096

        # Format messages with vision schema if image_b64 is provided and not already formatted
        effective_messages = []
        for i, m in enumerate(messages):
            if m.get("role") == "user" and i == len(messages) - 1 and image_b64:
                curr_content = m.get("content", "")
                if isinstance(curr_content, list):
                    effective_messages.append(m)
                else:
                    url = image_b64 if image_b64.startswith("data:") else f"data:image/jpeg;base64,{image_b64}"
                    effective_messages.append({
                        "role": "user",
                        "content": [
                            {"type": "text", "text": curr_content},
                            {"type": "image_url", "image_url": {"url": url}},
                        ],
                    })
            else:
                effective_messages.append(m)

        create_kwargs: Dict[str, Any] = {
            "model": model_slug,
            "messages": effective_messages,
            "stream": False,
            "timeout": effective_timeout,
            "max_tokens": effective_max_tokens,
        }
        if tools:
            create_kwargs["tools"] = tools
        try:
            resp = self.client.chat.completions.create(**create_kwargs)
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            msg = resp.choices[0].message
            content = msg.content or getattr(msg, "reasoning_content", None) or ""

            parsed_tool_calls = None
            if getattr(msg, "tool_calls", None):
                parsed_tool_calls = []
                for tc in msg.tool_calls:
                    parsed_tool_calls.append({
                        "id": getattr(tc, "id", None),
                        "type": getattr(tc, "type", "function"),
                        "function": {
                            "name": getattr(tc.function, "name", ""),
                            "arguments": getattr(tc.function, "arguments", "{}"),
                        },
                    })

            return ProviderResult(
                content=content,
                model_slug=model_slug,
                latency_ms=elapsed_ms,
                tool_calls=parsed_tool_calls,
            )
        except openai.AuthenticationError as e:
            logger.error("AuthenticationError on slug %s: %s", model_slug, e)
            raise AuthError(f"Authentication failed for model {model_slug}") from None
        except openai.RateLimitError as e:
            logger.error("RateLimitError on slug %s: %s", model_slug, e)
            raise RateLimitedError(f"HTTP 429 Rate limit exceeded for {model_slug}") from None
        except openai.NotFoundError as e:
            logger.error("NotFoundError on slug %s: %s", model_slug, e)
            raise DeadModelError(f"HTTP 404 Model not found: {model_slug}") from None
        except openai.InternalServerError as e:
            logger.error("InternalServerError on slug %s: %s", model_slug, e)
            raise ServerError(f"HTTP 500 Internal server error for {model_slug}", status_code=500) from None
        except openai.APITimeoutError as e:
            logger.error("APITimeoutError on slug %s: %s", model_slug, e)
            raise TimeoutError(f"Timeout for {model_slug}") from None
        except openai.APIConnectionError as e:
            logger.error("APIConnectionError on slug %s: %s", model_slug, e)
            raise ConnectionError(f"Connection failed for {model_slug}") from None
        except openai.APIStatusError as e:
            code = getattr(e, "status_code", None)
            logger.error("APIStatusError on slug %s: %s (status_code=%s)", model_slug, e, code)
            raise ServerError(f"HTTP status error ({code}) for {model_slug}: {e}", status_code=code) from None


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
        max_tokens: Optional[int] = 4096,
        tools: Optional[List[Dict[str, Any]]] = None,
        image_b64: Optional[str] = None,
    ) -> ProviderResult:
        self.calls.append({
            "model_slug": model_slug,
            "messages": messages,
            "timeout_s": timeout_s,
            "max_tokens": max_tokens,
            "tools": tools,
            "image_b64": image_b64,
        })

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
        has_image = bool(image_b64)
        for m in reversed(messages):
            if isinstance(m, dict) and m.get("role") == "user":
                content = m.get("content", "")
                if isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict) and part.get("type") == "text":
                            last_user = part.get("text", "")
                        elif isinstance(part, dict) and part.get("type") == "image_url":
                            has_image = True
                else:
                    last_user = content
                break

        # Check if tools are provided and user prompt asks for fibonacci or python calculation
        has_tool_response = any(isinstance(m, dict) and m.get("role") == "tool" for m in messages)
        if tools and not has_tool_response and any(k in last_user.lower() for k in ("fibonacci", "python", "50th")):
            import json
            return ProviderResult(
                content="",
                model_slug=model_slug,
                latency_ms=10,
                tool_calls=[{
                    "id": "call_mock_1",
                    "type": "function",
                    "function": {
                        "name": "execute_python",
                        "arguments": json.dumps({"code": "a, b = 0, 1\nfor _ in range(50): a, b = b, a + b\nprint(a)"}),
                    },
                }],
            )

        if has_tool_response:
            canned = "The 50th Fibonacci number is 12586269025. Calculated using Python interpreter."
            return ProviderResult(
                content=canned,
                model_slug=model_slug,
                latency_ms=10,
            )

        if has_image:
            canned = f"The uploaded image displays visual data and code. Analyzed via {model_slug}."
            return ProviderResult(
                content=canned,
                model_slug=model_slug,
                latency_ms=10,
            )

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
