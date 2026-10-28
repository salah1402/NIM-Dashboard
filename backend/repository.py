import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.models import Conversation, Message


def create_conversation(session: Session, title: Optional[str] = None) -> Conversation:
    conv = Conversation(
        id=str(uuid.uuid4()),
        title=(title.strip() if title and title.strip() else "New chat"),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return conv


def list_conversations(session: Session) -> List[Conversation]:
    return (
        session.query(Conversation)
        .order_by(Conversation.updated_at.desc())
        .all()
    )


def list_conversations_with_count(session: Session) -> List[dict]:
    # Query conversation with message counts
    results = (
        session.query(
            Conversation,
            func.count(Message.id).label("message_count"),
        )
        .outerjoin(Message, Conversation.id == Message.conversation_id)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return [
        {
            "id": conv.id,
            "title": conv.title,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
            "message_count": count,
        }
        for conv, count in results
    ]


def get_conversation(session: Session, conversation_id: str) -> Optional[Conversation]:
    return session.query(Conversation).filter(Conversation.id == conversation_id).first()


def list_messages(session: Session, conversation_id: str) -> List[Message]:
    return (
        session.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )


def add_message(
    session: Session,
    conversation_id: str,
    role: str,
    content: str,
    model_slug: Optional[str] = None,
    latency_ms: Optional[float] = None,
) -> Message:
    latency_int = int(round(latency_ms)) if latency_ms is not None else None
    msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role=role,
        content=content,
        model_slug=model_slug,
        latency_ms=latency_int,
        created_at=datetime.utcnow(),
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return msg


def touch_conversation(session: Session, conversation_id: str) -> Optional[Conversation]:
    conv = get_conversation(session, conversation_id)
    if conv:
        conv.updated_at = datetime.utcnow()
        session.commit()
        session.refresh(conv)
    return conv


def delete_conversation(session: Session, conversation_id: str) -> bool:
    conv = get_conversation(session, conversation_id)
    if conv:
        session.delete(conv)
        session.commit()
        return True
    return False


def reconcile_interrupted_conversations(session: Session) -> int:
    """Finds conversations where the last message was a user message (e.g. server was killed mid-stream)

    and appends a failed placeholder message to satisfy user-first persistence recovery.
    """
    conversations = list_conversations(session)
    reconciled_count = 0
    for conv in conversations:
        msgs = list_messages(session, conv.id)
        if msgs and msgs[-1].role == "user":
            add_message(
                session=session,
                conversation_id=conv.id,
                role="assistant",
                content="⚠️ Response failed: Server interrupted during generation",
                model_slug="meta/llama-3.1-8b-instruct",
                latency_ms=None,
            )
            touch_conversation(session, conv.id)
            reconciled_count += 1
    return reconciled_count
