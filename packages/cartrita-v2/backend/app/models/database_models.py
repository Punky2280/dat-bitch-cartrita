"""
SQLAlchemy database models for Cartrita.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, DeclarativeBase

class Base(DeclarativeBase):
    pass

class ChatSession(Base):
    """Chat session model."""
    __tablename__ = "chat_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False)
    title = Column(String(500))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    file_attachments = relationship("FileAttachment", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    """Chat message model."""
    __tablename__ = "chat_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String(50), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    session = relationship("ChatSession", back_populates="messages")
    file_attachments = relationship("FileAttachment", back_populates="message", cascade="all, delete-orphan")
    transcripts = relationship("TranscriptSegment", back_populates="message", cascade="all, delete-orphan")

class FileAttachment(Base):
    """File attachment model."""
    __tablename__ = "file_attachments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    message_id = Column(UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    content_type = Column(String(200), nullable=False)
    size = Column(Integer, nullable=False)
    hash = Column(String(64), nullable=False)  # SHA-256
    url = Column(String(1000), nullable=False)
    scan_status = Column(String(50), nullable=False, default='pending')  # pending, passed, failed
    scan_result = Column(Text)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    session = relationship("ChatSession", back_populates="file_attachments")
    message = relationship("ChatMessage", back_populates="file_attachments")

class TranscriptSegment(Base):
    """Voice transcript segment model."""
    __tablename__ = "transcript_segments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    message_id = Column(UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=True)
    sequence_number = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    is_final = Column(Boolean, nullable=False, default=False)
    confidence = Column(String(10))  # Store as string to handle various confidence formats
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    message = relationship("ChatMessage", back_populates="transcripts")