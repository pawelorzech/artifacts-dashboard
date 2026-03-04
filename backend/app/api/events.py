"""Game events API router."""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from httpx import HTTPStatusError
from sqlalchemy import select

from app.api.deps import get_user_client
from app.database import async_session_factory
from app.models.event_log import EventLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("/")
async def get_active_events(request: Request) -> dict[str, Any]:
    """Get currently active game events from the Artifacts API."""
    client = get_user_client(request)

    try:
        events = await client.get_active_events()
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc

    return {"events": events}


@router.get("/history")
async def get_event_history(
    request: Request,
    event_type: str | None = Query(default=None, description="Filter by event type"),
    character_name: str | None = Query(default=None, description="Filter by character"),
    limit: int = Query(default=100, ge=1, le=500, description="Max entries to return"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
) -> dict[str, Any]:
    """Get historical events from the event log database."""
    async with async_session_factory() as db:
        stmt = select(EventLog).order_by(EventLog.created_at.desc())

        if event_type:
            stmt = stmt.where(EventLog.event_type == event_type)
        if character_name:
            stmt = stmt.where(EventLog.character_name == character_name)

        stmt = stmt.offset(offset).limit(limit)

        result = await db.execute(stmt)
        logs = result.scalars().all()

        return {
            "events": [
                {
                    "id": log.id,
                    "event_type": log.event_type,
                    "event_data": log.event_data,
                    "character_name": log.character_name,
                    "map_x": log.map_x,
                    "map_y": log.map_y,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in logs
            ],
            "limit": limit,
            "offset": offset,
        }
