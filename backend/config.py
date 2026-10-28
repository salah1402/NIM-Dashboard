import os
from pathlib import Path
import yaml
from dotenv import load_dotenv

# Load .env file from workspace root if present
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "models.yaml"


def load_models_config(config_path: Path = CONFIG_PATH) -> dict:
    if not config_path.exists():
        return {"tier1": [], "tier2": [], "tier3": [], "exclude": []}
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {"tier1": [], "tier2": [], "tier3": [], "exclude": []}


models_config = load_models_config()


def is_mock_enabled() -> bool:
    val = os.getenv("USE_MOCK", "true").lower().strip()
    return val in ("true", "1", "yes")


def get_nvidia_base_url() -> str:
    return os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1").strip()


def get_nvidia_api_key() -> str:
    return os.getenv("NVIDIA_API_KEY", "").strip()
