import pytest
from backend.classifier import classify_complexity


def test_classify_simple_message():
    """Simple short messages are routed to Tier 1."""
    assert classify_complexity("Hi") == "tier1"
    assert classify_complexity("What is the capital of France?") == "tier1"
    assert classify_complexity("") == "tier1"


def test_classify_tier3_code_blocks():
    """Messages containing code blocks are routed to Tier 3."""
    msg = "Here is some code:\n```python\ndef add(a, b): return a + b\n```\nCan you optimize it?"
    assert classify_complexity(msg) == "tier3"


def test_classify_tier3_math_symbols():
    """Messages containing math symbols (∫, ∑, √) are routed to Tier 3."""
    assert classify_complexity("Calculate √144 + 5") == "tier3"
    assert classify_complexity("Evaluate the integral ∫ x^2 dx") == "tier3"
    assert classify_complexity("Compute ∑ i for i from 1 to 10") == "tier3"


def test_classify_tier3_reasoning_keywords():
    """Messages containing reasoning keywords are routed to Tier 3."""
    assert classify_complexity("Please prove that prime numbers are infinite.") == "tier3"
    assert classify_complexity("Derive the quadratic formula.") == "tier3"
    assert classify_complexity("Analyze the macroeconomic trends of 2026.") == "tier3"
    assert classify_complexity("Show me step-by-step how to solve this equation.") == "tier3"


def test_classify_tier3_length_over_500():
    """Messages exceeding 500 characters are routed to Tier 3."""
    long_msg = "Hello world! " * 50  # > 500 chars
    assert len(long_msg) > 500
    assert classify_complexity(long_msg) == "tier3"


def test_classify_tier2_explanation_comparison_summary():
    """Messages requesting explanations, comparisons, or summaries are routed to Tier 2."""
    assert classify_complexity("Explain how photosynthesis works.") == "tier2"
    assert classify_complexity("Give an explanation of quantum entanglement.") == "tier2"
    assert classify_complexity("Compare React and Vue.") == "tier2"
    assert classify_complexity("Provide a comparison between SQL and NoSQL.") == "tier2"
    assert classify_complexity("Summarize this paragraph for me.") == "tier2"
    assert classify_complexity("Give me a brief summary.") == "tier2"


def test_classify_tier2_length_between_150_and_500():
    """Messages between 150 and 500 characters without tier 3 triggers are routed to Tier 2."""
    medium_msg = "I am planning a trip to Japan next month and looking for recommendations on places to visit in Tokyo, Kyoto, and Osaka. Any good suggestions on hotels and transit passes for a two week vacation?"
    assert 150 < len(medium_msg) <= 500
    assert classify_complexity(medium_msg) == "tier2"
