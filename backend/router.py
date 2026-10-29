import logging
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Any
from backend.circuit_breaker import CircuitBreaker
from backend.provider import LLMProvider, ProviderResult
from backend.classifier import classify_complexity
from backend.errors import (
    RouterError,
    AuthError,
    RateLimitedError,
    DeadModelError,
    ServerError,
    TimeoutError,
    ConnectionError,
    AllModelsFailed,
)
from backend import repository

logger = logging.getLogger(__name__)


@dataclass
class AttemptLog:
    model_slug: str
    tier: str
    status: str
    attempt_num: int
    latency_ms: Optional[int] = None
    error: Optional[str] = None
    log_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_slug": self.model_slug,
            "tier": self.tier,
            "status": self.status,
            "attempt_num": self.attempt_num,
            "latency_ms": self.latency_ms,
            "error": self.error,
            "log_id": self.log_id,
        }


@dataclass
class RoutingOutcome:
    content: str
    model_slug: str
    tier: str
    latency_ms: int
    attempts: List[AttemptLog]
    fallback_count: int


TIER_TIMEOUTS = {
    "tier1": 5,
    "tier2": 15,
    "tier3": 30,
}


def _map_exception_to_status(exc: Exception) -> str:
    if isinstance(exc, RateLimitedError):
        return "rate_limited"
    elif isinstance(exc, DeadModelError):
        return "dead_model"
    elif isinstance(exc, ServerError):
        return "server_error"
    elif isinstance(exc, TimeoutError):
        return "timeout"
    elif isinstance(exc, ConnectionError):
        return "connection_error"
    elif isinstance(exc, RouterError):
        return "server_error"
    return "server_error"


class FallbackRouter:
    """Cascade router managing model slugs across tiers with circuit breaker protection."""

    def __init__(
        self,
        provider: LLMProvider,
        breaker: CircuitBreaker,
        tiers: Dict[str, List[str]],
        exclude: Set[str],
        session_factory=None,
        timeout_s: int = 8,
    ):
        self.provider = provider
        self.breaker = breaker
        self.tiers = tiers
        self.exclude = set(exclude) if exclude else set()
        self.session_factory = session_factory
        self.timeout_s = timeout_s

    def get_candidate_models(
        self,
        force_model: Optional[str] = None,
        tier_order: Optional[List[str]] = None,
    ) -> List[tuple[str, str]]:
        """Builds ordered candidate list across tiers, excluding slugs in exclude.

        If force_model is set and present in candidates, restricts to just [force_model].
        """
        candidates: List[tuple[str, str]] = []
        seen = set()
        order = tier_order or ["tier1", "tier2", "tier3"]
        for tier in order:
            for slug in self.tiers.get(tier, []):
                if slug not in self.exclude and slug not in seen:
                    candidates.append((slug, tier))
                    seen.add(slug)

        if force_model is not None:
            candidates = [c for c in candidates if c[0] == force_model]

        return candidates

    def route(
        self,
        messages: List[Dict[str, Any]],
        conversation_id: Optional[str] = None,
        message_id: Optional[str] = None,
        force_model: Optional[str] = None,
        mode: Optional[str] = "auto",
        timeout_s: Optional[int] = None,
    ) -> RoutingOutcome:
        # Determine tier cascade order based on mode or complexity
        m = (mode or "auto").lower().strip()
        if m == "fastest":
            tier_order = ["tier1", "tier2", "tier3"]
        elif m == "power":
            tier_order = ["tier2", "tier3", "tier1"]
        elif m == "deep":
            tier_order = ["tier3", "tier2", "tier1"]
        else:  # auto
            last_user_text = ""
            for msg in reversed(messages):
                if isinstance(msg, dict) and msg.get("role") == "user":
                    last_user_text = msg.get("content", "")
                    break
            classified = classify_complexity(last_user_text)
            if classified == "tier3":
                tier_order = ["tier3", "tier2", "tier1"]
            elif classified == "tier2":
                tier_order = ["tier2", "tier3", "tier1"]
            else:
                tier_order = ["tier1", "tier2", "tier3"]

        candidates = self.get_candidate_models(force_model=force_model, tier_order=tier_order)
        attempts: List[AttemptLog] = []

        for attempt_idx, (slug, tier) in enumerate(candidates, start=1):
            # 2a. Circuit breaker check
            if not self.breaker.is_available(slug):
                log_entry = repository.log_routing_attempt(
                    model_slug=slug,
                    tier=tier,
                    status="skipped_circuit_open",
                    attempt_num=attempt_idx,
                    conversation_id=conversation_id,
                    message_id=message_id,
                    error="Circuit breaker open",
                    latency_ms=None,
                    session_factory=self.session_factory,
                )
                attempts.append(
                    AttemptLog(
                        model_slug=slug,
                        tier=tier,
                        status="skipped_circuit_open",
                        attempt_num=attempt_idx,
                        latency_ms=None,
                        error="Circuit breaker open",
                        log_id=log_entry.id if log_entry else None,
                    )
                )
                continue

            # Tier-based timeout: Tier 1 = 5s, Tier 2 = 12s, Tier 3 = 30s
            candidate_timeout = timeout_s if timeout_s is not None else TIER_TIMEOUTS.get(tier, 12)

            # 2b. Attempt completion with wall-clock guard
            t0 = time.perf_counter()
            try:
                result = self.provider.complete(messages, model_slug=slug, timeout_s=candidate_timeout)
                elapsed_ms = int((time.perf_counter() - t0) * 1000)
                latency = result.latency_ms if result.latency_ms is not None else elapsed_ms

                # 2c. On success
                self.breaker.record_success(slug)
                log_entry = repository.log_routing_attempt(
                    model_slug=slug,
                    tier=tier,
                    status="success",
                    attempt_num=attempt_idx,
                    conversation_id=conversation_id,
                    message_id=message_id,
                    error=None,
                    latency_ms=latency,
                    session_factory=self.session_factory,
                )
                attempts.append(
                    AttemptLog(
                        model_slug=slug,
                        tier=tier,
                        status="success",
                        attempt_num=attempt_idx,
                        latency_ms=latency,
                        error=None,
                        log_id=log_entry.id if log_entry else None,
                    )
                )
                return RoutingOutcome(
                    content=result.content,
                    model_slug=slug,
                    tier=tier,
                    latency_ms=latency,
                    attempts=attempts,
                    fallback_count=len(attempts) - 1,
                )

            except AuthError:
                # AuthError is a configuration / credential failure; must NOT trigger fallback across candidate slugs
                raise

            except RouterError as exc:
                elapsed_ms = int((time.perf_counter() - t0) * 1000)
                logger.error(f"Model {slug} failed: {exc}")
                self.breaker.record_failure(slug)
                status = _map_exception_to_status(exc)
                err_msg = str(exc)
                log_entry = repository.log_routing_attempt(
                    model_slug=slug,
                    tier=tier,
                    status=status,
                    attempt_num=attempt_idx,
                    conversation_id=conversation_id,
                    message_id=message_id,
                    error=err_msg,
                    latency_ms=elapsed_ms,
                    session_factory=self.session_factory,
                )
                attempts.append(
                    AttemptLog(
                        model_slug=slug,
                        tier=tier,
                        status=status,
                        attempt_num=attempt_idx,
                        latency_ms=elapsed_ms,
                        error=err_msg,
                        log_id=log_entry.id if log_entry else None,
                    )
                )
                continue

            except Exception as exc:
                elapsed_ms = int((time.perf_counter() - t0) * 1000)
                logger.error(f"Model {slug} failed unexpectedly: {exc}")
                err_repr = repr(exc)
                log_entry = repository.log_routing_attempt(
                    model_slug=slug,
                    tier=tier,
                    status="server_error",
                    attempt_num=attempt_idx,
                    conversation_id=conversation_id,
                    message_id=message_id,
                    error=err_repr,
                    latency_ms=elapsed_ms,
                    session_factory=self.session_factory,
                )
                attempts.append(
                    AttemptLog(
                        model_slug=slug,
                        tier=tier,
                        status="server_error",
                        attempt_num=attempt_idx,
                        latency_ms=elapsed_ms,
                        error=err_repr,
                        log_id=log_entry.id if log_entry else None,
                    )
                )
                # Re-raise unexpected exception without swallowing
                raise

        # 3. All candidates exhausted
        raise AllModelsFailed(
            f"All {len(candidates)} candidate model(s) failed in cascade",
            attempts=attempts,
        )
