"""Resource selector for choosing optimal gathering targets based on character skill level."""

import logging
from dataclasses import dataclass

from app.schemas.game import CharacterSchema, ResourceSchema

logger = logging.getLogger(__name__)


@dataclass
class ResourceSelection:
    """Result of a resource selection decision."""

    resource: ResourceSchema
    score: float
    reason: str


class ResourceSelector:
    """Selects the optimal resource for a character to gather based on skill level.

    Prefers resources within +/- 3 levels of the character's skill.
    Among eligible resources, prefers higher-level ones for better XP.
    """

    # How many levels above/below the character's skill level to consider
    LEVEL_RANGE: int = 3

    def select_optimal(
        self,
        character: CharacterSchema,
        resources: list[ResourceSchema],
        skill: str,
    ) -> ResourceSelection | None:
        """Select the best resource for the character's skill level.

        Parameters
        ----------
        character:
            The character whose skill level determines the selection.
        resources:
            Available resources to choose from.
        skill:
            The gathering skill to optimize for (e.g. "mining", "woodcutting", "fishing").

        Returns
        -------
        ResourceSelection or None if no suitable resource is found.
        """
        skill_level = self._get_skill_level(character, skill)
        if skill_level is None:
            logger.warning("Unknown skill %r for resource selection", skill)
            return None

        # Filter to resources that match the skill
        skill_resources = [r for r in resources if r.skill == skill]
        if not skill_resources:
            logger.info("No resources found for skill %s", skill)
            return None

        # Score each resource
        scored: list[tuple[ResourceSchema, float, str]] = []
        for resource in skill_resources:
            score, reason = self._score_resource(resource, skill_level)
            if score > 0:
                scored.append((resource, score, reason))

        if not scored:
            # Fallback: pick the highest-level resource we can actually gather
            gatherable = [
                r for r in skill_resources if r.level <= skill_level
            ]
            if gatherable:
                best = max(gatherable, key=lambda r: r.level)
                return ResourceSelection(
                    resource=best,
                    score=0.1,
                    reason=f"Fallback: highest gatherable resource (level {best.level}, skill {skill_level})",
                )
            # Pick the lowest-level resource as absolute fallback
            lowest = min(skill_resources, key=lambda r: r.level)
            return ResourceSelection(
                resource=lowest,
                score=0.01,
                reason=f"Absolute fallback: lowest resource (level {lowest.level}, skill {skill_level})",
            )

        # Sort by score descending and pick the best
        scored.sort(key=lambda x: x[1], reverse=True)
        best_resource, best_score, best_reason = scored[0]

        logger.info(
            "Selected resource %s (level %d) for %s level %d: %s (score=%.2f)",
            best_resource.code,
            best_resource.level,
            skill,
            skill_level,
            best_reason,
            best_score,
        )

        return ResourceSelection(
            resource=best_resource,
            score=best_score,
            reason=best_reason,
        )

    def _score_resource(
        self,
        resource: ResourceSchema,
        skill_level: int,
    ) -> tuple[float, str]:
        """Score a resource based on how well it matches the character's skill level.

        Returns (score, reason). Score of 0 means the resource is not suitable.
        """
        level_diff = resource.level - skill_level

        # Cannot gather resources more than LEVEL_RANGE levels above skill
        if level_diff > self.LEVEL_RANGE:
            return 0.0, f"Too high level (resource {resource.level}, skill {skill_level})"

        # Ideal range: within +/- LEVEL_RANGE
        if abs(level_diff) <= self.LEVEL_RANGE:
            # Higher level within range = more XP = better score
            # Base score from level closeness (prefer higher)
            base_score = 10.0 + level_diff  # Range: [7, 13]

            # Bonus for being at or slightly above skill level (best XP)
            if 0 <= level_diff <= self.LEVEL_RANGE:
                base_score += 5.0  # Prefer resources at or above skill level

            reason = f"In optimal range (diff={level_diff:+d})"
            return base_score, reason

        # Resource is far below skill level -- still works but less XP
        # level_diff < -LEVEL_RANGE
        penalty = abs(level_diff) - self.LEVEL_RANGE
        score = max(5.0 - penalty, 0.1)
        return score, f"Below optimal range (diff={level_diff:+d})"

    @staticmethod
    def _get_skill_level(character: CharacterSchema, skill: str) -> int | None:
        """Extract the level for a given skill from the character schema."""
        skill_attr = f"{skill}_level"
        if hasattr(character, skill_attr):
            return getattr(character, skill_attr)
        return None
