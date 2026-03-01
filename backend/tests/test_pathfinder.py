"""Tests for the Pathfinder spatial index."""

from app.engine.pathfinder import Pathfinder
from app.schemas.game import ContentSchema, MapSchema


class TestPathfinderFindNearest:
    """Tests for Pathfinder.find_nearest()."""

    def test_find_nearest(self, pathfinder_with_maps):
        """find_nearest should return the closest tile matching type and code."""
        pf = pathfinder_with_maps([
            (10, 10, "monster", "chicken"),
            (2, 2, "monster", "chicken"),
            (20, 20, "monster", "chicken"),
        ])
        result = pf.find_nearest(0, 0, "monster", "chicken")
        assert result == (2, 2)

    def test_find_nearest_prefers_manhattan_distance(self, pathfinder_with_maps):
        """find_nearest should use Manhattan distance, not Euclidean."""
        pf = pathfinder_with_maps([
            (3, 0, "monster", "wolf"),   # Manhattan=3
            (2, 2, "monster", "wolf"),   # Manhattan=4
        ])
        result = pf.find_nearest(0, 0, "monster", "wolf")
        assert result == (3, 0)

    def test_find_nearest_no_match(self, pathfinder_with_maps):
        """find_nearest should return None when no tile matches."""
        pf = pathfinder_with_maps([
            (1, 1, "monster", "chicken"),
        ])
        result = pf.find_nearest(0, 0, "monster", "dragon")
        assert result is None

    def test_find_nearest_empty_map(self):
        """find_nearest should return None on an empty map."""
        pf = Pathfinder()
        result = pf.find_nearest(0, 0, "monster", "chicken")
        assert result is None

    def test_find_nearest_ignores_different_type(self, pathfinder_with_maps):
        """find_nearest should not match tiles with a different content type."""
        pf = pathfinder_with_maps([
            (1, 1, "resource", "chicken"),  # same code, different type
        ])
        result = pf.find_nearest(0, 0, "monster", "chicken")
        assert result is None

    def test_find_nearest_at_origin(self, pathfinder_with_maps):
        """find_nearest should return a tile at (0, 0) if it matches."""
        pf = pathfinder_with_maps([
            (0, 0, "bank", "bank"),
            (5, 5, "bank", "bank"),
        ])
        result = pf.find_nearest(0, 0, "bank", "bank")
        assert result == (0, 0)


class TestPathfinderFindNearestByType:
    """Tests for Pathfinder.find_nearest_by_type()."""

    def test_find_nearest_by_type(self, pathfinder_with_maps):
        """find_nearest_by_type should find by type regardless of code."""
        pf = pathfinder_with_maps([
            (10, 10, "bank", "city_bank"),
            (3, 3, "bank", "village_bank"),
        ])
        result = pf.find_nearest_by_type(0, 0, "bank")
        assert result == (3, 3)

    def test_find_nearest_by_type_no_match(self, pathfinder_with_maps):
        """find_nearest_by_type should return None when no type matches."""
        pf = pathfinder_with_maps([
            (1, 1, "monster", "chicken"),
        ])
        result = pf.find_nearest_by_type(0, 0, "bank")
        assert result is None


class TestPathfinderFindAll:
    """Tests for Pathfinder.find_all()."""

    def test_find_all(self, pathfinder_with_maps):
        """find_all should return all tiles matching type and code."""
        pf = pathfinder_with_maps([
            (1, 1, "monster", "chicken"),
            (5, 5, "monster", "chicken"),
            (3, 3, "monster", "wolf"),
            (7, 7, "resource", "copper"),
        ])
        result = pf.find_all("monster", "chicken")
        assert sorted(result) == [(1, 1), (5, 5)]

    def test_find_all_by_type_only(self, pathfinder_with_maps):
        """find_all with code=None should return all tiles of the given type."""
        pf = pathfinder_with_maps([
            (1, 1, "monster", "chicken"),
            (5, 5, "monster", "wolf"),
            (7, 7, "resource", "copper"),
        ])
        result = pf.find_all("monster")
        assert sorted(result) == [(1, 1), (5, 5)]

    def test_find_all_no_match(self, pathfinder_with_maps):
        """find_all should return an empty list when nothing matches."""
        pf = pathfinder_with_maps([
            (1, 1, "monster", "chicken"),
        ])
        result = pf.find_all("bank", "bank")
        assert result == []

    def test_find_all_empty_map(self):
        """find_all should return an empty list on an empty map."""
        pf = Pathfinder()
        result = pf.find_all("monster")
        assert result == []


class TestPathfinderTileHasContent:
    """Tests for Pathfinder.tile_has_content() and tile_has_content_type()."""

    def test_tile_has_content(self, pathfinder_with_maps):
        """tile_has_content should return True for an exact match."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
        ])
        assert pf.tile_has_content(5, 5, "monster", "chicken") is True

    def test_tile_has_content_wrong_code(self, pathfinder_with_maps):
        """tile_has_content should return False for a code mismatch."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
        ])
        assert pf.tile_has_content(5, 5, "monster", "wolf") is False

    def test_tile_has_content_missing_tile(self):
        """tile_has_content should return False for a non-existent tile."""
        pf = Pathfinder()
        assert pf.tile_has_content(99, 99, "monster", "chicken") is False

    def test_tile_has_content_no_content(self, make_map_tile):
        """tile_has_content should return False for a tile with no content."""
        pf = Pathfinder()
        tile = make_map_tile(1, 1)  # No content_type/content_code
        pf.load_maps([tile])
        assert pf.tile_has_content(1, 1, "monster", "chicken") is False

    def test_tile_has_content_type(self, pathfinder_with_maps):
        """tile_has_content_type should match on type alone."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
        ])
        assert pf.tile_has_content_type(5, 5, "monster") is True
        assert pf.tile_has_content_type(5, 5, "bank") is False


class TestPathfinderMisc:
    """Tests for miscellaneous Pathfinder methods."""

    def test_is_loaded_false_initially(self):
        """is_loaded should be False before any maps are loaded."""
        pf = Pathfinder()
        assert pf.is_loaded is False

    def test_is_loaded_true_after_load(self, pathfinder_with_maps):
        """is_loaded should be True after loading maps."""
        pf = pathfinder_with_maps([(0, 0, "bank", "bank")])
        assert pf.is_loaded is True

    def test_get_tile(self, pathfinder_with_maps):
        """get_tile should return the MapSchema at the given coordinates."""
        pf = pathfinder_with_maps([(3, 7, "monster", "chicken")])
        tile = pf.get_tile(3, 7)
        assert tile is not None
        assert tile.x == 3
        assert tile.y == 7
        assert tile.content.code == "chicken"

    def test_get_tile_missing(self):
        """get_tile should return None for coordinates not in the index."""
        pf = Pathfinder()
        assert pf.get_tile(99, 99) is None

    def test_manhattan_distance(self):
        """manhattan_distance should compute |x1-x2| + |y1-y2|."""
        assert Pathfinder.manhattan_distance(0, 0, 3, 4) == 7
        assert Pathfinder.manhattan_distance(5, 5, 5, 5) == 0
        assert Pathfinder.manhattan_distance(-2, 3, 1, -1) == 7
