import os
import uuid
import pytest
import mongomock

from backend.models import Conversation, Message, RoutingLog
from backend.circuit_breaker import CircuitBreaker
from backend.provider import MockProvider
from backend.router import FallbackRouter
from backend.db import serialize_doc
import backend.db
import backend.main


DEFAULT_TEST_TIERS = {
    "tier1": [
        "meta/llama-4-maverick-17b-128e-instruct",
        "meta/llama-3.1-8b-instruct",
    ],
    "tier2": [
        "nvidia/llama-3.3-nemotron-super-49b-v1",
        "openai/gpt-oss-120b",
    ],
    "tier3": [
        "meta/llama-3.1-70b-instruct",
    ],
}

DEFAULT_TEST_EXCLUDE = {
    "qwen/qwen3-235b-a22b",
    "deepseek-ai/deepseek-r1",
}


class MockQuery:
    def __init__(self, collection, model_cls):
        self.collection = collection
        self.model_cls = model_cls
        self._filter = {}
        self._sort = None

    def filter(self, *expressions):
        for expr in expressions:
            if isinstance(expr, tuple):
                if len(expr) == 2:
                    k, v = expr
                    self._filter[k] = v
                elif len(expr) == 3:
                    k, op, v = expr
                    if op == "$ne":
                        self._filter[k] = {"$ne": v}
                    elif op == "$gt":
                        self._filter[k] = {"$gt": v}
            elif isinstance(expr, dict):
                self._filter.update(expr)
        return self

    def order_by(self, *order_exprs):
        if order_exprs:
            expr_str = str(order_exprs[0]).lower()
            if "attempt_num" in expr_str:
                self._sort = ("attempt_num", 1)
            elif "created_at" in expr_str:
                self._sort = ("created_at", -1 if "desc" in expr_str else 1)
        return self

    def all(self):
        cursor = self.collection.find(self._filter)
        if self._sort:
            cursor = cursor.sort(self._sort[0], self._sort[1])
        return [self.model_cls(serialize_doc(d)) for d in cursor]

    def first(self):
        res = self.all()
        return res[0] if res else None

    def scalar(self):
        return len(self.all())


class MockSession:
    def __init__(self, db):
        self.db = db

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def close(self):
        pass

    def commit(self):
        pass

    def flush(self):
        pass

    def refresh(self, obj):
        pass

    def add(self, obj):
        doc = dict(obj) if isinstance(obj, dict) else dict(obj.__dict__)
        doc_id = doc.get("id") or doc.get("_id") or str(uuid.uuid4())
        doc["_id"] = doc_id
        doc["id"] = doc_id
        if isinstance(obj, Conversation) or ("title" in doc and "role" not in doc):
            self.db.conversations.replace_one({"_id": doc_id}, doc, upsert=True)
        elif isinstance(obj, Message) or ("content" in doc and "attempt_num" not in doc):
            self.db.messages.replace_one({"_id": doc_id}, doc, upsert=True)
        else:
            self.db.routing_logs.replace_one({"_id": doc_id}, doc, upsert=True)

    def add_all(self, objs):
        for o in objs:
            self.add(o)

    def query(self, model_cls):
        if model_cls == Conversation:
            return MockQuery(self.db.conversations, Conversation)
        elif model_cls == Message:
            return MockQuery(self.db.messages, Message)
        elif model_cls == RoutingLog:
            return MockQuery(self.db.routing_logs, RoutingLog)
        return MockQuery(self.db.routing_logs, model_cls)


@pytest.fixture(autouse=True)
def mock_mongo_globally(monkeypatch):
    """Automatically patch MongoDB with mongomock for all tests so pytest never hits cloud database."""
    mock_client = mongomock.MongoClient()
    test_db = mock_client.nim_dashboard

    # Ensure collections exist
    _ = test_db.conversations
    _ = test_db.messages
    _ = test_db.routing_logs

    # Patch backend.db globals
    monkeypatch.setattr(backend.db, "client", mock_client)
    monkeypatch.setattr(backend.db, "db", test_db)
    monkeypatch.setattr(backend.db, "conversations", test_db.conversations)
    monkeypatch.setattr(backend.db, "messages", test_db.messages)
    monkeypatch.setattr(backend.db, "routing_logs", test_db.routing_logs)
    monkeypatch.setattr(backend.db, "get_client", lambda: mock_client)
    monkeypatch.setattr(backend.db, "get_default_db", lambda: test_db)
    monkeypatch.setattr(backend.db, "get_db", lambda: test_db)

    def _session_local(target_db=None):
        return MockSession(target_db or test_db)

    monkeypatch.setattr(backend.db, "SessionLocal", _session_local)

    # Patch router default session_factory if present
    if hasattr(backend.main, "router") and backend.main.router:
        monkeypatch.setattr(backend.main.router, "session_factory", lambda: MockSession(test_db))

    return test_db


@pytest.fixture
def temp_db(mock_mongo_globally):
    """Returns test db and session factory for tests declaring temp_db."""
    test_db = mock_mongo_globally

    def session_factory():
        return MockSession(test_db)

    return {
        "client": test_db.client,
        "db": test_db,
        "session_factory": session_factory,
    }


@pytest.fixture
def router_builder(temp_db):
    """Factory fixture to create FallbackRouter instances with configured MockProvider."""
    def _builder(fail_plan=None, tiers=None, exclude=None, breaker=None):
        provider = MockProvider(fail_plan=fail_plan)
        cb = breaker or CircuitBreaker()
        t = tiers or DEFAULT_TEST_TIERS
        ex = exclude if exclude is not None else DEFAULT_TEST_EXCLUDE
        router = FallbackRouter(
            provider=provider,
            breaker=cb,
            tiers=t,
            exclude=ex,
            session_factory=temp_db["session_factory"],
        )
        return router, provider, cb, temp_db["session_factory"]

    return _builder
