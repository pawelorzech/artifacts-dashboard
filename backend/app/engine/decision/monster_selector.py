import logging

from app.schemas.game import CharacterSchema, MonsterSchema

logger = logging.getLogger(__name__)

# Maximum level difference when selecting an "optimal" monster
_MAX_LEVEL_DELTA: int = 5


class MonsterSelector:
    """Select the best monster for a character to fight.

    The selection heuristic prefers monsters within +/- 5 levels of the
    character's combat level. Among those candidates, higher-level monsters
    are preferred because they yield more XP.
    """

    def select_optimal(
        self,
        character: CharacterSchema,
        monsters: list[MonsterSchema],
    ) -> MonsterSchema | None:
        """Return the best monster for the character, or ``None`` if the
        list is empty or no suitable monster exists.

        Parameters
        ----------
        character:
            The character that will be fighting.
        monsters:
            All available monsters (typically from the game data cache).

        Returns
        -------
        The selected monster, or None.
        """
        if not monsters:
            return None

        char_level = character.level

        # First pass: prefer monsters within the level window
        candidates = [
            m
            for m in monsters
            if abs(m.level - char_level) <= _MAX_LEVEL_DELTA
        ]

        if not candidates:
            # No monster in the preferred window -- fall back to the
            # highest-level monster that is still at or below the character
            below = [m for m in monsters if m.level <= char_level]
            if below:
                candidates = below
            else:
                # All monsters are higher-level; pick the lowest available
                candidates = sorted(monsters, key=lambda m: m.level)
                return candidates[0] if candidates else None

        # Among candidates, prefer higher level for better XP
        candidates.sort(key=lambda m: m.level, reverse=True)
        selected = candidates[0]

        logger.debug(
            "Selected monster %s (level %d) for character %s (level %d)",
            selected.code,
            selected.level,
            character.name,
            char_level,
        )
        return selected

    def filter_by_code(
        self,
        monsters: list[MonsterSchema],
        code: str,
    ) -> MonsterSchema | None:
        """Return the monster with the given code, or ``None``."""
        for m in monsters:
            if m.code == code:
                return m
        return None
