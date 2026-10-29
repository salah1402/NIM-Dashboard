import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from backend.models import Conversation, Message, RoutingLog
from backend.db import get_default_db, serialize_doc, serialize_docs, SessionLocal


def get_target_db(db_or_session=None):
    """Resolves target MongoDB database from argument or default connection."""
    if db_or_session is not None:
        if hasattr(db_or_session, "conversations"):
            return db_or_session
        if hasattr(db_or_session, "db") and hasattr(db_or_session.db, "conversations"):
            return db_or_session.db
    return get_default_db()


def create_conversation(
    session=None,
    title: Optional[str] = None,
    db=None,
    conversation_id: Optional[str] = None,
) -> Conversation:
    """Creates a new conversation document in MongoDB."""
    target_db = get_target_db(session or db)
    now_iso = datetime.now(timezone.utc).isoformat()
    conv_id = (conversation_id.strip() if conversation_id and str(conversation_id).strip() else str(uuid.uuid4()))
    doc = {
        "_id": conv_id,
        "id": conv_id,
        "title": (title.strip() if title and title.strip() else "New chat"),
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    target_db.conversations.insert_one(doc)
    return Conversation(serialize_doc(doc))


def list_conversations(session=None, db=None) -> List[Conversation]:
    """Lists conversations ordered by updated_at descending."""
    target_db = get_target_db(session or db)
    cursor = target_db.conversations.find().sort("updated_at", -1)
    return [Conversation(serialize_doc(c)) for c in cursor]


def list_conversations_with_count(session=None, db=None) -> List[dict]:
    """Lists conversations with calculated message counts."""
    target_db = get_target_db(session or db)
    convs = list(target_db.conversations.find().sort("updated_at", -1))
    if not convs:
        return []

    # Aggregate message counts grouped by conversation_id
    pipeline = [{"$group": {"_id": "$conversation_id", "count": {"$sum": 1}}}]
    counts_map = {}
    try:
        for row in target_db.messages.aggregate(pipeline):
            counts_map[str(row["_id"])] = row.get("count", 0)
    except Exception:
        # Fallback if messages empty
        pass

    result = []
    for c in convs:
        cid = str(c.get("id") or c.get("_id"))
        result.append({
            "id": cid,
            "title": c.get("title", "New chat"),
            "created_at": c.get("created_at"),
            "updated_at": c.get("updated_at"),
            "message_count": counts_map.get(cid, 0),
        })
    return result


def get_conversation(
    session=None,
    conversation_id: str = None,
    db=None,
) -> Optional[Conversation]:
    """Retrieves conversation by id or _id."""
    if not conversation_id:
        return None
    target_db = get_target_db(session or db)
    doc = target_db.conversations.find_one({"$or": [{"id": conversation_id}, {"_id": conversation_id}]})
    return Conversation(serialize_doc(doc)) if doc else None


def update_conversation_title(
    session=None,
    conversation_id: str = None,
    title: str = "",
    db=None,
) -> Optional[Conversation]:
    """Updates the title of a conversation document."""
    if not conversation_id:
        return None
    target_db = get_target_db(session or db)
    now_iso = datetime.now(timezone.utc).isoformat()
    target_db.conversations.update_one(
        {"$or": [{"id": conversation_id}, {"_id": conversation_id}]},
        {"$set": {"title": title, "updated_at": now_iso}},
    )
    return get_conversation(target_db, conversation_id)


def list_messages(
    session=None,
    conversation_id: str = None,
    db=None,
) -> List[Message]:
    """Lists messages for a conversation ordered by created_at ascending."""
    if not conversation_id:
        return []
    target_db = get_target_db(session or db)
    cursor = target_db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1)
    return [Message(serialize_doc(m)) for m in cursor]


def add_message(
    session=None,
    conversation_id: str = None,
    role: str = "user",
    content: str = "",
    model_slug: Optional[str] = None,
    latency_ms: Optional[float] = None,
    fallback_count: Optional[int] = 0,
    image_url: Optional[str] = None,
    db=None,
) -> Message:
    """Inserts a new message document into MongoDB."""
    target_db = get_target_db(session or db)
    latency_int = int(round(latency_ms)) if latency_ms is not None else None
    msg_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "_id": msg_id,
        "id": msg_id,
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "image_url": image_url,
        "model_slug": model_slug,
        "latency_ms": latency_int,
        "fallback_count": fallback_count or 0,
        "created_at": now_iso,
    }
    target_db.messages.insert_one(doc)
    return Message(serialize_doc(doc))


def touch_conversation(
    session=None,
    conversation_id: str = None,
    db=None,
) -> Optional[Conversation]:
    """Updates updated_at on the conversation document."""
    if not conversation_id:
        return None
    target_db = get_target_db(session or db)
    now_iso = datetime.now(timezone.utc).isoformat()
    target_db.conversations.update_one(
        {"$or": [{"id": conversation_id}, {"_id": conversation_id}]},
        {"$set": {"updated_at": now_iso}},
    )
    return get_conversation(target_db, conversation_id)


def delete_conversation(
    session=None,
    conversation_id: str = None,
    db=None,
) -> bool:
    """Deletes conversation and cascading messages and logs."""
    if not conversation_id:
        return False
    target_db = get_target_db(session or db)
    res = target_db.conversations.delete_one({"$or": [{"id": conversation_id}, {"_id": conversation_id}]})
    if res.deleted_count > 0:
        target_db.messages.delete_many({"conversation_id": conversation_id})
        target_db.routing_logs.delete_many({"conversation_id": conversation_id})
        return True
    return False


def reconcile_interrupted_conversations(session=None, db=None) -> int:
    """Appends fallback failure response to any in-flight conversation whose last message is user."""
    target_db = get_target_db(session or db)
    conversations = list_conversations(target_db)
    reconciled_count = 0
    for conv in conversations:
        msgs = list_messages(target_db, conv.id)
        if msgs and msgs[-1].role == "user":
            add_message(
                session=target_db,
                conversation_id=conv.id,
                role="assistant",
                content="⚠️ Response failed: Server interrupted during generation",
                model_slug="meta/llama-3.1-8b-instruct",
                latency_ms=None,
                fallback_count=0,
            )
            touch_conversation(target_db, conv.id)
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
    session=None,
    session_factory=None,
    db=None,
) -> RoutingLog:
    """Logs a single cascade routing attempt in the routing_logs collection."""
    target_db = get_target_db(session or db or (session_factory() if callable(session_factory) else session_factory))
    log_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "_id": log_id,
        "id": log_id,
        "message_id": message_id,
        "conversation_id": conversation_id,
        "model_slug": model_slug,
        "tier": tier,
        "status": status,
        "error": error,
        "latency_ms": latency_ms,
        "attempt_num": attempt_num,
        "created_at": now_iso,
    }
    target_db.routing_logs.insert_one(doc)
    return RoutingLog(serialize_doc(doc))


def link_routing_logs_to_message(
    session=None,
    log_ids: List[str] = None,
    message_id: str = None,
    db=None,
) -> None:
    """Updates routing_logs entries to link them with a message_id."""
    if not log_ids or not message_id:
        return
    target_db = get_target_db(session or db)
    target_db.routing_logs.update_many(
        {"$or": [{"id": {"$in": log_ids}}, {"_id": {"$in": log_ids}}]},
        {"$set": {"message_id": message_id}},
    )


def get_dashboard_stats(session=None, db=None) -> dict:
    """Calculates aggregated performance and routing metrics using MongoDB Aggregation Pipelines."""
    target_db = get_target_db(session or db)

    total_requests = target_db.routing_logs.count_documents({})
    success_count = target_db.routing_logs.count_documents({"status": "success"})
    success_rate = (
        round((success_count / total_requests) * 100, 1) if total_requests > 0 else 0.0
    )

    # Average latency across successful requests
    avg_lat_pipe = [
        {"$match": {"status": "success", "latency_ms": {"$ne": None, "$exists": True}}},
        {"$group": {"_id": None, "avg_latency": {"$avg": "$latency_ms"}}},
    ]
    avg_lat_res = list(target_db.routing_logs.aggregate(avg_lat_pipe))
    avg_latency_ms = (
        round(float(avg_lat_res[0]["avg_latency"]), 1)
        if avg_lat_res and avg_lat_res[0].get("avg_latency") is not None
        else 0.0
    )

    total_fallbacks = target_db.messages.count_documents({"fallback_count": {"$gt": 0}})

    # Model performance aggregation pipeline
    model_perf_pipe = [
        {
            "$group": {
                "_id": "$model_slug",
                "count": {"$sum": 1},
                "avg_latency_ms": {
                    "$avg": {
                        "$cond": [{"$eq": ["$status", "success"]}, "$latency_ms", None]
                    }
                },
                "success_count": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", "success"]}, 1, 0]
                    }
                },
                "error_count": {
                    "$sum": {
                        "$cond": [{"$ne": ["$status", "success"]}, 1, 0]
                    }
                },
            }
        },
        {"$sort": {"count": -1}},
    ]
    model_rows = list(target_db.routing_logs.aggregate(model_perf_pipe))
    model_performance = [
        {
            "model_slug": r["_id"],
            "count": r["count"],
            "avg_latency_ms": (
                round(float(r["avg_latency_ms"]), 1)
                if r.get("avg_latency_ms") is not None
                else 0.0
            ),
            "success_count": int(r.get("success_count", 0)),
            "error_count": int(r.get("error_count", 0)),
        }
        for r in model_rows
        if r.get("_id") is not None
    ]

    # Non-success error breakdown aggregation pipeline
    error_pipe = [
        {"$match": {"status": {"$ne": "success"}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    error_rows = list(target_db.routing_logs.aggregate(error_pipe))
    error_breakdown = [
        {"status": r["_id"], "count": r["count"]}
        for r in error_rows
        if r.get("_id") is not None
    ]

    return {
        "total_requests": total_requests,
        "success_rate": success_rate,
        "avg_latency_ms": avg_latency_ms,
        "total_fallbacks": total_fallbacks,
        "model_performance": model_performance,
        "error_breakdown": error_breakdown,
    }


def get_dashboard_logs(session=None, limit: int = 50, db=None) -> dict:
    """Returns the latest routing logs sorted by created_at descending with associated message text."""
    target_db = get_target_db(session or db)
    cursor = target_db.routing_logs.find().sort("created_at", -1).limit(limit)
    logs_raw = [serialize_doc(l) for l in cursor]

    # Collect message ids for batch lookup
    msg_ids = [l.get("message_id") for l in logs_raw if l.get("message_id")]
    msgs_map = {}
    if msg_ids:
        msg_cursor = target_db.messages.find({
            "$or": [{"id": {"$in": msg_ids}}, {"_id": {"$in": msg_ids}}]
        })
        for m in msg_cursor:
            mid = str(m.get("id") or m.get("_id"))
            msgs_map[mid] = m.get("content")

    logs = []
    for l in logs_raw:
        mid = l.get("message_id")
        logs.append({
            "id": str(l.get("id") or l.get("_id")),
            "message_id": mid,
            "conversation_id": l.get("conversation_id"),
            "model_slug": l.get("model_slug"),
            "tier": l.get("tier"),
            "status": l.get("status"),
            "error": l.get("error"),
            "latency_ms": l.get("latency_ms"),
            "attempt_num": l.get("attempt_num"),
            "created_at": l.get("created_at"),
            "message_content": msgs_map.get(mid),
        })

    convs = list_conversations_with_count(target_db)[:20]

    return {
        "logs": logs,
        "conversations": convs,
    }
