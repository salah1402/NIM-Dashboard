from typing import List, Optional
from backend.config import models_config


class FallbackRouter:
    """Fallback router stub that manages candidate model slugs across tiers.
    In Phase 0 and Phase 1, this provides stub iteration over mock slugs.
    """

    def __init__(self, config: Optional[dict] = None):
        self.config = config or models_config

    def get_tier_models(self, tier: str = "tier1") -> List[str]:
        return list(self.config.get(tier, []))

    def get_candidate_models(self) -> List[str]:
        exclude = set(self.config.get("exclude", []))
        candidates: List[str] = []
        for tier in ("tier1", "tier2", "tier3"):
            for model in self.config.get(tier, []):
                if model not in exclude and model not in candidates:
                    candidates.append(model)
        return candidates

    def get_next_model(self) -> str:
        tier1 = self.get_tier_models("tier1")
        if tier1:
            return tier1[0]
        candidates = self.get_candidate_models()
        return candidates[0] if candidates else "meta/llama-3.1-8b-instruct"

    def select_model(self, force_model: Optional[str] = None) -> str:
        if force_model:
            return force_model
        return self.get_next_model()
