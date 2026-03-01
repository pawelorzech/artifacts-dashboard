"""Character logs and analytics API router."""

import logging
from typing import Any

from fastapi import APIRouter, Query, Request
from sqlalchemy import select

from app.api.deps import get_user_character_names, get_user_client
from app.database import async_session_factory
from app.models.automation import AutomationConfig, AutomationLog, AutomationRun
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("/")
async def get_logs(
    request: Request,
    character: str = Query(default="", description="Character name to filter logs"),
    type: str = Query(default="", description="Action type to filter (e.g. fight, gathering)"),
    page: int = Query(default=1, ge=1, description="Page number"),
    size: int = Query(default=50, ge=1, le=100, description="Page size"),
) -> dict[str, Any]:
    """Get action logs from the Artifacts game API.

    Fetches the last 5000 character actions directly from the game server.
    Falls back to local automation logs if the game API is unavailable.
    """
    client = get_user_client(request)

    try:
        if character:
            result = await client.get_character_logs(character, page=page, size=size)
        else:
            result = await client.get_logs(page=page, size=size)

        raw_logs = result.get("data", [])
        total = result.get("total", 0)
        pages = result.get("pages", 1)

        # Filter by type if specified
        if type:
            raw_logs = [log for log in raw_logs if log.get("type") == type]

        logs = []
        for entry in raw_logs:
            content = entry.get("content", {})
            action_type = entry.get("type", "unknown")

            # Build details - description is the main human-readable field
            details: dict[str, Any] = {}
            description = entry.get("description", "")
            if description:
                details["description"] = description

            # Extract structured data per action type
            if "fight" in content:
                fight = content["fight"]
                details["monster"] = fight.get("opponent", "")
                details["result"] = fight.get("result", "")
                details["turns"] = fight.get("turns", 0)

            if "gathering" in content:
                g = content["gathering"]
                details["resource"] = g.get("resource", "")
                details["skill"] = g.get("skill", "")
                details["xp"] = g.get("xp_gained", 0)

            if "drops" in content:
                items = content["drops"].get("items", [])
                if items:
                    details["drops"] = [
                        f"{i.get('quantity', 1)}x {i.get('code', '?')}" for i in items
                    ]

            if "map" in content:
                m = content["map"]
                details["x"] = m.get("x")
                details["y"] = m.get("y")
                details["map_name"] = m.get("name", "")

            if "crafting" in content:
                c = content["crafting"]
                details["item"] = c.get("code", "")
                details["skill"] = c.get("skill", "")
                details["xp"] = c.get("xp_gained", 0)

            if "hp_restored" in content:
                details["hp_restored"] = content["hp_restored"]

            logs.append({
                "id": hash(f"{entry.get('character', '')}-{entry.get('created_at', '')}") & 0x7FFFFFFF,
                "character_name": entry.get("character", ""),
                "action_type": action_type,
                "details": details,
                "success": True,
                "created_at": entry.get("created_at", ""),
                "cooldown": entry.get("cooldown", 0),
            })

        return {
            "logs": logs,
            "total": total,
            "page": page,
            "pages": pages,
        }

    except Exception:
        logger.warning("Failed to fetch logs from game API, falling back to local DB", exc_info=True)
        user_chars = await get_user_character_names(request)
        return await _get_local_logs(character, type, page, size, user_chars)


async def _get_local_logs(
    character: str,
    type: str,
    page: int,
    size: int,
    user_characters: list[str] | None = None,
) -> dict[str, Any]:
    """Fallback: get automation logs from local database."""
    offset = (page - 1) * size

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
        )

        # Scope to the current user's characters
        if user_characters is not None:
            stmt = stmt.where(AutomationConfig.character_name.in_(user_characters))

        if character:
            stmt = stmt.where(AutomationConfig.character_name == character)

        if type:
            stmt = stmt.where(AutomationLog.action_type == type)

        stmt = stmt.offset(offset).limit(size)

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
        "total": len(rows),
        "page": page,
        "pages": 1,
    }


@router.get("/analytics")
async def get_analytics(
    request: Request,
    character: str = Query(default="", description="Character name (empty for all)"),
    hours: int = Query(default=24, ge=1, le=168, description="Hours of history"),
) -> dict[str, Any]:
    """Get analytics aggregations for a character.

    Returns XP history, gold history, and estimated actions per hour.
    If no character is specified, aggregates across the current user's characters.
    """
    analytics = AnalyticsService()
    user_chars = await get_user_character_names(request)

    async with async_session_factory() as db:
        if character:
            # Verify the requested character belongs to the current user
            if character not in user_chars:
                return {"xp_history": [], "gold_history": [], "actions_per_hour": 0}
            characters = [character]
        else:
            # Only aggregate characters belonging to the current user
            tracked = await analytics.get_tracked_characters(db)
            characters = [c for c in tracked if c in user_chars]

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
