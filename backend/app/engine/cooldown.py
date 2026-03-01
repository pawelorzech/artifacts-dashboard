import asyncio
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# Safety buffer added after every cooldown to avoid 499 "action already in progress" errors
_BUFFER_SECONDS: float = 0.1


class CooldownTracker:
    """Track per-character cooldowns with a safety buffer.

    The Artifacts MMO API returns cooldown information after every action.
    This tracker stores the expiry timestamp for each character and provides
    an async ``wait`` method that sleeps until the cooldown has elapsed plus
    a small buffer (100 ms) to prevent race-condition 499 errors.
    """

    def __init__(self) -> None:
        self._cooldowns: dict[str, datetime] = {}

    def update(
        self,
        character_name: str,
        cooldown_seconds: float,
        cooldown_expiration: str | None = None,
    ) -> None:
        """Record the cooldown from an action response.

        Parameters
        ----------
        character_name:
            The character whose cooldown is being updated.
        cooldown_seconds:
            Total cooldown duration in seconds (used as fallback).
        cooldown_expiration:
            ISO-8601 timestamp of when the cooldown expires (preferred).
        """
        if cooldown_expiration:
            try:
                expiry = datetime.fromisoformat(cooldown_expiration)
                # Ensure timezone-aware
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                logger.warning(
                    "Failed to parse cooldown_expiration %r for %s, using duration fallback",
                    cooldown_expiration,
                    character_name,
                )
                expiry = datetime.now(timezone.utc) + timedelta(seconds=cooldown_seconds)
        else:
            expiry = datetime.now(timezone.utc) + timedelta(seconds=cooldown_seconds)

        self._cooldowns[character_name] = expiry
        logger.debug(
            "Cooldown for %s set to %s (%.1fs)",
            character_name,
            expiry.isoformat(),
            cooldown_seconds,
        )

    async def wait(self, character_name: str) -> None:
        """Sleep until the character's cooldown has expired plus a safety buffer."""
        expiry = self._cooldowns.get(character_name)
        if expiry is None:
            return

        now = datetime.now(timezone.utc)
        remaining = (expiry - now).total_seconds() + _BUFFER_SECONDS

        if remaining > 0:
            logger.debug("Waiting %.2fs for %s cooldown", remaining, character_name)
            await asyncio.sleep(remaining)

    def is_ready(self, character_name: str) -> bool:
        """Return True if the character has no active cooldown."""
        expiry = self._cooldowns.get(character_name)
        if expiry is None:
            return True
        return datetime.now(timezone.utc) >= expiry

    def remaining(self, character_name: str) -> float:
        """Return remaining cooldown seconds (0 if ready)."""
        expiry = self._cooldowns.get(character_name)
        if expiry is None:
            return 0.0
        delta = (expiry - datetime.now(timezone.utc)).total_seconds()
        return max(delta, 0.0)
