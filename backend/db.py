import os
import logging
from typing import Any, Dict, Optional, List
import pymongo
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Ensure MONGO_URI is checked
MONGO_URI = os.getenv("MONGO_URI")

client: Optional[MongoClient] = None
db = None
conversations = None
messages = None
routing_logs = None


def get_client() -> MongoClient:
    """Returns or lazily creates the MongoDB client."""
    global client
    if client is None:
        uri = os.environ.get("MONGO_URI")
        if not uri:
            raise RuntimeError("MONGO_URI environment variable is required")
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    return client


def get_default_db():
    """Returns or initializes the default 'nim_dashboard' database."""
    global db, client
    if db is None:
        c = get_client()
        db = c.nim_dashboard
    return db


def init_db(target_db=None):
    """Initializes MongoDB database and collections with indexes."""
    global db, client, conversations, messages, routing_logs

    if "MONGO_URI" not in os.environ or not os.environ["MONGO_URI"]:
        raise RuntimeError("MONGO_URI environment variable is required")

    if target_db is not None:
        db = target_db
    else:
        db = get_default_db()

    # Ping cluster to verify connection
    try:
        if hasattr(db, "client") and hasattr(db.client, "admin"):
            db.client.admin.command("ping")
        logger.info("Connected to MongoDB")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        if "bad auth" in str(e).lower() or "<db_username>" in os.environ.get("MONGO_URI", ""):
            logger.warning(
                "Authentication failed: Please replace <db_username> and <db_password> in .env with your MongoDB Atlas database user credentials."
            )
            if "<db_username>" in os.environ.get("MONGO_URI", ""):
                logger.warning("Using in-memory mongomock database until valid Atlas credentials are provided in .env")
                import mongomock
                mock_client = mongomock.MongoClient()
                db = mock_client.nim_dashboard
                logger.info("Connected to MongoDB")
            else:
                raise
        else:
            raise

    conversations = db.conversations
    messages = db.messages
    routing_logs = db.routing_logs

    # Create collection indexes
    try:
        conversations.create_index([("updated_at", -1)])
        messages.create_index([("conversation_id", 1), ("created_at", 1)])
        routing_logs.create_index([("created_at", -1)])
        routing_logs.create_index([("model_slug", 1), ("created_at", -1)])
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")

    return db


def get_db():
    """FastAPI dependency yielding the MongoDB database."""
    return get_default_db()


class MongoSessionContext:
    """Context manager replacing SQLAlchemy SessionLocal for MongoDB operations."""

    def __init__(self, target_db=None):
        self.db = target_db or get_default_db()

    def __enter__(self):
        return self.db

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


def SessionLocal(target_db=None):
    """Factory returning MongoSessionContext for with SessionLocal() blocks."""
    return MongoSessionContext(target_db)


def serialize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Maps MongoDB _id to string id and ensures all ObjectId instances are strings."""
    if doc is None:
        return None
    d = dict(doc)
    if "_id" in d:
        oid_str = str(d["_id"])
        if "id" not in d or not d["id"]:
            d["id"] = oid_str
        d["_id"] = oid_str
    elif "id" in d and "_id" not in d:
        d["_id"] = str(d["id"])
    return d


def serialize_docs(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Serializes a list of MongoDB documents into JSON-safe dictionaries."""
    return [serialize_doc(d) for d in docs if d is not None]
