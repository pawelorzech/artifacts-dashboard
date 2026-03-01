"""Tests for CooldownTracker."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.engine.cooldown import CooldownTracker, _BUFFER_SECONDS


class TestCooldownTrackerIsReady:
    """Tests for CooldownTracker.is_ready()."""

    def test_no_cooldown_ready(self):
        """A character with no recorded cooldown should be ready immediately."""
        tracker = CooldownTracker()
        assert tracker.is_ready("Hero") is True

    def test_not_ready_during_cooldown(self):
        """A character with an active cooldown should not be ready."""
        tracker = CooldownTracker()
        tracker.update("Hero", cooldown_seconds=60)
        assert tracker.is_ready("Hero") is False

    def test_ready_after_cooldown_expires(self):
        """A character whose cooldown has passed should be ready."""
        tracker = CooldownTracker()
        # Set an expiration in the past
        past = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
        tracker.update("Hero", cooldown_seconds=0, cooldown_expiration=past)
        assert tracker.is_ready("Hero") is True

    def test_unknown_character_is_ready(self):
        """A character that was never tracked should be ready."""
        tracker = CooldownTracker()
        tracker.update("Other", cooldown_seconds=60)
        assert tracker.is_ready("Unknown") is True


class TestCooldownTrackerRemaining:
    """Tests for CooldownTracker.remaining()."""

    def test_remaining_no_cooldown(self):
        """Remaining should be 0 for a character with no cooldown."""
        tracker = CooldownTracker()
        assert tracker.remaining("Hero") == 0.0

    def test_remaining_active_cooldown(self):
        """Remaining should be positive during an active cooldown."""
        tracker = CooldownTracker()
        tracker.update("Hero", cooldown_seconds=10)
        remaining = tracker.remaining("Hero")
        assert remaining > 0
        assert remaining <= 10.0

    def test_remaining_expired_cooldown(self):
        """Remaining should be 0 after cooldown has expired."""
        tracker = CooldownTracker()
        past = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
        tracker.update("Hero", cooldown_seconds=0, cooldown_expiration=past)
        assert tracker.remaining("Hero") == 0.0

    def test_remaining_calculation_accuracy(self):
        """Remaining should approximate the actual duration set."""
        tracker = CooldownTracker()
        future = datetime.now(timezone.utc) + timedelta(seconds=5)
        tracker.update("Hero", cooldown_seconds=5, cooldown_expiration=future.isoformat())
        remaining = tracker.remaining("Hero")
        # Should be close to 5 seconds (within 0.5s tolerance for execution time)
        assert 4.0 <= remaining <= 5.5


class TestCooldownTrackerUpdate:
    """Tests for CooldownTracker.update()."""

    def test_update_with_expiration_string(self):
        """update() should parse an ISO-8601 expiration string."""
        tracker = CooldownTracker()
        future = datetime.now(timezone.utc) + timedelta(seconds=30)
        tracker.update("Hero", cooldown_seconds=30, cooldown_expiration=future.isoformat())
        assert tracker.is_ready("Hero") is False
        assert tracker.remaining("Hero") > 25

    def test_update_with_seconds_fallback(self):
        """update() without expiration should use cooldown_seconds as duration."""
        tracker = CooldownTracker()
        tracker.update("Hero", cooldown_seconds=10)
        assert tracker.is_ready("Hero") is False

    def test_update_with_invalid_expiration_falls_back(self):
        """update() with an unparseable expiration should fall back to duration."""
        tracker = CooldownTracker()
        tracker.update("Hero", cooldown_seconds=5, cooldown_expiration="not-a-date")
        assert tracker.is_ready("Hero") is False
        remaining = tracker.remaining("Hero")
        assert remaining > 0

    def test_update_naive_datetime_gets_utc(self):
        """A naive datetime in expiration should be treated as UTC."""
        tracker = CooldownTracker()
        future = datetime.now(timezone.utc) + timedelta(seconds=10)
        # Strip timezone to create a naive ISO string
        naive_str = future.replace(tzinfo=None).isoformat()
        tracker.update("Hero", cooldown_seconds=10, cooldown_expiration=naive_str)
        assert tracker.is_ready("Hero") is False


class TestCooldownTrackerMultipleCharacters:
    """Tests for tracking multiple characters independently."""

    def test_multiple_characters(self):
        """Different characters should have independent cooldowns."""
        tracker = CooldownTracker()
        tracker.update("Hero", cooldown_seconds=60)
        # Second character has no cooldown
        assert tracker.is_ready("Hero") is False
        assert tracker.is_ready("Sidekick") is True

    def test_multiple_characters_different_durations(self):
        """Different characters can have different cooldown durations."""
        tracker = CooldownTracker()
        tracker.update("Fast", cooldown_seconds=2)
        tracker.update("Slow", cooldown_seconds=120)
        assert tracker.remaining("Fast") < tracker.remaining("Slow")

    def test_updating_one_does_not_affect_another(self):
        """Updating one character's cooldown should not affect another."""
        tracker = CooldownTracker()
        tracker.update("A", cooldown_seconds=60)
        remaining_a = tracker.remaining("A")
        tracker.update("B", cooldown_seconds=5)
        # A's remaining should not have changed (within execution tolerance)
        assert abs(tracker.remaining("A") - remaining_a) < 0.5


class TestCooldownTrackerWait:
    """Tests for the async CooldownTracker.wait() method."""

    @pytest.mark.asyncio
    async def test_wait_no_cooldown(self):
        """wait() should return immediately when no cooldown is set."""
        tracker = CooldownTracker()
        with patch("app.engine.cooldown.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await tracker.wait("Hero")
            mock_sleep.assert_not_called()

    @pytest.mark.asyncio
    async def test_wait_expired_cooldown(self):
        """wait() should return immediately when cooldown has already expired."""
        tracker = CooldownTracker()
        past = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
        tracker.update("Hero", cooldown_seconds=0, cooldown_expiration=past)

        with patch("app.engine.cooldown.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await tracker.wait("Hero")
            mock_sleep.assert_not_called()

    @pytest.mark.asyncio
    async def test_wait_active_cooldown_sleeps(self):
        """wait() should sleep for the remaining time plus buffer."""
        tracker = CooldownTracker()
        future = datetime.now(timezone.utc) + timedelta(seconds=2)
        tracker.update("Hero", cooldown_seconds=2, cooldown_expiration=future.isoformat())

        with patch("app.engine.cooldown.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await tracker.wait("Hero")
            mock_sleep.assert_called_once()
            sleep_duration = mock_sleep.call_args[0][0]
            # Should sleep for ~2 seconds + buffer
            assert sleep_duration > 0
            assert sleep_duration <= 2.0 + _BUFFER_SECONDS + 0.5
