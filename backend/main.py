import json
from contextlib import asynccontextmanager
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.db import init_db, get_db, SessionLocal
from backend.provider import MockProvider
from backend.router import FallbackRouter
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

mock_provider = MockProvider()
router = FallbackRouter()


# --- Pydantic Schemas ---

class ConversationCreate(BaseModel):
    title: Optional[str] = None


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    force_model: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    model_slug: Optional[str] = None
    latency_ms: Optional[int] = None
    created_at: str

    class Config:
        from_attributes = True


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
    )
    repository.touch_conversation(db, conversation_id)

    # Prepare candidate model
    attempted_slug = router.select_model(force_model=request.force_model)

    # Step d-h: Stream reply and persist assistant response
    async def event_generator():
        accumulated_text = ""
        final_model_slug = attempted_slug
        final_latency = 0.0
        success = False

        # Open dedicated session for the generator lifespan
        with SessionLocal() as stream_db:
            try:
                # Fetch full history for model context
                current_msgs = repository.list_messages(stream_db, conversation_id)
                msg_history = [{"role": m.role, "content": m.content} for m in current_msgs]

                async for chunk in mock_provider.stream_chat(msg_history, model=request.force_model):
                    if not chunk.get("done"):
                        token = chunk.get("token", "")
                        accumulated_text += token
                        yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
                    else:
                        final_model_slug = chunk.get("model_slug", attempted_slug)
                        final_latency = chunk.get("latency_ms", 0.0)

                success = True

                # Step e: Persist successful assistant message
                repository.add_message(
                    session=stream_db,
                    conversation_id=conversation_id,
                    role="assistant",
                    content=accumulated_text,
                    model_slug=final_model_slug,
                    latency_ms=final_latency,
                )
                # Step g: touch_conversation
                repository.touch_conversation(stream_db, conversation_id)

                # Step h: Final SSE chunk with conversation_id
                yield f"data: {json.dumps({'token': '', 'done': True, 'model_slug': final_model_slug, 'latency_ms': final_latency, 'conversation_id': conversation_id})}\n\n"

            except BaseException as exc:
                # Step f: On stream error mid-flight, persist failure placeholder without silent swallowing
                if not success:
                    reason = str(exc) if str(exc).strip() else exc.__class__.__name__
                    err_placeholder = f"⚠️ Response failed: {reason}"
                    try:
                        repository.add_message(
                            session=stream_db,
                            conversation_id=conversation_id,
                            role="assistant",
                            content=err_placeholder,
                            model_slug=attempted_slug,
                            latency_ms=None,
                        )
                        repository.touch_conversation(stream_db, conversation_id)
                        yield f"data: {json.dumps({'token': f'\n\n{err_placeholder}', 'done': True, 'model_slug': attempted_slug, 'latency_ms': None, 'conversation_id': conversation_id})}\n\n"
                    except Exception as persist_err:
                        # Log if database write fails during error handling
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
