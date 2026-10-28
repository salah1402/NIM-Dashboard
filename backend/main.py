import json
import uuid
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.provider import MockProvider

app = FastAPI(title="NIM Dashboard API", version="0.1.0")

# Enable CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mock_provider = MockProvider()

# In-memory storage for conversations in Phase 0
in_memory_conversations: Dict[str, List[Dict[str, str]]] = {}


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = Field(default=None)
    message: str


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "nim-dashboard-api"}


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    conversation_id = request.conversation_id or str(uuid.uuid4())
    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    history = in_memory_conversations.setdefault(conversation_id, [])
    history.append({"role": "user", "content": user_message})

    async def event_generator():
        accumulated_assistant_text = ""
        final_model_slug = ""
        final_latency = 0.0

        async for chunk in mock_provider.stream_chat(history):
            if not chunk.get("done"):
                token = chunk.get("token", "")
                accumulated_assistant_text += token
                yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
            else:
                final_model_slug = chunk.get("model_slug", "unknown")
                final_latency = chunk.get("latency_ms", 0.0)
                yield f"data: {json.dumps({'token': '', 'done': True, 'model_slug': final_model_slug, 'latency_ms': final_latency, 'conversation_id': conversation_id})}\n\n"

        history.append({
            "role": "assistant",
            "content": accumulated_assistant_text,
            "model_slug": final_model_slug,
            "latency_ms": final_latency,
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
