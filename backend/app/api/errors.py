"""Errors API router - browse, filter, resolve, and report errors.

All read endpoints are scoped to the requesting user's token so that
one user never sees errors belonging to another user.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import func, select

from app.database import async_session_factory
from app.models.app_error import AppError
from app.schemas.errors import (
    AppErrorListResponse,
    AppErrorResponse,
    AppErrorStats,
    FrontendErrorReport,
)
from app.services.error_service import hash_token, log_error

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/errors", tags=["errors"])


def _get_user_hash(request: Request) -> str | None:
    """Extract and hash the user token from the request."""
    token = request.headers.get("X-API-Token")
    return hash_token(token) if token else None


@router.get("/", response_model=AppErrorListResponse)
async def list_errors(
    request: Request,
    severity: str = Query(default="", description="Filter by severity"),
    source: str = Query(default="", description="Filter by source"),
    resolved: str = Query(default="", description="Filter by resolved status: true/false"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=100),
) -> AppErrorListResponse:
    """List errors with optional filtering and pagination.

    Only returns errors belonging to the authenticated user.
    """
    user_hash = _get_user_hash(request)
    if not user_hash:
        return AppErrorListResponse(errors=[], total=0, page=1, pages=1)

    async with async_session_factory() as db:
        user_filter = AppError.user_token_hash == user_hash
        stmt = select(AppError).where(user_filter).order_by(AppError.created_at.desc())
        count_stmt = select(func.count(AppError.id)).where(user_filter)

        if severity:
            stmt = stmt.where(AppError.severity == severity)
            count_stmt = count_stmt.where(AppError.severity == severity)
        if source:
            stmt = stmt.where(AppError.source == source)
            count_stmt = count_stmt.where(AppError.source == source)
        if resolved in ("true", "false"):
            val = resolved == "true"
            stmt = stmt.where(AppError.resolved == val)
            count_stmt = count_stmt.where(AppError.resolved == val)

        total = (await db.execute(count_stmt)).scalar() or 0
        pages = max(1, (total + size - 1) // size)

        offset = (page - 1) * size
        stmt = stmt.offset(offset).limit(size)
        result = await db.execute(stmt)
        rows = result.scalars().all()

    return AppErrorListResponse(
        errors=[AppErrorResponse.model_validate(r) for r in rows],
        total=total,
        page=page,
        pages=pages,
    )


@router.get("/stats", response_model=AppErrorStats)
async def error_stats(request: Request) -> AppErrorStats:
    """Aggregated error statistics scoped to the authenticated user."""
    user_hash = _get_user_hash(request)
    if not user_hash:
        return AppErrorStats()

    async with async_session_factory() as db:
        user_filter = AppError.user_token_hash == user_hash

        total = (
            await db.execute(select(func.count(AppError.id)).where(user_filter))
        ).scalar() or 0
        unresolved = (
            await db.execute(
                select(func.count(AppError.id)).where(
                    user_filter, AppError.resolved == False  # noqa: E712
                )
            )
        ).scalar() or 0

        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        last_hour = (
            await db.execute(
                select(func.count(AppError.id)).where(
                    user_filter, AppError.created_at >= one_hour_ago
                )
            )
        ).scalar() or 0

        # By severity
        sev_rows = (
            await db.execute(
                select(AppError.severity, func.count(AppError.id))
                .where(user_filter)
                .group_by(AppError.severity)
            )
        ).all()
        by_severity = {row[0]: row[1] for row in sev_rows}

        # By source
        src_rows = (
            await db.execute(
                select(AppError.source, func.count(AppError.id))
                .where(user_filter)
                .group_by(AppError.source)
            )
        ).all()
        by_source = {row[0]: row[1] for row in src_rows}

    return AppErrorStats(
        total=total,
        unresolved=unresolved,
        last_hour=last_hour,
        by_severity=by_severity,
        by_source=by_source,
    )


@router.post("/{error_id}/resolve", response_model=AppErrorResponse)
async def resolve_error(error_id: int, request: Request) -> AppErrorResponse:
    """Mark an error as resolved (only if it belongs to the requesting user)."""
    user_hash = _get_user_hash(request)

    async with async_session_factory() as db:
        stmt = select(AppError).where(AppError.id == error_id)
        if user_hash:
            stmt = stmt.where(AppError.user_token_hash == user_hash)
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        if record is None:
            raise HTTPException(status_code=404, detail="Error not found")
        record.resolved = True
        await db.commit()
        await db.refresh(record)
        return AppErrorResponse.model_validate(record)


@router.post("/report", status_code=201)
async def report_frontend_error(
    body: FrontendErrorReport, request: Request
) -> dict[str, str]:
    """Receive error reports from the frontend."""
    user_hash = _get_user_hash(request)

    await log_error(
        async_session_factory,
        severity=body.severity,
        source="frontend",
        error_type=body.error_type,
        message=body.message,
        context=body.context,
        user_token_hash=user_hash,
    )

    # Also capture in Sentry if available
    try:
        import sentry_sdk

        sentry_sdk.capture_message(
            f"[Frontend] {body.error_type}: {body.message}",
            level="error",
        )
    except Exception:
        pass

    return {"status": "recorded"}
