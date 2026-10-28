import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from backend.models import Conversation, Message, RoutingLog
from backend.db import SessionLocal


def create_conversation(session: Session, title: Optional[str] = None) -> Conversation:
    now = datetime.now(timezone.utc)
    conv = Conversation(
        id=str(uuid.uuid4()),
        title=(title.strip() if title and title.strip() else "New chat"),
        created_at=now,
        updated_at=now,
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
    fallback_count: Optional[int] = 0,
) -> Message:
    latency_int = int(round(latency_ms)) if latency_ms is not None else None
    msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role=role,
        content=content,
        model_slug=model_slug,
        latency_ms=latency_int,
        fallback_count=fallback_count or 0,
        created_at=datetime.now(timezone.utc),
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return msg


def touch_conversation(session: Session, conversation_id: str) -> Optional[Conversation]:
    conv = get_conversation(session, conversation_id)
    if conv:
        conv.updated_at = datetime.now(timezone.utc)
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
                fallback_count=0,
            )
            touch_conversation(session, conv.id)
            reconciled_count += 1
    return reconciled_count


def log_routing_attempt(
    model_slug: str,
    tier: str,
    status: str,
    attempt_num: int,
    conversation_id: Optional[str] = None,
    message_id: Optional[str] = None,
    error: Optional[str] = None,
    latency_ms: Optional[int] = None,
    session: Optional[Session] = None,
    session_factory=None,
) -> RoutingLog:
    """Logs a single cascade attempt in routing_logs using a dedicated or short-lived session."""
    log_id = str(uuid.uuid4())
    log_entry = RoutingLog(
        id=log_id,
        message_id=message_id,
        conversation_id=conversation_id,
        model_slug=model_slug,
        tier=tier,
        status=status,
        error=error,
        latency_ms=latency_ms,
        attempt_num=attempt_num,
        created_at=datetime.now(timezone.utc),
    )

    if session is not None:
        session.add(log_entry)
        session.commit()
        session.refresh(log_entry)
        return log_entry

    factory = session_factory or SessionLocal
    with factory() as s:
        s.add(log_entry)
        s.commit()
        s.refresh(log_entry)
        return log_entry


def link_routing_logs_to_message(
    session: Session,
    log_ids: List[str],
    message_id: str,
) -> None:
    """Updates routing_logs rows to associate them with the persisted message_id."""
    if not log_ids:
        return
    session.query(RoutingLog).filter(RoutingLog.id.in_(log_ids)).update(
        {"message_id": message_id}, synchronize_session=False
    )
    session.commit()


def get_dashboard_stats(session: Session) -> dict:
    """Calculates aggregated performance and routing metrics."""
    total_requests = session.query(func.count(RoutingLog.id)).scalar() or 0

    success_count = (
        session.query(func.count(RoutingLog.id))
        .filter(RoutingLog.status == "success")
        .scalar()
        or 0
    )
    success_rate = (
        round((success_count / total_requests) * 100, 1) if total_requests > 0 else 0.0
    )

    avg_latency = (
        session.query(func.avg(RoutingLog.latency_ms))
        .filter(RoutingLog.status == "success", RoutingLog.latency_ms.isnot(None))
        .scalar()
    )
    avg_latency_ms = round(float(avg_latency), 1) if avg_latency is not None else 0.0

    total_fallbacks = (
        session.query(func.count(Message.id))
        .filter(Message.fallback_count > 0)
        .scalar()
        or 0
    )

    # Per-model performance breakdown
    model_rows = (
        session.query(
            RoutingLog.model_slug,
            func.count(RoutingLog.id).label("total_count"),
            func.avg(case((RoutingLog.status == "success", RoutingLog.latency_ms), else_=None)).label("avg_lat"),
            func.sum(case((RoutingLog.status == "success", 1), else_=0)).label("successes"),
            func.sum(case((RoutingLog.status != "success", 1), else_=0)).label("errors"),
        )
        .group_by(RoutingLog.model_slug)
        .order_by(func.count(RoutingLog.id).desc())
        .all()
    )

    model_performance = [
        {
            "model_slug": r[0],
            "count": r[1],
            "avg_latency_ms": round(float(r[2]), 1) if r[2] is not None else 0.0,
            "success_count": int(r[3] or 0),
            "error_count": int(r[4] or 0),
        }
        for r in model_rows
    ]

    # Non-success error breakdown
    error_rows = (
        session.query(
            RoutingLog.status,
            func.count(RoutingLog.id).label("status_count"),
        )
        .filter(RoutingLog.status != "success")
        .group_by(RoutingLog.status)
        .order_by(func.count(RoutingLog.id).desc())
        .all()
    )

    error_breakdown = [
        {"status": r[0], "count": r[1]}
        for r in error_rows
    ]

    return {
        "total_requests": total_requests,
        "success_rate": success_rate,
        "avg_latency_ms": avg_latency_ms,
        "total_fallbacks": total_fallbacks,
        "model_performance": model_performance,
        "error_breakdown": error_breakdown,
    }


def get_dashboard_logs(session: Session, limit: int = 50) -> dict:
    """Returns the latest routing logs joined with message text and latest conversations."""
    query = (
        session.query(
            RoutingLog,
            Message.content.label("message_content"),
        )
        .outerjoin(Message, RoutingLog.message_id == Message.id)
        .order_by(RoutingLog.created_at.desc())
        .limit(limit)
        .all()
    )

    logs = []
    for log_entry, msg_content in query:
        logs.append({
            "id": log_entry.id,
            "message_id": log_entry.message_id,
            "conversation_id": log_entry.conversation_id,
            "model_slug": log_entry.model_slug,
            "tier": log_entry.tier,
            "status": log_entry.status,
            "error": log_entry.error,
            "latency_ms": log_entry.latency_ms,
            "attempt_num": log_entry.attempt_num,
            "created_at": log_entry.created_at.isoformat() if log_entry.created_at else None,
            "message_content": msg_content,
        })

    convs = list_conversations_with_count(session)[:20]

    return {
        "logs": logs,
        "conversations": convs,
    }
