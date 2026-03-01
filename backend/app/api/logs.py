"""Character logs and analytics API router."""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from httpx import HTTPStatusError

from app.database import async_session_factory
from app.services.analytics_service import AnalyticsService
from app.services.artifacts_client import ArtifactsClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/logs", tags=["logs"])


def _get_client(request: Request) -> ArtifactsClient:
    return request.app.state.artifacts_client


@router.get("/")
async def get_character_logs(
    request: Request,
    character: str = Query(default="", description="Character name to filter logs"),
    limit: int = Query(default=50, ge=1, le=200, description="Max entries to return"),
) -> dict[str, Any]:
    """Get character action logs from the Artifacts API.

    This endpoint retrieves the character's recent action logs directly
    from the game server.
    """
    client = _get_client(request)

    try:
        if character:
            # Get logs for a specific character
            char_data = await client.get_character(character)
            return {
                "character": character,
                "logs": [],  # The API doesn't have a dedicated logs endpoint per character;
                             # action data comes from the automation logs in our DB
                "character_data": {
                    "name": char_data.name,
                    "level": char_data.level,
                    "xp": char_data.xp,
                    "gold": char_data.gold,
                    "x": char_data.x,
                    "y": char_data.y,
                    "task": char_data.task,
                    "task_progress": char_data.task_progress,
                    "task_total": char_data.task_total,
                },
            }
        else:
            # Get all characters as a summary
            characters = await client.get_characters()
            return {
                "characters": [
                    {
                        "name": c.name,
                        "level": c.level,
                        "xp": c.xp,
                        "gold": c.gold,
                        "x": c.x,
                        "y": c.y,
                    }
                    for c in characters
                ],
            }
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc


@router.get("/analytics")
async def get_analytics(
    request: Request,
    character: str = Query(default="", description="Character name (empty for all)"),
    hours: int = Query(default=24, ge=1, le=168, description="Hours of history"),
) -> dict[str, Any]:
    """Get analytics aggregations for a character.

    Returns XP history, gold history, and estimated actions per hour.
    If no character is specified, aggregates across all characters with snapshots.
    """
    analytics = AnalyticsService()

    async with async_session_factory() as db:
        if character:
            characters = [character]
        else:
            characters = await analytics.get_tracked_characters(db)

        all_xp: list[dict[str, Any]] = []
        all_gold: list[dict[str, Any]] = []
        total_actions_per_hour = 0.0

        for char_name in characters:
            xp_history = await analytics.get_xp_history(db, char_name, hours)
            gold_history = await analytics.get_gold_history(db, char_name, hours)
            actions_rate = await analytics.get_actions_per_hour(db, char_name)

            # Transform xp_history to TimeSeriesPoint format
            for point in xp_history:
                all_xp.append({
                    "timestamp": point["timestamp"],
                    "value": point["xp"],
                    "label": f"{char_name} XP" if not character else "XP",
                })

            # Transform gold_history to TimeSeriesPoint format
            for point in gold_history:
                all_gold.append({
                    "timestamp": point["timestamp"],
                    "value": point["gold"],
                    "label": char_name if not character else None,
                })

            total_actions_per_hour += actions_rate.get("estimated_actions_per_hour", 0)

    # Sort by timestamp
    all_xp.sort(key=lambda p: p["timestamp"] or "")
    all_gold.sort(key=lambda p: p["timestamp"] or "")

    return {
        "xp_history": all_xp,
        "gold_history": all_gold,
        "actions_per_hour": round(total_actions_per_hour, 1),
    }
