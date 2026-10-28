import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Any
import openai

logger = logging.getLogger(__name__)


@dataclass
class DiscoveryResult:
    live: List[str]
    pruned: List[str]
    tiers: Dict[str, List[str]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "live": self.live,
            "pruned": self.pruned,
            "tiers": self.tiers,
        }


def discover_live_models(
    client: Optional[openai.OpenAI],
    yaml_tiers: Dict[str, List[str]],
) -> DiscoveryResult:
    """Discovers live models from NVIDIA NIM and prunes non-existent models from yaml tiers.

    Never mutates config/models.yaml on disk.
    If discovery fails, logs a warning and falls back to raw yaml tiers.
    """
    raw_tiers = {
        "tier1": list(yaml_tiers.get("tier1", [])),
        "tier2": list(yaml_tiers.get("tier2", [])),
        "tier3": list(yaml_tiers.get("tier3", [])),
    }

    if client is None:
        # Mock mode: return all yaml models as live
        all_models: List[str] = []
        for t in ("tier1", "tier2", "tier3"):
            for slug in raw_tiers.get(t, []):
                if slug not in all_models:
                    all_models.append(slug)
        return DiscoveryResult(
            live=all_models,
            pruned=[],
            tiers=raw_tiers,
        )

    try:
        models_resp = client.models.list()
        live_set = {m.id for m in models_resp.data}
    except Exception as exc:
        logger.warning(
            "Discovery failed, using unverified yaml tiers; dead slugs will be skipped at request time"
        )
        all_models = []
        for t in ("tier1", "tier2", "tier3"):
            for slug in raw_tiers.get(t, []):
                if slug not in all_models:
                    all_models.append(slug)
        return DiscoveryResult(
            live=all_models,
            pruned=[],
            tiers=raw_tiers,
        )

    pruned: List[str] = []
    live_tiers: Dict[str, List[str]] = {}

    for tier_name in ("tier1", "tier2", "tier3"):
        kept: List[str] = []
        for slug in raw_tiers.get(tier_name, []):
            if slug in live_set:
                kept.append(slug)
            else:
                pruned.append(slug)
                logger.info("Pruned %s from %s: not present in /v1/models", slug, tier_name)
        live_tiers[tier_name] = kept

    return DiscoveryResult(
        live=sorted(list(live_set)),
        pruned=pruned,
        tiers=live_tiers,
    )
