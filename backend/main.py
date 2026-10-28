import asyncio
import json
from contextlib import asynccontextmanager
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from backend.db import init_db, get_db, SessionLocal
from backend.models import Conversation, Message
from backend.provider import MockProvider
from backend.circuit_breaker import CircuitBreaker
from backend.router import FallbackRouter
from backend.errors import AllModelsFailed
from backend.config import models_config
from backend import repository


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables
    init_db()
    # Reconcile any conversations left in-flight from previous server runs
    with SessionLocal() as session:
        repository.reconcile_interrupted_conversations(session)
    yield


app = FastAPI(title="NIM Dashboard API", version="0.2.0", lifespan=lifespan)

# Enable CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize breaker, provider, and router
breaker_cfg = models_config.get("circuit_breaker", {})
breaker = CircuitBreaker(
    failure_threshold=breaker_cfg.get("failure_threshold", 3),
    window_seconds=breaker_cfg.get("window_seconds", 60),
    cooldown_seconds=breaker_cfg.get("cooldown_seconds", 300),
    half_open_after=breaker_cfg.get("half_open_after", 300),
)
mock_provider = MockProvider()
router = FallbackRouter(
    provider=mock_provider,
    breaker=breaker,
    tiers={
        "tier1": models_config.get("tier1", []),
        "tier2": models_config.get("tier2", []),
        "tier3": models_config.get("tier3", []),
    },
    exclude=set(models_config.get("exclude", [])),
)


# --- Pydantic Schemas ---

class ConversationCreate(BaseModel):
    title: Optional[str] = None


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    force_model: Optional[str] = None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str
    content: str
    model_slug: Optional[str] = None
    latency_ms: Optional[int] = None
    fallback_count: Optional[int] = 0
    created_at: str


class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: Optional[int] = 0


# --- Endpoints ---

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "nim-dashboard-api"}


@app.get("/api/router/state")
def get_router_state():
    """Exposes circuit breaker state for all known model slugs for inspection."""
    all_slugs = []
    for tier in ("tier1", "tier2", "tier3"):
        for slug in router.tiers.get(tier, []):
            if slug not in all_slugs:
                all_slugs.append(slug)
    return {slug: router.breaker.state(slug) for slug in all_slugs}


@app.post("/api/conversations", response_model=ConversationOut)
def create_conversation_endpoint(payload: Optional[ConversationCreate] = None, db: Session = Depends(get_db)):
    title = payload.title if payload and payload.title else "New chat"
    conv = repository.create_conversation(db, title=title)
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat() if conv.created_at else "",
        updated_at=conv.updated_at.isoformat() if conv.updated_at else "",
        message_count=0,
    )


@app.get("/api/conversations", response_model=List[ConversationOut])
def list_conversations_endpoint(db: Session = Depends(get_db)):
    return repository.list_conversations_with_count(db)


@app.get("/api/conversations/{conversation_id}/messages", response_model=List[MessageOut])
def get_conversation_messages_endpoint(conversation_id: str, db: Session = Depends(get_db)):
    conv = repository.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = repository.list_messages(db, conversation_id)
    return [
        MessageOut(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role,
            content=m.content,
            model_slug=m.model_slug,
            latency_ms=m.latency_ms,
            fallback_count=getattr(m, "fallback_count", 0) or 0,
            created_at=m.created_at.isoformat() if m.created_at else "",
        )
        for m in messages
    ]


@app.delete("/api/conversations/{conversation_id}")
def delete_conversation_endpoint(conversation_id: str, db: Session = Depends(get_db)):
    deleted = repository.delete_conversation(db, conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ok": True, "deleted": conversation_id}


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Step a: Get or create conversation
    if request.conversation_id:
        conv = repository.get_conversation(db, request.conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail=f"Conversation '{request.conversation_id}' not found")
    else:
        conv = repository.create_conversation(db, title="New chat")

    conversation_id = conv.id

    # Step b: Auto-title if this is the conversation's first user message
    existing_messages = repository.list_messages(db, conversation_id)
    user_msgs_count = sum(1 for m in existing_messages if m.role == "user")
    if user_msgs_count == 0:
        clean_text = " ".join(user_message.split())
        auto_title = clean_text[:50] + ("..." if len(clean_text) > 50 else "")
        conv.title = auto_title
        db.commit()

    # Step c: PERSIST USER MESSAGE FIRST via add_message (MUST COMMIT BEFORE STREAMING)
    repository.add_message(
        session=db,
        conversation_id=conversation_id,
        role="user",
        content=user_message,
        model_slug=None,
        latency_ms=None,
        fallback_count=0,
    )
    repository.touch_conversation(db, conversation_id)

    # Step d-h: Stream reply and persist assistant response via router
    async def event_generator():
        with SessionLocal() as stream_db:
            try:
                # Fetch full history for model context
                current_msgs = repository.list_messages(stream_db, conversation_id)
                msg_history = [{"role": m.role, "content": m.content} for m in current_msgs]

                # Run cascade routing
                outcome = router.route(
                    messages=msg_history,
                    conversation_id=conversation_id,
                    force_model=request.force_model,
                )

                # Persist successful assistant message
                assistant_msg = repository.add_message(
                    session=stream_db,
                    conversation_id=conversation_id,
                    role="assistant",
                    content=outcome.content,
                    model_slug=outcome.model_slug,
                    latency_ms=outcome.latency_ms,
                    fallback_count=outcome.fallback_count,
                )
                repository.touch_conversation(stream_db, conversation_id)

                # Link routing logs to this message
                log_ids = [a.log_id for a in outcome.attempts if a.log_id]
                repository.link_routing_logs_to_message(stream_db, log_ids, assistant_msg.id)

                # Stream tokens
                words = outcome.content.split(" ")
                for i, word in enumerate(words):
                    piece = word + (" " if i < len(words) - 1 else "")
                    yield f"data: {json.dumps({'token': piece, 'done': False})}\n\n"
                    await asyncio.sleep(0.01)

                # Final SSE chunk includes conversation_id and fallback_count
                yield f"data: {json.dumps({'token': '', 'done': True, 'model_slug': outcome.model_slug, 'latency_ms': outcome.latency_ms, 'conversation_id': conversation_id, 'fallback_count': outcome.fallback_count})}\n\n"

            except AllModelsFailed as exc:
                err_placeholder = "⚠️ Response failed: All candidate models failed"
                first_slug = exc.attempts[0].model_slug if exc.attempts else None
                try:
                    assistant_msg = repository.add_message(
                        session=stream_db,
                        conversation_id=conversation_id,
                        role="assistant",
                        content=err_placeholder,
                        model_slug=first_slug,
                        latency_ms=None,
                        fallback_count=len(exc.attempts),
                    )
                    repository.touch_conversation(stream_db, conversation_id)
                    log_ids = [a.log_id for a in exc.attempts if a.log_id]
                    repository.link_routing_logs_to_message(stream_db, log_ids, assistant_msg.id)

                    attempts_data = [a.to_dict() for a in exc.attempts]
                    yield f"data: {json.dumps({'error': 'all_models_failed', 'token': f'\\n\\n{err_placeholder}', 'done': True, 'attempts': attempts_data, 'conversation_id': conversation_id, 'fallback_count': len(exc.attempts)})}\n\n"
                except Exception as persist_err:
                    print(f"Error persisting all-models-failed placeholder: {persist_err}")

            except BaseException as exc:
                reason = str(exc) if str(exc).strip() else exc.__class__.__name__
                err_placeholder = f"⚠️ Response failed: {reason}"
                try:
                    repository.add_message(
                        session=stream_db,
                        conversation_id=conversation_id,
                        role="assistant",
                        content=err_placeholder,
                        model_slug=None,
                        latency_ms=None,
                        fallback_count=0,
                    )
                    repository.touch_conversation(stream_db, conversation_id)
                    yield f"data: {json.dumps({'error': 'server_error', 'token': f'\\n\\n{err_placeholder}', 'done': True, 'conversation_id': conversation_id})}\n\n"
                except Exception as persist_err:
                    print(f"Error persisting failure placeholder: {persist_err}")
                raise

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
