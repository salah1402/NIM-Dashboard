import os
import tempfile
import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.models import Base
from backend.circuit_breaker import CircuitBreaker
from backend.provider import MockProvider
from backend.router import FallbackRouter


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


@pytest.fixture
def temp_db():
    """Creates a temporary SQLite file database per test."""
    tf = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tf.close()
    db_path = tf.name
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    yield {
        "engine": engine,
        "session_factory": session_factory,
        "db_path": db_path,
    }

    engine.dispose()
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except OSError:
            pass


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
