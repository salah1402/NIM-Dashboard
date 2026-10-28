import os
from pathlib import Path
import yaml

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "models.yaml"


def load_models_config(config_path: Path = CONFIG_PATH) -> dict:
    if not config_path.exists():
        return {"tier1": [], "tier2": [], "tier3": [], "exclude": []}
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {"tier1": [], "tier2": [], "tier3": [], "exclude": []}


models_config = load_models_config()
