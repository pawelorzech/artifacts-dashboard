"""Character logs and analytics API router."""

import logging
from typing import Any

from fastapi import APIRouter, Query, Request
from sqlalchemy import select

from app.database import async_session_factory
from app.models.automation import AutomationConfig, AutomationLog, AutomationRun
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("/")
async def get_logs(
    character: str = Query(default="", description="Character name to filter logs"),
    limit: int = Query(default=50, ge=1, le=200, description="Max entries to return"),
) -> dict[str, Any]:
    """Get automation action logs from the database.

    Joins automation_logs -> automation_runs -> automation_configs
    to include character_name with each log entry.
    """
    async with async_session_factory() as db:
        stmt = (
            select(
                AutomationLog.id,
                AutomationLog.action_type,
                AutomationLog.details,
                AutomationLog.success,
                AutomationLog.created_at,
                AutomationConfig.character_name,
            )
            .join(AutomationRun, AutomationLog.run_id == AutomationRun.id)
            .join(AutomationConfig, AutomationRun.config_id == AutomationConfig.id)
            .order_by(AutomationLog.created_at.desc())
            .limit(limit)
        )

        if character:
            stmt = stmt.where(AutomationConfig.character_name == character)

        result = await db.execute(stmt)
        rows = result.all()

    return {
        "logs": [
            {
                "id": row.id,
                "character_name": row.character_name,
                "action_type": row.action_type,
                "details": row.details,
                "success": row.success,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ],
    }


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
