import pytest
from backend.errors import AllModelsFailed, RouterError
from backend.models import RoutingLog


def test_happy_path_first_slug(router_builder):
    """No fail_plan -> first slug succeeds, fallback_count=0, one routing_logs row with status='success'."""
    router, provider, breaker, session_factory = router_builder(fail_plan=None)
    messages = [{"role": "user", "content": "Hello world"}]

    outcome = router.route(messages=messages, conversation_id="conv-1")

    assert outcome.model_slug == "meta/llama-4-maverick-17b-128e-instruct"
    assert outcome.tier == "tier1"
    assert outcome.fallback_count == 0
    assert len(outcome.attempts) == 1
    assert outcome.attempts[0].status == "success"
    assert outcome.attempts[0].attempt_num == 1

    with session_factory() as session:
        logs = session.query(RoutingLog).order_by(RoutingLog.attempt_num.asc()).all()
        assert len(logs) == 1
        assert logs[0].model_slug == "meta/llama-4-maverick-17b-128e-instruct"
        assert logs[0].status == "success"
        assert logs[0].tier == "tier1"
        assert logs[0].attempt_num == 1
        assert logs[0].latency_ms is not None
        assert logs[0].error is None


def test_fallback_on_429(router_builder):
    """Tier1 slug 1 raises rate_limited twice, then succeeds -> router moves to slug 2, fallback_count>=1,

    routing_logs has rate_limited row then success row.
    """
    slug1 = "meta/llama-4-maverick-17b-128e-instruct"
    slug2 = "meta/llama-3.1-8b-instruct"
    fail_plan = {slug1: ["rate_limited", "rate_limited"]}

    router, provider, breaker, session_factory = router_builder(fail_plan=fail_plan)
    messages = [{"role": "user", "content": "Cascade test"}]

    outcome = router.route(messages=messages, conversation_id="conv-429")

    assert outcome.model_slug == slug2
    assert outcome.fallback_count >= 1
    assert len(outcome.attempts) == 2
    assert outcome.attempts[0].status == "rate_limited"
    assert outcome.attempts[0].model_slug == slug1
    assert outcome.attempts[1].status == "success"
    assert outcome.attempts[1].model_slug == slug2

    with session_factory() as session:
        logs = session.query(RoutingLog).order_by(RoutingLog.attempt_num.asc()).all()
        assert len(logs) == 2
        assert logs[0].model_slug == slug1
        assert logs[0].status == "rate_limited"
        assert logs[0].attempt_num == 1
        assert logs[1].model_slug == slug2
        assert logs[1].status == "success"
        assert logs[1].attempt_num == 2


def test_fallback_on_404(router_builder):
    """First slug raises dead_model -> moves to next, status='dead_model' logged."""
    slug1 = "meta/llama-4-maverick-17b-128e-instruct"
    slug2 = "meta/llama-3.1-8b-instruct"
    fail_plan = {slug1: ["dead_model"]}

    router, provider, breaker, session_factory = router_builder(fail_plan=fail_plan)
    outcome = router.route(messages=[{"role": "user", "content": "hi"}])

    assert outcome.model_slug == slug2
    assert outcome.attempts[0].status == "dead_model"

    with session_factory() as session:
        logs = session.query(RoutingLog).order_by(RoutingLog.attempt_num.asc()).all()
        assert len(logs) == 2
        assert logs[0].model_slug == slug1
        assert logs[0].status == "dead_model"
        assert logs[1].model_slug == slug2
        assert logs[1].status == "success"


def test_fallback_on_timeout(router_builder):
    """First slug raises timeout -> moves to next."""
    slug1 = "meta/llama-4-maverick-17b-128e-instruct"
    slug2 = "meta/llama-3.1-8b-instruct"
    fail_plan = {slug1: ["timeout"]}

    router, provider, breaker, session_factory = router_builder(fail_plan=fail_plan)
    outcome = router.route(messages=[{"role": "user", "content": "hi"}])

    assert outcome.model_slug == slug2
    assert outcome.attempts[0].status == "timeout"

    with session_factory() as session:
        logs = session.query(RoutingLog).order_by(RoutingLog.attempt_num.asc()).all()
        assert len(logs) == 2
        assert logs[0].model_slug == slug1
        assert logs[0].status == "timeout"
        assert logs[1].model_slug == slug2
        assert logs[1].status == "success"


def test_all_models_fail(router_builder):
    """Every slug in every tier fails -> AllModelsFailed raised, routing_logs contains one row per attempted slug, in order."""
    tiers = {
        "tier1": ["t1-m1", "t1-m2"],
        "tier2": ["t2-m1"],
        "tier3": ["t3-m1"],
    }
    all_slugs = ["t1-m1", "t1-m2", "t2-m1", "t3-m1"]
    fail_plan = {s: ["server_error"] for s in all_slugs}

    router, provider, breaker, session_factory = router_builder(
        fail_plan=fail_plan,
        tiers=tiers,
        exclude=set(),
    )

    with pytest.raises(AllModelsFailed) as exc_info:
        router.route(messages=[{"role": "user", "content": "all fail"}])

    assert len(exc_info.value.attempts) == 4

    with session_factory() as session:
        logs = session.query(RoutingLog).order_by(RoutingLog.attempt_num.asc()).all()
        assert len(logs) == 4
        assert [l.model_slug for l in logs] == all_slugs
        assert [l.attempt_num for l in logs] == [1, 2, 3, 4]
        assert all(l.status == "server_error" for l in logs)


def test_circuit_breaker_skips_slug(router_builder):
    """Pre-trip breaker on slug1, then route -> slug1 gets status='skipped_circuit_open'

    and is NOT called (assert provider.complete not called for slug1).
    """
    slug1 = "meta/llama-4-maverick-17b-128e-instruct"
    slug2 = "meta/llama-3.1-8b-instruct"

    router, provider, breaker, session_factory = router_builder()

    # Pre-trip circuit breaker for slug1
    breaker.record_failure(slug1)
    breaker.record_failure(slug1)
    breaker.record_failure(slug1)
    assert breaker.is_available(slug1) is False

    outcome = router.route(messages=[{"role": "user", "content": "test breaker"}])

    assert outcome.model_slug == slug2
    assert len(outcome.attempts) == 2
    assert outcome.attempts[0].model_slug == slug1
    assert outcome.attempts[0].status == "skipped_circuit_open"
    assert outcome.attempts[0].latency_ms is None

    # Assert provider.complete was never called for slug1
    called_slugs = [call["model_slug"] for call in provider.calls]
    assert slug1 not in called_slugs
    assert slug2 in called_slugs

    with session_factory() as session:
        logs = session.query(RoutingLog).order_by(RoutingLog.attempt_num.asc()).all()
        assert len(logs) == 2
        assert logs[0].model_slug == slug1
        assert logs[0].status == "skipped_circuit_open"
        assert logs[0].latency_ms is None


def test_force_model_restricts_candidates(router_builder):
    """Force_model set to a tier2 slug -> only that slug is attempted; fallback_count=0."""
    tier2_slug = "nvidia/llama-3.3-nemotron-super-49b-v1"

    router, provider, breaker, session_factory = router_builder()
    outcome = router.route(
        messages=[{"role": "user", "content": "forced"}],
        force_model=tier2_slug,
    )

    assert outcome.model_slug == tier2_slug
    assert outcome.fallback_count == 0
    assert len(outcome.attempts) == 1
    assert outcome.attempts[0].model_slug == tier2_slug
    assert outcome.attempts[0].tier == "tier2"
    assert outcome.attempts[0].status == "success"

    # Only that model was called
    called_slugs = [c["model_slug"] for c in provider.calls]
    assert called_slugs == [tier2_slug]


def test_exclude_list_respected(router_builder):
    """Excluded slug never appears in attempts."""
    excluded_slug = "qwen/qwen3-235b-a22b"
    tiers = {
        "tier1": ["meta/llama-4-maverick-17b-128e-instruct", excluded_slug],
        "tier2": ["openai/gpt-oss-120b"],
        "tier3": [],
    }

    router, provider, breaker, session_factory = router_builder(
        tiers=tiers,
        exclude={excluded_slug},
    )
    outcome = router.route(messages=[{"role": "user", "content": "test exclude"}])

    attempted_slugs = [a.model_slug for a in outcome.attempts]
    assert excluded_slug not in attempted_slugs

    candidates = [c[0] for c in router.get_candidate_models()]
    assert excluded_slug not in candidates


def test_unexpected_exception_not_swallowed(router_builder):
    """Provider raises ValueError -> router logs then re-raises; assert ValueError propagates."""
    slug1 = "meta/llama-4-maverick-17b-128e-instruct"
    fail_plan = {slug1: ["value_error"]}

    router, provider, breaker, session_factory = router_builder(fail_plan=fail_plan)

    with pytest.raises(ValueError, match="Simulated unexpected ValueError"):
        router.route(messages=[{"role": "user", "content": "unhandled error"}])

    # Assert row was logged as server_error with exception repr before re-raising
    with session_factory() as session:
        logs = session.query(RoutingLog).all()
        assert len(logs) == 1
        assert logs[0].model_slug == slug1
        assert logs[0].status == "server_error"
        assert "ValueError" in logs[0].error


def test_router_modes_tier_prioritization(router_builder):
    """Routing modes (fastest, power, deep) alter the tier attempt cascade order."""
    tiers = {
        "tier1": ["t1-m1"],
        "tier2": ["t2-m1"],
        "tier3": ["t3-m1"],
    }
    router, provider, breaker, session_factory = router_builder(tiers=tiers)

    # Fastest mode starts with tier 1
    outcome_fast = router.route([{"role": "user", "content": "hi"}], mode="fastest")
    assert outcome_fast.model_slug == "t1-m1"
    assert outcome_fast.tier == "tier1"

    # Power mode starts with tier 2
    outcome_power = router.route([{"role": "user", "content": "hi"}], mode="power")
    assert outcome_power.model_slug == "t2-m1"
    assert outcome_power.tier == "tier2"

    # Deep mode starts with tier 3
    outcome_deep = router.route([{"role": "user", "content": "hi"}], mode="deep")
    assert outcome_deep.model_slug == "t3-m1"
    assert outcome_deep.tier == "tier3"


def test_router_auto_mode_uses_classifier(router_builder):
    """Auto mode automatically selects tier order according to prompt complexity."""
    tiers = {
        "tier1": ["t1-m1"],
        "tier2": ["t2-m1"],
        "tier3": ["t3-m1"],
    }
    router, provider, breaker, session_factory = router_builder(tiers=tiers)

    # Complex math prompt triggers Tier 3 first
    outcome_math = router.route([{"role": "user", "content": "Calculate √256"}], mode="auto")
    assert outcome_math.model_slug == "t3-m1"
    assert outcome_math.tier == "tier3"

    # Explanation prompt triggers Tier 2 first
    outcome_explain = router.route([{"role": "user", "content": "Explain how caching works"}], mode="auto")
    assert outcome_explain.model_slug == "t2-m1"
    assert outcome_explain.tier == "tier2"

    # Simple prompt triggers Tier 1 first
    outcome_simple = router.route([{"role": "user", "content": "Hello"}], mode="auto")
    assert outcome_simple.model_slug == "t1-m1"
    assert outcome_simple.tier == "tier1"


def test_router_passes_timeout_to_provider(router_builder):
    """Router passes timeout_s (default 8s) to provider.complete call."""
    router, provider, breaker, session_factory = router_builder()
    router.route([{"role": "user", "content": "hi"}], timeout_s=8)

    assert len(provider.calls) > 0
    assert provider.calls[0]["timeout_s"] == 8
