import logging
from enum import Enum

from app.engine.pathfinder import Pathfinder
from app.engine.strategies.base import ActionPlan, ActionType, BaseStrategy
from app.schemas.game import CharacterSchema, ResourceSchema

logger = logging.getLogger(__name__)

# All skills in the game with their gathering/crafting type
_GATHERING_SKILLS = {"mining", "woodcutting", "fishing"}
_CRAFTING_SKILLS = {"weaponcrafting", "gearcrafting", "jewelrycrafting", "cooking", "alchemy"}
_ALL_SKILLS = _GATHERING_SKILLS | _CRAFTING_SKILLS


class _LevelingState(str, Enum):
    """Internal state machine states for the leveling loop."""

    EVALUATE = "evaluate"
    MOVE_TO_TARGET = "move_to_target"
    GATHER = "gather"
    FIGHT = "fight"
    CHECK_HEALTH = "check_health"
    HEAL = "heal"
    CHECK_INVENTORY = "check_inventory"
    MOVE_TO_BANK = "move_to_bank"
    DEPOSIT = "deposit"


class LevelingStrategy(BaseStrategy):
    """Composite leveling strategy that picks the most optimal activity for XP.

    Analyzes the character's skill levels and focuses on the skill that
    needs the most attention, or a specific target skill if configured.

    Configuration keys (see :class:`~app.schemas.automation.LevelingConfig`):
        - target_skill: str (default "") -- specific skill to level (empty = auto-pick lowest)
        - min_level: int (default 0) -- stop suggestion below this level
        - max_level: int (default 0) -- stop when skill reaches this level (0 = no limit)
    """

    def __init__(
        self,
        config: dict,
        pathfinder: Pathfinder,
        resources_data: list[ResourceSchema] | None = None,
    ) -> None:
        super().__init__(config, pathfinder)
        self._state = _LevelingState.EVALUATE

        # Config
        self._target_skill: str = config.get("target_skill", "")
        self._min_level: int = config.get("min_level", 0)
        self._max_level: int = config.get("max_level", 0)

        # Resolved from game data
        self._resources_data: list[ResourceSchema] = resources_data or []

        # Runtime state
        self._chosen_skill: str = ""
        self._chosen_resource_code: str = ""
        self._chosen_monster_code: str = ""
        self._target_pos: tuple[int, int] | None = None
        self._bank_pos: tuple[int, int] | None = None
        self._evaluated: bool = False

    def get_state(self) -> str:
        if self._chosen_skill:
            return f"{self._state.value}:{self._chosen_skill}"
        return self._state.value

    def set_resources_data(self, resources_data: list[ResourceSchema]) -> None:
        """Set resource data for optimal target selection."""
        self._resources_data = resources_data

    async def next_action(self, character: CharacterSchema) -> ActionPlan:
        self._resolve_bank(character)

        match self._state:
            case _LevelingState.EVALUATE:
                return self._handle_evaluate(character)
            case _LevelingState.MOVE_TO_TARGET:
                return self._handle_move_to_target(character)
            case _LevelingState.GATHER:
                return self._handle_gather(character)
            case _LevelingState.FIGHT:
                return self._handle_fight(character)
            case _LevelingState.CHECK_HEALTH:
                return self._handle_check_health(character)
            case _LevelingState.HEAL:
                return self._handle_heal(character)
            case _LevelingState.CHECK_INVENTORY:
                return self._handle_check_inventory(character)
            case _LevelingState.MOVE_TO_BANK:
                return self._handle_move_to_bank(character)
            case _LevelingState.DEPOSIT:
                return self._handle_deposit(character)
            case _:
                return ActionPlan(ActionType.IDLE, reason="Unknown leveling state")

    # ------------------------------------------------------------------
    # State handlers
    # ------------------------------------------------------------------

    def _handle_evaluate(self, character: CharacterSchema) -> ActionPlan:
        """Decide which skill to level and find the best target."""
        if self._target_skill:
            skill = self._target_skill
        else:
            skill = self._find_lowest_skill(character)

        if not skill:
            return ActionPlan(
                ActionType.COMPLETE,
                reason="No skill found to level",
            )

        skill_level = self._get_skill_level(character, skill)

        # Check max_level constraint
        if self._max_level > 0 and skill_level >= self._max_level:
            if self._target_skill:
                return ActionPlan(
                    ActionType.COMPLETE,
                    reason=f"Skill {skill} reached target level {self._max_level}",
                )
            # Try another skill
            skill = self._find_lowest_skill(character, exclude={skill})
            if not skill:
                return ActionPlan(
                    ActionType.COMPLETE,
                    reason="All skills at or above max_level",
                )
            skill_level = self._get_skill_level(character, skill)

        self._chosen_skill = skill

        # Find optimal target
        if skill in _GATHERING_SKILLS:
            self._choose_gathering_target(character, skill, skill_level)
        elif skill == "combat" or skill not in _ALL_SKILLS:
            # Combat leveling - find appropriate monster
            self._choose_combat_target(character)
        else:
            # Crafting skills need gathering first, fallback to gathering
            # the raw material skill
            gathering_skill = self._crafting_to_gathering(skill)
            if gathering_skill:
                self._choose_gathering_target(character, gathering_skill, skill_level)
            else:
                return ActionPlan(
                    ActionType.IDLE,
                    reason=f"No leveling strategy available for {skill}",
                )

        if self._target_pos is None:
            return ActionPlan(
                ActionType.IDLE,
                reason=f"No target found for leveling {skill} at level {skill_level}",
            )

        self._state = _LevelingState.MOVE_TO_TARGET
        self._evaluated = True

        logger.info(
            "Leveling strategy: skill=%s, level=%d, resource=%s, monster=%s",
            skill,
            skill_level,
            self._chosen_resource_code,
            self._chosen_monster_code,
        )

        return self._handle_move_to_target(character)

    def _handle_move_to_target(self, character: CharacterSchema) -> ActionPlan:
        if self._target_pos is None:
            self._state = _LevelingState.EVALUATE
            return ActionPlan(ActionType.IDLE, reason="Target position lost, re-evaluating")

        tx, ty = self._target_pos
        if self._is_at(character, tx, ty):
            if self._chosen_resource_code:
                self._state = _LevelingState.GATHER
                return self._handle_gather(character)
            elif self._chosen_monster_code:
                self._state = _LevelingState.FIGHT
                return self._handle_fight(character)
            return ActionPlan(ActionType.IDLE, reason="At target but no action determined")

        if self._chosen_resource_code:
            self._state = _LevelingState.GATHER
        else:
            self._state = _LevelingState.FIGHT

        return ActionPlan(
            ActionType.MOVE,
            params={"x": tx, "y": ty},
            reason=f"Moving to leveling target at ({tx}, {ty}) for {self._chosen_skill}",
        )

    def _handle_gather(self, character: CharacterSchema) -> ActionPlan:
        if self._inventory_free_slots(character) == 0:
            self._state = _LevelingState.CHECK_INVENTORY
            return self._handle_check_inventory(character)

        # Re-evaluate periodically to check if level changed
        skill_level = self._get_skill_level(character, self._chosen_skill)
        if self._max_level > 0 and skill_level >= self._max_level:
            self._state = _LevelingState.EVALUATE
            self._target_pos = None
            return self._handle_evaluate(character)

        self._state = _LevelingState.CHECK_INVENTORY
        return ActionPlan(
            ActionType.GATHER,
            reason=f"Gathering for {self._chosen_skill} XP (level {skill_level})",
        )

    def _handle_fight(self, character: CharacterSchema) -> ActionPlan:
        if self._hp_percent(character) < 50:
            self._state = _LevelingState.CHECK_HEALTH
            return self._handle_check_health(character)

        self._state = _LevelingState.CHECK_HEALTH
        return ActionPlan(
            ActionType.FIGHT,
            reason=f"Fighting for combat XP",
        )

    def _handle_check_health(self, character: CharacterSchema) -> ActionPlan:
        if self._hp_percent(character) < 50:
            self._state = _LevelingState.HEAL
            return self._handle_heal(character)

        self._state = _LevelingState.CHECK_INVENTORY
        return self._handle_check_inventory(character)

    def _handle_heal(self, character: CharacterSchema) -> ActionPlan:
        if self._hp_percent(character) >= 100.0:
            self._state = _LevelingState.CHECK_INVENTORY
            return self._handle_check_inventory(character)

        self._state = _LevelingState.CHECK_HEALTH
        return ActionPlan(
            ActionType.REST,
            reason=f"Resting to heal (HP {character.hp}/{character.max_hp})",
        )

    def _handle_check_inventory(self, character: CharacterSchema) -> ActionPlan:
        if self._inventory_free_slots(character) == 0:
            self._state = _LevelingState.MOVE_TO_BANK
            return self._handle_move_to_bank(character)

        # Continue the current activity
        self._state = _LevelingState.MOVE_TO_TARGET
        return self._handle_move_to_target(character)

    def _handle_move_to_bank(self, character: CharacterSchema) -> ActionPlan:
        if self._bank_pos is None:
            return ActionPlan(ActionType.IDLE, reason="No bank tile found")

        bx, by = self._bank_pos
        if self._is_at(character, bx, by):
            self._state = _LevelingState.DEPOSIT
            return self._handle_deposit(character)

        self._state = _LevelingState.DEPOSIT
        return ActionPlan(
            ActionType.MOVE,
            params={"x": bx, "y": by},
            reason=f"Moving to bank at ({bx}, {by}) to deposit",
        )

    def _handle_deposit(self, character: CharacterSchema) -> ActionPlan:
        for slot in character.inventory:
            if slot.quantity > 0:
                return ActionPlan(
                    ActionType.DEPOSIT_ITEM,
                    params={"code": slot.code, "quantity": slot.quantity},
                    reason=f"Depositing {slot.quantity}x {slot.code}",
                )

        # Re-evaluate after depositing (skill might have leveled)
        self._state = _LevelingState.EVALUATE
        self._target_pos = None
        return self._handle_evaluate(character)

    # ------------------------------------------------------------------
    # Skill analysis helpers
    # ------------------------------------------------------------------

    def _find_lowest_skill(
        self,
        character: CharacterSchema,
        exclude: set[str] | None = None,
    ) -> str:
        """Find the gathering/crafting skill with the lowest level."""
        exclude = exclude or set()
        lowest_skill = ""
        lowest_level = float("inf")

        for skill in _GATHERING_SKILLS:
            if skill in exclude:
                continue
            level = self._get_skill_level(character, skill)
            if level < lowest_level:
                lowest_level = level
                lowest_skill = skill

        return lowest_skill

    @staticmethod
    def _get_skill_level(character: CharacterSchema, skill: str) -> int:
        """Extract skill level from character, defaulting to 0."""
        attr = f"{skill}_level"
        return getattr(character, attr, 0)

    def _choose_gathering_target(
        self,
        character: CharacterSchema,
        skill: str,
        skill_level: int,
    ) -> None:
        """Choose the best resource to gather for a given skill and level."""
        # Filter resources matching the skill
        matching = [r for r in self._resources_data if r.skill == skill]
        if not matching:
            # Fallback: use pathfinder to find any resource of this skill
            self._target_pos = self.pathfinder.find_nearest_by_type(
                character.x, character.y, "resource"
            )
            return

        # Find the best resource within +-3 levels
        candidates = []
        for r in matching:
            diff = r.level - skill_level
            if diff <= 3:  # Can gather up to 3 levels above
                candidates.append(r)

        if not candidates:
            # No resources within range, pick the lowest level one
            candidates = matching

        # Among candidates, prefer higher level for better XP
        best = max(candidates, key=lambda r: r.level if r.level <= skill_level + 3 else -r.level)
        self._chosen_resource_code = best.code

        self._target_pos = self.pathfinder.find_nearest(
            character.x, character.y, "resource", best.code
        )

    def _choose_combat_target(self, character: CharacterSchema) -> None:
        """Choose a monster appropriate for the character's combat level."""
        # Find a monster near the character's level
        self._chosen_monster_code = ""
        self._target_pos = self.pathfinder.find_nearest_by_type(
            character.x, character.y, "monster"
        )

    @staticmethod
    def _crafting_to_gathering(crafting_skill: str) -> str:
        """Map a crafting skill to its primary gathering skill."""
        mapping = {
            "weaponcrafting": "mining",
            "gearcrafting": "mining",
            "jewelrycrafting": "mining",
            "cooking": "fishing",
            "alchemy": "mining",
        }
        return mapping.get(crafting_skill, "")
