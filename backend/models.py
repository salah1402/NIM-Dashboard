from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Text,
    ForeignKey,
    Index,
    CheckConstraint,
    func,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True)
    title = Column(Text, nullable=False, default="New chat")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True)
    conversation_id = Column(
        String(36),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(String(32), nullable=False)
    content = Column(Text, nullable=False)
    model_slug = Column(Text, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    fallback_count = Column(Integer, nullable=True, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    conversation = relationship("Conversation", back_populates="messages")
    routing_logs = relationship(
        "RoutingLog",
        back_populates="message",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("ix_messages_conversation_id_created_at", "conversation_id", "created_at"),
        CheckConstraint("role IN ('user', 'assistant', 'system')", name="ck_messages_role"),
    )


class RoutingLog(Base):
    __tablename__ = "routing_logs"

    id = Column(String(36), primary_key=True)
    message_id = Column(
        String(36),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    conversation_id = Column(String(36), nullable=True)
    model_slug = Column(Text, nullable=False)
    tier = Column(Text, nullable=False)
    status = Column(Text, nullable=False)
    error = Column(Text, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    attempt_num = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    message = relationship("Message", back_populates="routing_logs")

    __table_args__ = (
        Index("ix_routing_logs_created_at", "created_at"),
        Index("ix_routing_logs_model_slug_created_at", "model_slug", "created_at"),
        CheckConstraint(
            "status IN ('success','rate_limited','dead_model','server_error','timeout','connection_error','skipped_circuit_open')",
            name="ck_routing_logs_status",
        ),
    )
