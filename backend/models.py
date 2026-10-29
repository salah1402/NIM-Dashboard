import uuid
from datetime import datetime, timezone
from typing import Any, Optional, Dict


class ColumnAttr:
    """Descriptor allowing class-level attributes to support .asc(), .desc() for queries

    while delegating to instance dict when accessed on an instance.
    """

    def __init__(self, name: str):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.get(self.name)

    def __set__(self, instance, value):
        instance[self.name] = value

    def asc(self):
        return self.name

    def desc(self):
        return f"-{self.name}"

    def __str__(self):
        return self.name

    def __repr__(self):
        return self.name

    def __eq__(self, other):
        return (self.name, other)

    def __ne__(self, other):
        return (self.name, "$ne", other)

    def __gt__(self, other):
        return (self.name, "$gt", other)

    def isnot(self, other):
        return (self.name, "$ne", other)


class MongoDoc(dict):
    """Dict subclass providing attribute-style and dict-style access for MongoDB documents."""

    def __init__(self, *args, **kwargs):
        if args and isinstance(args[0], dict):
            super().__init__(args[0])
            self.update(kwargs)
        else:
            super().__init__(*args, **kwargs)

        if "_id" in self and ("id" not in self or not self.get("id")):
            self["id"] = str(self["_id"])
        elif "id" in self and "_id" not in self:
            self["_id"] = str(self["id"])

    def __getattr__(self, name: str) -> Any:
        try:
            return self[name]
        except KeyError:
            return None

    def __setattr__(self, name: str, value: Any) -> None:
        self[name] = value

    @property
    def id(self) -> str:
        return str(self.get("id") or self.get("_id") or "")


class Conversation(MongoDoc):
    id = ColumnAttr("id")
    title = ColumnAttr("title")
    created_at = ColumnAttr("created_at")
    updated_at = ColumnAttr("updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.setdefault("id", str(uuid.uuid4()))
        self.setdefault("_id", self["id"])
        self.setdefault("title", "New chat")
        now = datetime.now(timezone.utc).isoformat()
        self.setdefault("created_at", now)
        self.setdefault("updated_at", now)


class Message(MongoDoc):
    id = ColumnAttr("id")
    conversation_id = ColumnAttr("conversation_id")
    role = ColumnAttr("role")
    content = ColumnAttr("content")
    image_url = ColumnAttr("image_url")
    model_slug = ColumnAttr("model_slug")
    latency_ms = ColumnAttr("latency_ms")
    fallback_count = ColumnAttr("fallback_count")
    created_at = ColumnAttr("created_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.setdefault("id", str(uuid.uuid4()))
        self.setdefault("_id", self["id"])
        self.setdefault("role", "user")
        self.setdefault("content", "")
        self.setdefault("fallback_count", 0)
        self.setdefault("created_at", datetime.now(timezone.utc).isoformat())


class RoutingLog(MongoDoc):
    id = ColumnAttr("id")
    message_id = ColumnAttr("message_id")
    conversation_id = ColumnAttr("conversation_id")
    model_slug = ColumnAttr("model_slug")
    tier = ColumnAttr("tier")
    status = ColumnAttr("status")
    error = ColumnAttr("error")
    latency_ms = ColumnAttr("latency_ms")
    attempt_num = ColumnAttr("attempt_num")
    created_at = ColumnAttr("created_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.setdefault("id", str(uuid.uuid4()))
        self.setdefault("_id", self["id"])
        self.setdefault("attempt_num", 1)
        self.setdefault("created_at", datetime.now(timezone.utc).isoformat())
