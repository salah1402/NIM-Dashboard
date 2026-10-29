import re


def classify_complexity(message: str) -> str:
    """Classifies prompt complexity into 'tier1', 'tier2', or 'tier3' using fast zero-latency heuristics.

    Heuristics:
    - If message length > 500 chars, OR contains code blocks (```), OR contains math symbols (∫, ∑, √),
      OR contains reasoning keywords ("prove", "derive", "analyze", "step-by-step"): return 'tier3'
    - Elif message length > 150 chars, OR asks for explanation/comparison/summary: return 'tier2'
    - Else: return 'tier1'
    """
    if not message:
        return "tier1"

    text = message.strip()
    lower_text = text.lower()

    # Tier 3 heuristics
    if len(text) > 500:
        return "tier3"

    if "```" in text:
        return "tier3"

    math_symbols = ("∫", "∑", "√")
    if any(sym in text for sym in math_symbols):
        return "tier3"

    reasoning_keywords = (
        "prove",
        "derive",
        "analyze",
        "step-by-step",
        "roadmap",
        "root map",
        "road map",
        "blueprint",
        "curriculum",
    )
    for kw in reasoning_keywords:
        if re.search(rf"\b{re.escape(kw)}\b", lower_text):
            return "tier3"

    # Tier 2 heuristics
    if len(text) > 150:
        return "tier2"

    tier2_keywords = ("explain", "explanation", "compare", "comparison", "summarize", "summary")
    for kw in tier2_keywords:
        if re.search(rf"\b{re.escape(kw)}\b", lower_text):
            return "tier2"

    # Default to Tier 1
    return "tier1"
