import asyncio
import random
import time
from typing import AsyncGenerator, Dict, Any, List, Optional
from backend.config import models_config


class MockProvider:
    """Mock LLM provider returning simulated streamed tokens."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or models_config

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        tier1_models = self.config.get("tier1", [
            "meta/llama-4-maverick-17b-128e-instruct",
            "meta/llama-3.1-8b-instruct",
            "openai/gpt-oss-20b",
            "nvidia/nvidia-nemotron-nano-9b-v2",
        ])
        selected_model = model or random.choice(tier1_models)

        user_msg = messages[-1].get("content", "") if messages else ""
        canned_text = (
            f"Hello! This is a mock response from {selected_model}. "
            f"Received: \"{user_msg}\". "
            "NIM Dashboard cascades requests across multiple model slugs to maximize throughput. "
            "Mock streaming is working properly!"
        )
        tokens = canned_text.split(" ")
        start_time = time.time()

        # Spread ~1s total streaming delay across tokens
        delay_per_token = 1.0 / max(len(tokens), 1)

        for i, token in enumerate(tokens):
            await asyncio.sleep(delay_per_token)
            yield {
                "token": token + (" " if i < len(tokens) - 1 else ""),
                "done": False,
            }

        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        # Final chunk includes model_slug and latency
        yield {
            "token": "",
            "done": True,
            "model_slug": selected_model,
            "latency_ms": elapsed_ms,
        }
