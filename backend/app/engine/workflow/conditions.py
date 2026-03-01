from __future__ import annotations

import logging
import time
from enum import Enum
from typing import Any

from app.schemas.game import CharacterSchema
from app.services.artifacts_client import ArtifactsClient

logger = logging.getLogger(__name__)


class TransitionType(str, Enum):
    STRATEGY_COMPLETE = "strategy_complete"
    LOOPS_COMPLETED = "loops_completed"
    INVENTORY_FULL = "inventory_full"
    INVENTORY_ITEM_COUNT = "inventory_item_count"
    BANK_ITEM_COUNT = "bank_item_count"
    SKILL_LEVEL = "skill_level"
    GOLD_AMOUNT = "gold_amount"
    ACTIONS_COUNT = "actions_count"
    TIMER = "timer"


def _compare(actual: int | float, operator: str, target: int | float) -> bool:
    """Compare a value using a string operator."""
    match operator:
        case ">=":
            return actual >= target
        case "<=":
            return actual <= target
        case "==":
            return actual == target
        case ">":
            return actual > target
        case "<":
            return actual < target
        case _:
            return actual >= target


class TransitionEvaluator:
    """Evaluates transition conditions for workflow steps."""

    def __init__(self, client: ArtifactsClient) -> None:
        self._client = client
        self._bank_cache: list[dict[str, Any]] | None = None
        self._bank_cache_tick: int = 0
        self._tick_counter: int = 0

    async def should_transition(
        self,
        condition: dict,
        character: CharacterSchema,
        *,
        actions_count: int = 0,
        step_start_time: float = 0.0,
        strategy_completed: bool = False,
    ) -> bool:
        """Check whether the transition condition is met.

        Parameters
        ----------
        condition:
            The transition condition dict with keys: type, operator, value,
            item_code, skill, seconds.
        character:
            Current character state.
        actions_count:
            Number of actions executed in the current step.
        step_start_time:
            Timestamp when the current step started.
        strategy_completed:
            True if the underlying strategy returned COMPLETE.
        """
        self._tick_counter += 1
        cond_type = condition.get("type", "")
        operator = condition.get("operator", ">=")
        target_value = condition.get("value", 0)

        try:
            match cond_type:
                case TransitionType.STRATEGY_COMPLETE:
                    return strategy_completed

                case TransitionType.LOOPS_COMPLETED:
                    # This is handled externally by the workflow runner
                    return False

                case TransitionType.INVENTORY_FULL:
                    free_slots = character.inventory_max_items - len(character.inventory)
                    return free_slots == 0

                case TransitionType.INVENTORY_ITEM_COUNT:
                    item_code = condition.get("item_code", "")
                    count = sum(
                        s.quantity
                        for s in character.inventory
                        if s.code == item_code
                    )
                    return _compare(count, operator, target_value)

                case TransitionType.BANK_ITEM_COUNT:
                    item_code = condition.get("item_code", "")
                    bank_count = await self._get_bank_item_count(item_code)
                    return _compare(bank_count, operator, target_value)

                case TransitionType.SKILL_LEVEL:
                    skill = condition.get("skill", "")
                    level = getattr(character, f"{skill}_level", 0)
                    return _compare(level, operator, target_value)

                case TransitionType.GOLD_AMOUNT:
                    return _compare(character.gold, operator, target_value)

                case TransitionType.ACTIONS_COUNT:
                    return _compare(actions_count, operator, target_value)

                case TransitionType.TIMER:
                    seconds = condition.get("seconds", 0)
                    if step_start_time <= 0:
                        return False
                    elapsed = time.time() - step_start_time
                    return elapsed >= seconds

                case _:
                    logger.warning("Unknown transition type: %s", cond_type)
                    return False

        except Exception:
            logger.exception("Error evaluating transition condition: %s", condition)
            return False

    async def _get_bank_item_count(self, item_code: str) -> int:
        """Get item count from bank, with rate-limited caching (every 10 ticks)."""
        if (
            self._bank_cache is None
            or self._tick_counter - self._bank_cache_tick >= 10
        ):
            try:
                self._bank_cache = await self._client.get_bank_items()
                self._bank_cache_tick = self._tick_counter
            except Exception:
                logger.exception("Failed to fetch bank items for transition check")
                return 0

        if self._bank_cache is None:
            return 0

        for item in self._bank_cache:
            if isinstance(item, dict) and item.get("code") == item_code:
                return item.get("quantity", 0)
        return 0

    def reset(self) -> None:
        """Reset caches when advancing to a new step."""
        self._bank_cache = None
        self._bank_cache_tick = 0
