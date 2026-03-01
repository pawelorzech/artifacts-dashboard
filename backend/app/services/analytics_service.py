"""Analytics service for XP history, gold tracking, and action rate calculations."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character_snapshot import CharacterSnapshot

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Provides analytics derived from character snapshot time-series data."""

    async def get_xp_history(
        self,
        db: AsyncSession,
        character_name: str,
        hours: int = 24,
    ) -> list[dict[str, Any]]:
        """Get XP snapshots over time for a character.

        Parameters
        ----------
        db:
            Database session.
        character_name:
            Name of the character.
        hours:
            How many hours of history to return.

        Returns
        -------
        List of dicts with timestamp and XP values for each skill.
        """
        since = datetime.now(timezone.utc) - timedelta(hours=hours)

        stmt = (
            select(CharacterSnapshot)
            .where(
                CharacterSnapshot.name == character_name,
                CharacterSnapshot.created_at >= since,
            )
            .order_by(CharacterSnapshot.created_at.asc())
        )
        result = await db.execute(stmt)
        snapshots = result.scalars().all()

        history: list[dict[str, Any]] = []
        for snap in snapshots:
            data = snap.data or {}
            entry: dict[str, Any] = {
                "timestamp": snap.created_at.isoformat() if snap.created_at else None,
                "level": data.get("level", 0),
                "xp": data.get("xp", 0),
                "max_xp": data.get("max_xp", 0),
                "skills": {},
            }

            # Extract all skill XP values
            for skill in (
                "mining",
                "woodcutting",
                "fishing",
                "weaponcrafting",
                "gearcrafting",
                "jewelrycrafting",
                "cooking",
                "alchemy",
            ):
                entry["skills"][skill] = {
                    "level": data.get(f"{skill}_level", 0),
                    "xp": data.get(f"{skill}_xp", 0),
                }

            history.append(entry)

        return history

    async def get_gold_history(
        self,
        db: AsyncSession,
        character_name: str,
        hours: int = 24,
    ) -> list[dict[str, Any]]:
        """Get gold snapshots over time for a character.

        Parameters
        ----------
        db:
            Database session.
        character_name:
            Name of the character.
        hours:
            How many hours of history to return.

        Returns
        -------
        List of dicts with timestamp and gold amount.
        """
        since = datetime.now(timezone.utc) - timedelta(hours=hours)

        stmt = (
            select(CharacterSnapshot)
            .where(
                CharacterSnapshot.name == character_name,
                CharacterSnapshot.created_at >= since,
            )
            .order_by(CharacterSnapshot.created_at.asc())
        )
        result = await db.execute(stmt)
        snapshots = result.scalars().all()

        return [
            {
                "timestamp": snap.created_at.isoformat() if snap.created_at else None,
                "gold": (snap.data or {}).get("gold", 0),
            }
            for snap in snapshots
        ]

    async def get_actions_per_hour(
        self,
        db: AsyncSession,
        character_name: str,
    ) -> dict[str, Any]:
        """Calculate the action rate for a character based on recent snapshots.

        Uses the difference between the latest and earliest snapshot in the
        last hour to estimate actions per hour (approximated by XP changes).

        Returns
        -------
        Dict with "character_name", "period_hours", "xp_gained", "estimated_actions_per_hour".
        """
        now = datetime.now(timezone.utc)
        one_hour_ago = now - timedelta(hours=1)

        # Get earliest snapshot in the window
        stmt_earliest = (
            select(CharacterSnapshot)
            .where(
                CharacterSnapshot.name == character_name,
                CharacterSnapshot.created_at >= one_hour_ago,
            )
            .order_by(CharacterSnapshot.created_at.asc())
            .limit(1)
        )
        result = await db.execute(stmt_earliest)
        earliest = result.scalar_one_or_none()

        # Get latest snapshot
        stmt_latest = (
            select(CharacterSnapshot)
            .where(
                CharacterSnapshot.name == character_name,
                CharacterSnapshot.created_at >= one_hour_ago,
            )
            .order_by(CharacterSnapshot.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt_latest)
        latest = result.scalar_one_or_none()

        if earliest is None or latest is None or earliest.id == latest.id:
            return {
                "character_name": character_name,
                "period_hours": 1,
                "xp_gained": 0,
                "gold_gained": 0,
                "estimated_actions_per_hour": 0,
            }

        earliest_data = earliest.data or {}
        latest_data = latest.data or {}

        # Calculate total XP gained across all skills
        total_xp_gained = 0
        for skill in (
            "mining",
            "woodcutting",
            "fishing",
            "weaponcrafting",
            "gearcrafting",
            "jewelrycrafting",
            "cooking",
            "alchemy",
        ):
            xp_key = f"{skill}_xp"
            early_xp = earliest_data.get(xp_key, 0)
            late_xp = latest_data.get(xp_key, 0)
            total_xp_gained += max(0, late_xp - early_xp)

        # Also add combat XP
        total_xp_gained += max(
            0,
            latest_data.get("xp", 0) - earliest_data.get("xp", 0),
        )

        gold_gained = max(
            0,
            latest_data.get("gold", 0) - earliest_data.get("gold", 0),
        )

        # Estimate time span
        if earliest.created_at and latest.created_at:
            time_span = (latest.created_at - earliest.created_at).total_seconds()
            hours = max(time_span / 3600, 0.01)  # Avoid division by zero
        else:
            hours = 1.0

        # Count snapshots as a proxy for activity periods
        count_stmt = (
            select(func.count())
            .select_from(CharacterSnapshot)
            .where(
                CharacterSnapshot.name == character_name,
                CharacterSnapshot.created_at >= one_hour_ago,
            )
        )
        count_result = await db.execute(count_stmt)
        snapshot_count = count_result.scalar() or 0

        return {
            "character_name": character_name,
            "period_hours": round(hours, 2),
            "xp_gained": total_xp_gained,
            "gold_gained": gold_gained,
            "snapshot_count": snapshot_count,
            "estimated_actions_per_hour": round(total_xp_gained / hours, 1) if hours > 0 else 0,
        }
