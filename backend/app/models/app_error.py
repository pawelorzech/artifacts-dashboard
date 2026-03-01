"""Application error model for tracking errors across the system."""

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.sql import func

from app.database import Base


class AppError(Base):
    __tablename__ = "app_errors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    severity = Column(
        String(20),
        nullable=False,
        default="error",
        comment="error | warning | critical",
    )
    source = Column(
        String(50),
        nullable=False,
        comment="backend | frontend | automation | middleware",
    )
    error_type = Column(
        String(200),
        nullable=False,
        comment="Exception class name or error category",
    )
    message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    context = Column(JSON, nullable=True, comment="Arbitrary JSON context")
    user_token_hash = Column(
        String(64),
        nullable=True,
        index=True,
        comment="SHA-256 hash of the user API token (for scoping errors per user)",
    )
    correlation_id = Column(
        String(36),
        nullable=True,
        index=True,
        comment="Request correlation ID (UUID)",
    )
    resolved = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
