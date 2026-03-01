"""Tests for ResourceSelector."""

from app.engine.decision.resource_selector import ResourceSelector


class TestResourceSelectorSelectOptimal:
    """Tests for ResourceSelector.select_optimal()."""

    def test_select_optimal(self, make_character, make_resource):
        """Picks the best resource for the character's skill level."""
        selector = ResourceSelector()
        char = make_character(mining_level=5)
        resources = [
            make_resource(code="copper_rocks", skill="mining", level=1),
            make_resource(code="iron_rocks", skill="mining", level=5),
            make_resource(code="gold_rocks", skill="mining", level=8),
            make_resource(code="diamond_rocks", skill="mining", level=20),
        ]

        result = selector.select_optimal(char, resources, "mining")

        assert result is not None
        # gold_rocks (level 8) is within range [2..8] and highest => best XP
        assert result.resource.code == "gold_rocks"

    def test_no_matching_skill(self, make_character, make_resource):
        """Returns None for a non-matching skill."""
        selector = ResourceSelector()
        char = make_character(mining_level=5)
        resources = [
            make_resource(code="oak_tree", skill="woodcutting", level=5),
        ]

        result = selector.select_optimal(char, resources, "mining")

        assert result is None

    def test_unknown_skill(self, make_character, make_resource):
        """Returns None when the skill attribute does not exist on the character."""
        selector = ResourceSelector()
        char = make_character()
        resources = [
            make_resource(code="mystery", skill="alchemy_brewing", level=1),
        ]

        # "alchemy_brewing_level" does not exist on CharacterSchema
        result = selector.select_optimal(char, resources, "alchemy_brewing")

        assert result is None

    def test_empty_resources(self, make_character):
        """Returns None for an empty resource list."""
        selector = ResourceSelector()
        char = make_character(mining_level=5)

        result = selector.select_optimal(char, [], "mining")

        assert result is None

    def test_prefers_higher_level_in_range(self, make_character, make_resource):
        """Among resources in the optimal range, prefers higher level."""
        selector = ResourceSelector()
        char = make_character(mining_level=10)
        resources = [
            make_resource(code="iron", skill="mining", level=8),
            make_resource(code="mithril", skill="mining", level=12),
            make_resource(code="gold", skill="mining", level=10),
        ]

        result = selector.select_optimal(char, resources, "mining")

        assert result is not None
        # mithril (12) is within range and above skill level => best score
        assert result.resource.code == "mithril"

    def test_prefers_above_skill_over_below(self, make_character, make_resource):
        """Resources at or above skill level are preferred (bonus score)."""
        selector = ResourceSelector()
        char = make_character(mining_level=10)
        resources = [
            make_resource(code="lower", skill="mining", level=7),   # diff=-3, in range, below
            make_resource(code="higher", skill="mining", level=11),  # diff=+1, in range, above
        ]

        result = selector.select_optimal(char, resources, "mining")

        assert result is not None
        assert result.resource.code == "higher"

    def test_fallback_to_highest_gatherable(self, make_character, make_resource):
        """When no resource is in optimal range, the scoring prefers the one closest to range."""
        selector = ResourceSelector()
        char = make_character(mining_level=10)
        resources = [
            make_resource(code="copper", skill="mining", level=1),  # diff=-9, penalty=6, score=0.1
            make_resource(code="iron", skill="mining", level=5),    # diff=-5, penalty=2, score=3.0
            make_resource(code="gold", skill="mining", level=6),    # diff=-4, penalty=1, score=4.0
        ]

        result = selector.select_optimal(char, resources, "mining")

        assert result is not None
        # gold (level 6) has the smallest penalty outside the +/- 3 range
        # diff=-4, penalty=1, score=4.0 -- highest among below-range candidates
        assert result.resource.code == "gold"

    def test_absolute_fallback_to_lowest(self, make_character, make_resource):
        """When nothing is gatherable (all too high), absolute fallback to lowest level."""
        selector = ResourceSelector()
        char = make_character(mining_level=1)
        resources = [
            make_resource(code="high1", skill="mining", level=50),
            make_resource(code="high2", skill="mining", level=30),
        ]

        result = selector.select_optimal(char, resources, "mining")

        assert result is not None
        # high1 at level 50 has diff=+49 (too high, score=0), high2 diff=+29 (too high, score=0)
        # Fallback: no gatherable (all above skill), so absolute fallback picks lowest
        assert result.resource.code == "high2"

    def test_selection_score_is_positive(self, make_character, make_resource):
        """The returned selection should have a positive score."""
        selector = ResourceSelector()
        char = make_character(mining_level=5)
        resources = [
            make_resource(code="copper", skill="mining", level=5),
        ]

        result = selector.select_optimal(char, resources, "mining")

        assert result is not None
        assert result.score > 0

    def test_selection_has_reason(self, make_character, make_resource):
        """The returned selection should have a non-empty reason string."""
        selector = ResourceSelector()
        char = make_character(mining_level=5)
        resources = [
            make_resource(code="copper", skill="mining", level=5),
        ]

        result = selector.select_optimal(char, resources, "mining")

        assert result is not None
        assert result.reason != ""


class TestResourceSelectorSkills:
    """Tests for different skill types."""

    def test_woodcutting_skill(self, make_character, make_resource):
        """ResourceSelector works with woodcutting skill."""
        selector = ResourceSelector()
        char = make_character(woodcutting_level=8)
        resources = [
            make_resource(code="ash_tree", skill="woodcutting", level=1),
            make_resource(code="spruce_tree", skill="woodcutting", level=7),
            make_resource(code="birch_tree", skill="woodcutting", level=10),
        ]

        result = selector.select_optimal(char, resources, "woodcutting")

        assert result is not None
        assert result.resource.skill == "woodcutting"

    def test_fishing_skill(self, make_character, make_resource):
        """ResourceSelector works with fishing skill."""
        selector = ResourceSelector()
        char = make_character(fishing_level=3)
        resources = [
            make_resource(code="shrimp_spot", skill="fishing", level=1),
            make_resource(code="trout_spot", skill="fishing", level=5),
        ]

        result = selector.select_optimal(char, resources, "fishing")

        assert result is not None
        assert result.resource.skill == "fishing"

    def test_mixed_skills_filtered(self, make_character, make_resource):
        """Only resources matching the requested skill are considered."""
        selector = ResourceSelector()
        char = make_character(mining_level=5, woodcutting_level=5)
        resources = [
            make_resource(code="copper", skill="mining", level=5),
            make_resource(code="ash_tree", skill="woodcutting", level=5),
        ]

        result = selector.select_optimal(char, resources, "mining")

        assert result is not None
        assert result.resource.code == "copper"
        assert result.resource.skill == "mining"


class TestResourceSelectorScoring:
    """Tests for the internal scoring logic."""

    def test_score_resource_too_high(self, make_resource):
        """Resources more than LEVEL_RANGE above skill get score 0."""
        selector = ResourceSelector()
        resource = make_resource(level=20)

        score, reason = selector._score_resource(resource, skill_level=5)

        assert score == 0.0

    def test_score_resource_in_range(self, make_resource):
        """Resources within range get a positive score."""
        selector = ResourceSelector()
        resource = make_resource(level=5)

        score, reason = selector._score_resource(resource, skill_level=5)

        assert score > 0

    def test_score_resource_above_gets_bonus(self, make_resource):
        """Resources at or above skill level within range get a bonus."""
        selector = ResourceSelector()
        above = make_resource(code="above", level=7)
        below = make_resource(code="below", level=3)

        score_above, _ = selector._score_resource(above, skill_level=5)
        score_below, _ = selector._score_resource(below, skill_level=5)

        assert score_above > score_below

    def test_score_resource_far_below(self, make_resource):
        """Resources far below skill level get a diminishing score."""
        selector = ResourceSelector()
        resource = make_resource(level=1)

        score, reason = selector._score_resource(resource, skill_level=20)

        assert score > 0
        assert "Below" in reason
