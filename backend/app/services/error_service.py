"""Error logging service - writes errors to the database and optionally to Sentry."""

from __future__ import annotations

import hashlib
import logging
import traceback
import uuid
from contextvars import ContextVar
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.app_error import AppError

logger = logging.getLogger(__name__)

# Per-request correlation ID
correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)


def hash_token(token: str) -> str:
    """Return a stable SHA-256 hex digest for a user API token."""
    return hashlib.sha256(token.encode()).hexdigest()


def new_correlation_id() -> str:
    cid = uuid.uuid4().hex[:12]
    correlation_id_var.set(cid)
    return cid


async def log_error(
    db_factory: async_sessionmaker[AsyncSession],
    *,
    severity: str = "error",
    source: str = "backend",
    error_type: str = "UnknownError",
    message: str = "",
    exc: BaseException | None = None,
    context: dict[str, Any] | None = None,
    correlation_id: str | None = None,
    user_token_hash: str | None = None,
) -> AppError | None:
    """Persist an error record to the database.

    Returns the created AppError, or None if the DB write itself fails.
    """
    stack_trace = None
    if exc is not None:
        stack_trace = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        if not error_type or error_type == "UnknownError":
            error_type = type(exc).__qualname__
        if not message:
            message = str(exc)

    cid = correlation_id or correlation_id_var.get()

    try:
        async with db_factory() as db:
            record = AppError(
                severity=severity,
                source=source,
                error_type=error_type,
                message=message[:4000],
                stack_trace=stack_trace[:10000] if stack_trace else None,
                context=context,
                correlation_id=cid,
                user_token_hash=user_token_hash,
            )
            db.add(record)
            await db.commit()
            await db.refresh(record)
            return record
    except Exception:
        logger.exception("Failed to persist error record to database")
        return None
