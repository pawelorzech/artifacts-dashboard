import logging
from enum import Enum

from app.engine.pathfinder import Pathfinder
from app.engine.strategies.base import ActionPlan, ActionType, BaseStrategy
from app.schemas.game import CharacterSchema

logger = logging.getLogger(__name__)


class _TaskState(str, Enum):
    """Internal state machine states for the task loop."""

    MOVE_TO_TASKMASTER = "move_to_taskmaster"
    ACCEPT_TASK = "accept_task"
    EVALUATE_TASK = "evaluate_task"
    DO_REQUIREMENTS = "do_requirements"
    MOVE_TO_TASK_TARGET = "move_to_task_target"
    EXECUTE_TASK_ACTION = "execute_task_action"
    CHECK_TASK_PROGRESS = "check_task_progress"
    CHECK_HEALTH = "check_health"
    HEAL = "heal"
    MOVE_TO_BANK = "move_to_bank"
    DEPOSIT = "deposit"
    MOVE_TO_TASKMASTER_TRADE = "move_to_taskmaster_trade"
    TRADE_ITEMS = "trade_items"
    COMPLETE_TASK = "complete_task"
    EXCHANGE_COINS = "exchange_coins"


class TaskStrategy(BaseStrategy):
    """Automated task completion strategy.

    State machine flow::

        MOVE_TO_TASKMASTER -> ACCEPT_TASK -> EVALUATE_TASK
                                                |
                               -> DO_REQUIREMENTS -> MOVE_TO_TASK_TARGET
                                                      -> EXECUTE_TASK_ACTION
                                                      -> CHECK_TASK_PROGRESS
                                                            |
                                             (done?)  -> MOVE_TO_TASKMASTER_TRADE
                                                          -> TRADE_ITEMS
                                                          -> COMPLETE_TASK
                                                          -> EXCHANGE_COINS
                                                          -> (loop to ACCEPT_TASK)
                                             (not done?) -> EXECUTE_TASK_ACTION (loop)

    Configuration keys (see :class:`~app.schemas.automation.TaskConfig`):
        - max_tasks: int (default 0 = infinite) -- max tasks to complete
        - auto_exchange: bool (default True) -- exchange task coins automatically
        - task_type: str (default "") -- preferred task type filter (empty = any)
    """

    def __init__(self, config: dict, pathfinder: Pathfinder) -> None:
        super().__init__(config, pathfinder)
        self._state = _TaskState.MOVE_TO_TASKMASTER

        # Config
        self._max_tasks: int = config.get("max_tasks", 0)
        self._auto_exchange: bool = config.get("auto_exchange", True)
        self._task_type_filter: str = config.get("task_type", "")

        # Runtime state
        self._tasks_completed: int = 0
        self._current_task_code: str = ""
        self._current_task_type: str = ""
        self._current_task_total: int = 0

        # Cached positions
        self._taskmaster_pos: tuple[int, int] | None = None
        self._task_target_pos: tuple[int, int] | None = None
        self._bank_pos: tuple[int, int] | None = None

    def get_state(self) -> str:
        return self._state.value

    async def next_action(self, character: CharacterSchema) -> ActionPlan:
        # Check if we've completed enough tasks
        if self._max_tasks > 0 and self._tasks_completed >= self._max_tasks:
            return ActionPlan(
                ActionType.COMPLETE,
                reason=f"Completed {self._tasks_completed}/{self._max_tasks} tasks",
            )

        self._resolve_locations(character)

        match self._state:
            case _TaskState.MOVE_TO_TASKMASTER:
                return self._handle_move_to_taskmaster(character)
            case _TaskState.ACCEPT_TASK:
                return self._handle_accept_task(character)
            case _TaskState.EVALUATE_TASK:
                return self._handle_evaluate_task(character)
            case _TaskState.DO_REQUIREMENTS:
                return self._handle_do_requirements(character)
            case _TaskState.MOVE_TO_TASK_TARGET:
                return self._handle_move_to_task_target(character)
            case _TaskState.EXECUTE_TASK_ACTION:
                return self._handle_execute_task_action(character)
            case _TaskState.CHECK_TASK_PROGRESS:
                return self._handle_check_task_progress(character)
            case _TaskState.CHECK_HEALTH:
                return self._handle_check_health(character)
            case _TaskState.HEAL:
                return self._handle_heal(character)
            case _TaskState.MOVE_TO_BANK:
                return self._handle_move_to_bank(character)
            case _TaskState.DEPOSIT:
                return self._handle_deposit(character)
            case _TaskState.MOVE_TO_TASKMASTER_TRADE:
                return self._handle_move_to_taskmaster_trade(character)
            case _TaskState.TRADE_ITEMS:
                return self._handle_trade_items(character)
            case _TaskState.COMPLETE_TASK:
                return self._handle_complete_task(character)
            case _TaskState.EXCHANGE_COINS:
                return self._handle_exchange_coins(character)
            case _:
                return ActionPlan(ActionType.IDLE, reason="Unknown task state")

    # ------------------------------------------------------------------
    # State handlers
    # ------------------------------------------------------------------

    def _handle_move_to_taskmaster(self, character: CharacterSchema) -> ActionPlan:
        # If character already has a task, skip to evaluating it
        if character.task and character.task_type:
            self._current_task_code = character.task
            self._current_task_type = character.task_type
            self._current_task_total = character.task_total
            self._state = _TaskState.EVALUATE_TASK
            return self._handle_evaluate_task(character)

        if self._taskmaster_pos is None:
            return ActionPlan(
                ActionType.IDLE,
                reason="No task master NPC found on map",
            )

        tx, ty = self._taskmaster_pos
        if self._is_at(character, tx, ty):
            self._state = _TaskState.ACCEPT_TASK
            return self._handle_accept_task(character)

        self._state = _TaskState.ACCEPT_TASK
        return ActionPlan(
            ActionType.MOVE,
            params={"x": tx, "y": ty},
            reason=f"Moving to task master at ({tx}, {ty})",
        )

    def _handle_accept_task(self, character: CharacterSchema) -> ActionPlan:
        # If already has a task, evaluate it
        if character.task and character.task_type:
            self._current_task_code = character.task
            self._current_task_type = character.task_type
            self._current_task_total = character.task_total
            self._state = _TaskState.EVALUATE_TASK
            return self._handle_evaluate_task(character)

        # Accept a new task (the API call is task_new)
        self._state = _TaskState.EVALUATE_TASK
        return ActionPlan(
            ActionType.TASK_NEW,
            reason="Accepting new task from task master",
        )

    def _handle_evaluate_task(self, character: CharacterSchema) -> ActionPlan:
        """Evaluate the current task and determine where to go."""
        self._current_task_code = character.task
        self._current_task_type = character.task_type
        self._current_task_total = character.task_total

        if not self._current_task_code:
            # No task assigned, go accept one
            self._state = _TaskState.MOVE_TO_TASKMASTER
            return self._handle_move_to_taskmaster(character)

        # Check if task is already complete
        if character.task_progress >= character.task_total:
            self._state = _TaskState.MOVE_TO_TASKMASTER_TRADE
            return self._handle_move_to_taskmaster_trade(character)

        # Determine target location based on task type
        self._resolve_task_target(character)

        self._state = _TaskState.MOVE_TO_TASK_TARGET
        return self._handle_move_to_task_target(character)

    def _handle_do_requirements(self, character: CharacterSchema) -> ActionPlan:
        # Redirect to move to task target
        self._state = _TaskState.MOVE_TO_TASK_TARGET
        return self._handle_move_to_task_target(character)

    def _handle_move_to_task_target(self, character: CharacterSchema) -> ActionPlan:
        if self._task_target_pos is None:
            return ActionPlan(
                ActionType.IDLE,
                reason=f"No target found for task {self._current_task_code} (type={self._current_task_type})",
            )

        tx, ty = self._task_target_pos
        if self._is_at(character, tx, ty):
            self._state = _TaskState.EXECUTE_TASK_ACTION
            return self._handle_execute_task_action(character)

        self._state = _TaskState.EXECUTE_TASK_ACTION
        return ActionPlan(
            ActionType.MOVE,
            params={"x": tx, "y": ty},
            reason=f"Moving to task target at ({tx}, {ty}) for {self._current_task_code}",
        )

    def _handle_execute_task_action(self, character: CharacterSchema) -> ActionPlan:
        """Execute the appropriate action for the current task type."""
        task_type = self._current_task_type.lower()

        if task_type == "monsters":
            # Check health before fighting
            if self._hp_percent(character) < 50:
                self._state = _TaskState.CHECK_HEALTH
                return self._handle_check_health(character)

            self._state = _TaskState.CHECK_TASK_PROGRESS
            return ActionPlan(
                ActionType.FIGHT,
                reason=f"Fighting for task: {self._current_task_code}",
            )

        if task_type in ("resources", "items"):
            # Check inventory
            if self._inventory_free_slots(character) == 0:
                self._state = _TaskState.MOVE_TO_BANK
                return self._handle_move_to_bank(character)

            self._state = _TaskState.CHECK_TASK_PROGRESS
            return ActionPlan(
                ActionType.GATHER,
                reason=f"Gathering for task: {self._current_task_code}",
            )

        # Unknown task type, try to fight as default
        self._state = _TaskState.CHECK_TASK_PROGRESS
        return ActionPlan(
            ActionType.FIGHT,
            reason=f"Executing task action for {self._current_task_code} (type={task_type})",
        )

    def _handle_check_task_progress(self, character: CharacterSchema) -> ActionPlan:
        """Check if the task requirements are met."""
        if character.task_progress >= character.task_total:
            # Task requirements met, go trade
            self._state = _TaskState.MOVE_TO_TASKMASTER_TRADE
            return self._handle_move_to_taskmaster_trade(character)

        # Check inventory for deposit needs
        if self._inventory_free_slots(character) <= 1:
            self._state = _TaskState.MOVE_TO_BANK
            return self._handle_move_to_bank(character)

        # Continue the task action
        self._state = _TaskState.EXECUTE_TASK_ACTION
        return self._handle_execute_task_action(character)

    def _handle_check_health(self, character: CharacterSchema) -> ActionPlan:
        if self._hp_percent(character) >= 50:
            self._state = _TaskState.EXECUTE_TASK_ACTION
            return self._handle_execute_task_action(character)

        self._state = _TaskState.HEAL
        return self._handle_heal(character)

    def _handle_heal(self, character: CharacterSchema) -> ActionPlan:
        if self._hp_percent(character) >= 100.0:
            self._state = _TaskState.EXECUTE_TASK_ACTION
            return self._handle_execute_task_action(character)

        self._state = _TaskState.CHECK_HEALTH
        return ActionPlan(
            ActionType.REST,
            reason=f"Resting to heal during task (HP {character.hp}/{character.max_hp})",
        )

    def _handle_move_to_bank(self, character: CharacterSchema) -> ActionPlan:
        if self._bank_pos is None:
            return ActionPlan(ActionType.IDLE, reason="No bank tile found")

        bx, by = self._bank_pos
        if self._is_at(character, bx, by):
            self._state = _TaskState.DEPOSIT
            return self._handle_deposit(character)

        self._state = _TaskState.DEPOSIT
        return ActionPlan(
            ActionType.MOVE,
            params={"x": bx, "y": by},
            reason=f"Moving to bank at ({bx}, {by}) to deposit during task",
        )

    def _handle_deposit(self, character: CharacterSchema) -> ActionPlan:
        for slot in character.inventory:
            if slot.quantity > 0:
                return ActionPlan(
                    ActionType.DEPOSIT_ITEM,
                    params={"code": slot.code, "quantity": slot.quantity},
                    reason=f"Depositing {slot.quantity}x {slot.code}",
                )

        # All deposited, go back to task
        self._state = _TaskState.MOVE_TO_TASK_TARGET
        return self._handle_move_to_task_target(character)

    def _handle_move_to_taskmaster_trade(self, character: CharacterSchema) -> ActionPlan:
        if self._taskmaster_pos is None:
            return ActionPlan(ActionType.IDLE, reason="No task master found")

        tx, ty = self._taskmaster_pos
        if self._is_at(character, tx, ty):
            self._state = _TaskState.TRADE_ITEMS
            return self._handle_trade_items(character)

        self._state = _TaskState.TRADE_ITEMS
        return ActionPlan(
            ActionType.MOVE,
            params={"x": tx, "y": ty},
            reason=f"Moving to task master at ({tx}, {ty}) to trade items",
        )

    def _handle_trade_items(self, character: CharacterSchema) -> ActionPlan:
        """Trade the required items to the task master."""
        # The task_trade action requires the task item code and quantity
        if not self._current_task_code:
            self._state = _TaskState.COMPLETE_TASK
            return self._handle_complete_task(character)

        self._state = _TaskState.COMPLETE_TASK
        return ActionPlan(
            ActionType.TASK_TRADE,
            params={
                "code": self._current_task_code,
                "quantity": self._current_task_total,
            },
            reason=f"Trading {self._current_task_total}x {self._current_task_code} to task master",
        )

    def _handle_complete_task(self, character: CharacterSchema) -> ActionPlan:
        """Complete the task at the task master."""
        self._tasks_completed += 1

        if self._auto_exchange:
            self._state = _TaskState.EXCHANGE_COINS
        else:
            self._state = _TaskState.MOVE_TO_TASKMASTER  # loop for next task

        return ActionPlan(
            ActionType.TASK_COMPLETE,
            reason=f"Completing task #{self._tasks_completed}: {self._current_task_code}",
        )

    def _handle_exchange_coins(self, character: CharacterSchema) -> ActionPlan:
        """Exchange task coins for rewards."""
        # Reset for next task
        self._current_task_code = ""
        self._current_task_type = ""
        self._current_task_total = 0
        self._task_target_pos = None

        self._state = _TaskState.MOVE_TO_TASKMASTER
        return ActionPlan(
            ActionType.TASK_EXCHANGE,
            reason="Exchanging task coins for rewards",
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _resolve_locations(self, character: CharacterSchema) -> None:
        """Lazily resolve and cache tile positions."""
        if self._taskmaster_pos is None:
            # Task masters are NPCs of type "tasks_master"
            self._taskmaster_pos = self.pathfinder.find_nearest_by_type(
                character.x, character.y, "tasks_master"
            )
            if self._taskmaster_pos:
                logger.info("Resolved task master at %s", self._taskmaster_pos)

        if self._bank_pos is None:
            self._bank_pos = self.pathfinder.find_nearest_by_type(
                character.x, character.y, "bank"
            )
            if self._bank_pos:
                logger.info("Resolved bank at %s", self._bank_pos)

    def _resolve_task_target(self, character: CharacterSchema) -> None:
        """Resolve the target location for the current task."""
        task_type = self._current_task_type.lower()
        task_code = self._current_task_code

        if task_type == "monsters":
            self._task_target_pos = self.pathfinder.find_nearest(
                character.x, character.y, "monster", task_code
            )
        elif task_type in ("resources", "items"):
            self._task_target_pos = self.pathfinder.find_nearest(
                character.x, character.y, "resource", task_code
            )
        else:
            # Try monster first, then resource
            self._task_target_pos = self.pathfinder.find_nearest(
                character.x, character.y, "monster", task_code
            )
            if self._task_target_pos is None:
                self._task_target_pos = self.pathfinder.find_nearest(
                    character.x, character.y, "resource", task_code
                )

        if self._task_target_pos:
            logger.info(
                "Resolved task target %s (%s) at %s",
                task_code,
                task_type,
                self._task_target_pos,
            )
