import time
from typing import Dict, List, Optional, Callable


DEFAULT_FAILURE_THRESHOLD = 3
DEFAULT_WINDOW_SECONDS = 60
DEFAULT_COOLDOWN_SECONDS = 300
DEFAULT_HALF_OPEN_AFTER = 300


class _SlugState:
    def __init__(self):
        self.consecutive_failures: int = 0
        self.failure_timestamps: List[float] = []
        self.opened_at: Optional[float] = None
        self.half_open: bool = False
        self.probing: bool = False


class CircuitBreaker:
    """In-memory circuit breaker per model slug.

    Maintains failure counts within a sliding window, trips open on reaching threshold,
    enters half-open after cooldown to allow exactly one probe request.
    Process-local, does not persist across restarts.
    """

    def __init__(
        self,
        failure_threshold: int = DEFAULT_FAILURE_THRESHOLD,
        window_seconds: float = DEFAULT_WINDOW_SECONDS,
        cooldown_seconds: float = DEFAULT_COOLDOWN_SECONDS,
        half_open_after: float = DEFAULT_HALF_OPEN_AFTER,
        clock: Optional[Callable[[], float]] = None,
    ):
        self.failure_threshold = failure_threshold
        self.window_seconds = window_seconds
        self.cooldown_seconds = cooldown_seconds
        self.half_open_after = half_open_after
        self.clock: Callable[[], float] = clock or time.time
        self._slug_states: Dict[str, _SlugState] = {}

    def _get_or_create(self, slug: str) -> _SlugState:
        if slug not in self._slug_states:
            self._slug_states[slug] = _SlugState()
        return self._slug_states[slug]

    def is_available(self, slug: str, now: Optional[float] = None) -> bool:
        """Check if slug is available for requests.

        - If open and cooldown elapsed -> transition to half-open, return True
          (allow exactly one probe; subsequent calls during probe return False until probe resolves).
        - If open and still in cooldown -> False.
        - Else -> True.
        """
        current_time = self.clock() if now is None else now
        state = self._get_or_create(slug)

        if state.opened_at is None:
            # Circuit is closed
            return True

        if state.probing:
            # Probe is currently in flight; block subsequent calls until probe completes
            return False

        elapsed = current_time - state.opened_at
        if elapsed >= self.cooldown_seconds:
            # Cooldown passed -> transition to half-open and allow exactly one probe
            state.half_open = True
            state.probing = True
            return True
        else:
            # Still in cooldown
            return False

    def record_success(self, slug: str) -> None:
        """Resets failures and closes circuit for slug."""
        state = self._get_or_create(slug)
        state.consecutive_failures = 0
        state.failure_timestamps.clear()
        state.opened_at = None
        state.half_open = False
        state.probing = False

    def record_failure(self, slug: str, now: Optional[float] = None) -> None:
        """Increments failure count; trips circuit open if threshold reached within window."""
        current_time = self.clock() if now is None else now
        state = self._get_or_create(slug)
        state.consecutive_failures += 1

        # If already open or half-open, failure re-opens circuit with fresh cooldown
        if state.opened_at is not None:
            state.opened_at = current_time
            state.half_open = False
            state.probing = False
            state.failure_timestamps.append(current_time)
            return

        # Circuit was closed: prune older timestamps outside window
        cutoff = current_time - self.window_seconds
        state.failure_timestamps = [t for t in state.failure_timestamps if t >= cutoff]
        state.failure_timestamps.append(current_time)

        if len(state.failure_timestamps) >= self.failure_threshold:
            state.opened_at = current_time
            state.half_open = False
            state.probing = False

    def state(self, slug: str, now: Optional[float] = None) -> dict:
        """Returns dict: {state, consecutive_failures, opened_at}."""
        current_time = self.clock() if now is None else now
        st = self._get_or_create(slug)

        if st.opened_at is None:
            status = "closed"
        elif st.probing or st.half_open:
            status = "half_open"
        elif (current_time - st.opened_at) >= self.cooldown_seconds:
            status = "half_open"
        else:
            status = "open"

        return {
            "state": status,
            "consecutive_failures": st.consecutive_failures,
            "opened_at": st.opened_at,
        }
