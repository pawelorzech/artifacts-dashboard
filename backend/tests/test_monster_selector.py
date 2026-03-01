"""Tests for MonsterSelector."""

from app.engine.decision.monster_selector import MonsterSelector


class TestMonsterSelectorSelectOptimal:
    """Tests for MonsterSelector.select_optimal()."""

    def test_select_optimal_near_level(self, make_character, make_monster):
        """Prefers monsters within +/- 5 levels of the character."""
        selector = MonsterSelector()
        char = make_character(level=10)
        monsters = [
            make_monster(code="chicken", level=1),
            make_monster(code="wolf", level=8),
            make_monster(code="bear", level=12),
            make_monster(code="dragon", level=30),
        ]

        result = selector.select_optimal(char, monsters)

        # wolf (8) and bear (12) are within +/- 5 of level 10
        # bear (12) should be preferred because higher level = more XP
        assert result is not None
        assert result.code == "bear"

    def test_select_optimal_no_monsters(self, make_character):
        """Returns None for an empty monster list."""
        selector = MonsterSelector()
        char = make_character(level=10)

        result = selector.select_optimal(char, [])

        assert result is None

    def test_prefer_higher_level(self, make_character, make_monster):
        """Among candidates within range, prefers higher level."""
        selector = MonsterSelector()
        char = make_character(level=10)
        monsters = [
            make_monster(code="wolf", level=8),
            make_monster(code="ogre", level=13),
            make_monster(code="bear", level=11),
        ]

        result = selector.select_optimal(char, monsters)

        # All within +/- 5 of 10; ogre at 13 is highest
        assert result is not None
        assert result.code == "ogre"

    def test_select_exact_level(self, make_character, make_monster):
        """A monster at exactly the character's level should be a valid candidate."""
        selector = MonsterSelector()
        char = make_character(level=5)
        monsters = [
            make_monster(code="goblin", level=5),
        ]

        result = selector.select_optimal(char, monsters)

        assert result is not None
        assert result.code == "goblin"

    def test_fallback_below_level(self, make_character, make_monster):
        """When no monsters are in range, falls back to the best below-level monster."""
        selector = MonsterSelector()
        char = make_character(level=20)
        monsters = [
            make_monster(code="chicken", level=1),
            make_monster(code="rat", level=3),
            make_monster(code="wolf", level=10),
        ]

        result = selector.select_optimal(char, monsters)

        # All are more than 5 levels below 20, so fallback to highest below-level
        assert result is not None
        assert result.code == "wolf"

    def test_fallback_all_above(self, make_character, make_monster):
        """When all monsters are above the character, picks the lowest-level one."""
        selector = MonsterSelector()
        char = make_character(level=1)
        monsters = [
            make_monster(code="dragon", level=30),
            make_monster(code="demon", level=25),
            make_monster(code="ogre", level=20),
        ]

        result = selector.select_optimal(char, monsters)

        # All above and out of range; within range [1-5..1+5] = [-4..6] none qualify.
        # No monsters at or below level 1, so absolute fallback to lowest
        assert result is not None
        assert result.code == "ogre"

    def test_boundary_level_included(self, make_character, make_monster):
        """Monsters exactly 5 levels away should be included in candidates."""
        selector = MonsterSelector()
        char = make_character(level=10)
        monsters = [
            make_monster(code="exactly_minus_5", level=5),
            make_monster(code="exactly_plus_5", level=15),
        ]

        result = selector.select_optimal(char, monsters)

        # Both are exactly at the boundary; prefer higher level
        assert result is not None
        assert result.code == "exactly_plus_5"

    def test_single_monster(self, make_character, make_monster):
        """With a single monster, it should always be selected."""
        selector = MonsterSelector()
        char = make_character(level=10)
        monsters = [make_monster(code="solo", level=50)]

        result = selector.select_optimal(char, monsters)

        assert result is not None
        assert result.code == "solo"


class TestMonsterSelectorFilterByCode:
    """Tests for MonsterSelector.filter_by_code()."""

    def test_filter_by_code_found(self, make_monster):
        """filter_by_code should return the matching monster."""
        selector = MonsterSelector()
        monsters = [
            make_monster(code="chicken"),
            make_monster(code="wolf"),
        ]

        result = selector.filter_by_code(monsters, "wolf")

        assert result is not None
        assert result.code == "wolf"

    def test_filter_by_code_not_found(self, make_monster):
        """filter_by_code should return None when no monster matches."""
        selector = MonsterSelector()
        monsters = [make_monster(code="chicken")]

        result = selector.filter_by_code(monsters, "dragon")

        assert result is None

    def test_filter_by_code_empty_list(self):
        """filter_by_code should return None for an empty list."""
        selector = MonsterSelector()

        result = selector.filter_by_code([], "chicken")

        assert result is None
