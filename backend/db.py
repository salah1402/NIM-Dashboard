from pathlib import Path
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from backend.models import Base

# Path to database file: ./data/nim.db
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "nim.db"

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db(target_engine=None):
    use_engine = target_engine or engine
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=use_engine)

    # Ensure fallback_count exists in messages table if table was created in Phase 1
    with use_engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(messages)"))
        columns = [row[1] for row in result.fetchall()]
        if columns and "fallback_count" not in columns:
            conn.execute(text("ALTER TABLE messages ADD COLUMN fallback_count INTEGER DEFAULT 0"))
            conn.commit()
        if columns and "image_url" not in columns:
            conn.execute(text("ALTER TABLE messages ADD COLUMN image_url TEXT"))
            conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
