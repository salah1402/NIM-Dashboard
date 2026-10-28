import pytest
from backend.circuit_breaker import CircuitBreaker


def test_opens_after_3_failures_within_window():
    """Breaker trips open after 3 failures occur within the 60-second window."""
    current_time = 1000.0
    breaker = CircuitBreaker(
        failure_threshold=3,
        window_seconds=60,
        cooldown_seconds=300,
        clock=lambda: current_time,
    )
    slug = "meta/llama-4-maverick"

    assert breaker.is_available(slug) is True

    # 1st failure at t=1000
    breaker.record_failure(slug)
    assert breaker.is_available(slug) is True
    assert breaker.state(slug)["state"] == "closed"

    # 2nd failure at t=1020
    current_time = 1020.0
    breaker.record_failure(slug)
    assert breaker.is_available(slug) is True
    assert breaker.state(slug)["state"] == "closed"

    # 3rd failure at t=1040 (within 60s window from t=1000)
    current_time = 1040.0
    breaker.record_failure(slug)

    # Circuit should now be open
    assert breaker.is_available(slug) is False
    st = breaker.state(slug)
    assert st["state"] == "open"
    assert st["consecutive_failures"] == 3
    assert st["opened_at"] == 1040.0


def test_does_not_open_after_3_failures_spread_beyond_window():
    """Breaker does NOT open if 3 failures are spread across more than the 60-second window."""
    current_time = 1000.0
    breaker = CircuitBreaker(
        failure_threshold=3,
        window_seconds=60,
        cooldown_seconds=300,
        clock=lambda: current_time,
    )
    slug = "meta/llama-4-maverick"

    # 1st failure at t=1000
    breaker.record_failure(slug)
    assert breaker.is_available(slug) is True

    # 2nd failure at t=1070 (70s later, 1st failure dropped from 60s window)
    current_time = 1070.0
    breaker.record_failure(slug)
    assert breaker.is_available(slug) is True

    # 3rd failure at t=1140 (70s later, 2nd failure dropped from window)
    current_time = 1140.0
    breaker.record_failure(slug)

    # Circuit must NOT open since there are never >= 3 failures in any 60s sliding window
    assert breaker.is_available(slug) is True
    assert breaker.state(slug)["state"] == "closed"


def test_half_open_allows_exactly_one_probe():
    """Once cooldown expires, circuit allows exactly one probe; subsequent calls return False until resolved."""
    current_time = 1000.0
    breaker = CircuitBreaker(
        failure_threshold=3,
        window_seconds=60,
        cooldown_seconds=300,
        clock=lambda: current_time,
    )
    slug = "meta/llama-4-maverick"

    # Trip breaker at t=1000
    breaker.record_failure(slug)
    breaker.record_failure(slug)
    breaker.record_failure(slug)
    assert breaker.is_available(slug) is False

    # Cooldown has not expired at t=1299 (299s elapsed)
    current_time = 1299.0
    assert breaker.is_available(slug) is False
    assert breaker.state(slug)["state"] == "open"

    # Advance past cooldown to t=1301 (301s elapsed)
    current_time = 1301.0
    # First call: transitions to half-open, probe allowed
    assert breaker.is_available(slug) is True

    # State is half-open
    assert breaker.state(slug)["state"] == "half_open"

    # Second call while probe is in flight: MUST return False
    assert breaker.is_available(slug) is False


def test_success_during_half_open_closes_circuit():
    """Successful probe in half-open state resets failure count and closes the circuit."""
    current_time = 1000.0
    breaker = CircuitBreaker(
        failure_threshold=3,
        window_seconds=60,
        cooldown_seconds=300,
        clock=lambda: current_time,
    )
    slug = "meta/llama-4-maverick"

    # Trip circuit open
    breaker.record_failure(slug)
    breaker.record_failure(slug)
    breaker.record_failure(slug)
    assert breaker.is_available(slug) is False

    # Advance to half-open
    current_time = 1305.0
    assert breaker.is_available(slug) is True  # probe starts

    # Probe succeeds
    breaker.record_success(slug)

    # Circuit should now be closed and available
    assert breaker.is_available(slug) is True
    st = breaker.state(slug)
    assert st["state"] == "closed"
    assert st["consecutive_failures"] == 0
    assert st["opened_at"] is None


def test_failure_during_half_open_reopens_with_fresh_cooldown():
    """Failed probe in half-open state immediately re-opens the circuit with a fresh cooldown."""
    current_time = 1000.0
    breaker = CircuitBreaker(
        failure_threshold=3,
        window_seconds=60,
        cooldown_seconds=300,
        clock=lambda: current_time,
    )
    slug = "meta/llama-4-maverick"

    # Trip circuit open at t=1000
    breaker.record_failure(slug)
    breaker.record_failure(slug)
    breaker.record_failure(slug)

    # Advance to half-open at t=1305
    current_time = 1305.0
    assert breaker.is_available(slug) is True  # probe dispatched

    # Probe fails at t=1306
    current_time = 1306.0
    breaker.record_failure(slug)

    # Circuit re-opened with fresh cooldown starting at t=1306
    assert breaker.is_available(slug) is False
    st = breaker.state(slug)
    assert st["state"] == "open"
    assert st["opened_at"] == 1306.0

    # At t=1500 (194s from new opened_at), still in cooldown
    current_time = 1500.0
    assert breaker.is_available(slug) is False

    # At t=1607 (301s after 1306), fresh cooldown expired -> probe allowed again
    current_time = 1607.0
    assert breaker.is_available(slug) is True
