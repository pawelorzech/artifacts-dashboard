from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum

from app.engine.pathfinder import Pathfinder
from app.schemas.game import CharacterSchema


class ActionType(str, Enum):
    """All possible actions the automation runner can execute."""

    MOVE = "move"
    FIGHT = "fight"
    GATHER = "gather"
    REST = "rest"
    EQUIP = "equip"
    UNEQUIP = "unequip"
    USE_ITEM = "use_item"
    DEPOSIT_ITEM = "deposit_item"
    WITHDRAW_ITEM = "withdraw_item"
    CRAFT = "craft"
    RECYCLE = "recycle"
    GE_BUY = "ge_buy"
    GE_SELL = "ge_sell"
    GE_CANCEL = "ge_cancel"
    TASK_NEW = "task_new"
    TASK_TRADE = "task_trade"
    TASK_COMPLETE = "task_complete"
    TASK_EXCHANGE = "task_exchange"
    IDLE = "idle"
    COMPLETE = "complete"


@dataclass
class ActionPlan:
    """A single action to be executed by the runner."""

    action_type: ActionType
    params: dict = field(default_factory=dict)
    reason: str = ""


class BaseStrategy(ABC):
    """Abstract base class for all automation strategies.

    A strategy inspects the current character state and returns an
    :class:`ActionPlan` describing the next action the runner should execute.

    Subclasses must implement :meth:`next_action` and :meth:`get_state`.
    """

    def __init__(self, config: dict, pathfinder: Pathfinder) -> None:
        self.config = config
        self.pathfinder = pathfinder

    @abstractmethod
    async def next_action(self, character: CharacterSchema) -> ActionPlan:
        """Determine the next action based on the current character state.

        Returns an :class:`ActionPlan` for the runner to execute.  Returning
        ``ActionType.COMPLETE`` signals the runner to stop the automation
        loop gracefully.  ``ActionType.IDLE`` causes the runner to skip
        execution and re-evaluate after a short delay.
        """
        ...

    @abstractmethod
    def get_state(self) -> str:
        """Return a human-readable label describing the current strategy state.

        Used for logging and status reporting.
        """
        ...

    # ------------------------------------------------------------------
    # Shared helpers available to all strategies
    # ------------------------------------------------------------------

    @staticmethod
    def _inventory_used_slots(character: CharacterSchema) -> int:
        """Count how many inventory slots are currently occupied."""
        return len(character.inventory)

    @staticmethod
    def _inventory_free_slots(character: CharacterSchema) -> int:
        """Count how many inventory slots are free."""
        return character.inventory_max_items - len(character.inventory)

    @staticmethod
    def _hp_percent(character: CharacterSchema) -> float:
        """Return the character's HP as a percentage of max HP."""
        if character.max_hp == 0:
            return 100.0
        return (character.hp / character.max_hp) * 100.0

    @staticmethod
    def _is_at(character: CharacterSchema, x: int, y: int) -> bool:
        """Check whether the character is standing at the given tile."""
        return character.x == x and character.y == y
