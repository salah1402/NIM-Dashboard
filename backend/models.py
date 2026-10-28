from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, index=True)
    title = Column(String(255), default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, index=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), index=True, nullable=False)
    role = Column(String(32), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    model_slug = Column(String(255), nullable=True)
    latency_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
