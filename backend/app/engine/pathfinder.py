import logging

from app.schemas.game import MapSchema

logger = logging.getLogger(__name__)


class Pathfinder:
    """Spatial index over the game map for finding tiles by content.

    Uses Manhattan distance (since the Artifacts MMO API ``move`` action
    performs a direct teleport with a cooldown proportional to Manhattan
    distance). A* path-finding over walkable tiles is therefore unnecessary;
    the optimal strategy is always to move directly to the target.
    """

    def __init__(self) -> None:
        self._maps: list[MapSchema] = []
        self._map_index: dict[tuple[int, int], MapSchema] = {}

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    def load_maps(self, maps: list[MapSchema]) -> None:
        """Load map data (typically from the game data cache)."""
        self._maps = list(maps)
        self._map_index = {(m.x, m.y): m for m in self._maps}
        logger.info("Pathfinder loaded %d map tiles", len(self._maps))

    @property
    def is_loaded(self) -> bool:
        return len(self._maps) > 0

    # ------------------------------------------------------------------
    # Tile lookup
    # ------------------------------------------------------------------

    def get_tile(self, x: int, y: int) -> MapSchema | None:
        """Return the map tile at the given coordinates, or None."""
        return self._map_index.get((x, y))

    def tile_has_content(self, x: int, y: int, content_type: str, content_code: str) -> bool:
        """Check whether the tile at (x, y) has the specified content."""
        tile = self._map_index.get((x, y))
        if tile is None or tile.content is None:
            return False
        return tile.content.type == content_type and tile.content.code == content_code

    def tile_has_content_type(self, x: int, y: int, content_type: str) -> bool:
        """Check whether the tile at (x, y) has any content of the given type."""
        tile = self._map_index.get((x, y))
        if tile is None or tile.content is None:
            return False
        return tile.content.type == content_type

    # ------------------------------------------------------------------
    # Nearest-tile search
    # ------------------------------------------------------------------

    def find_nearest(
        self,
        from_x: int,
        from_y: int,
        content_type: str,
        content_code: str,
    ) -> tuple[int, int] | None:
        """Find the nearest tile whose content matches type *and* code.

        Returns ``(x, y)`` of the closest match, or ``None`` if not found.
        """
        best: tuple[int, int] | None = None
        best_dist = float("inf")

        for m in self._maps:
            if (
                m.content is not None
                and m.content.type == content_type
                and m.content.code == content_code
            ):
                dist = abs(m.x - from_x) + abs(m.y - from_y)
                if dist < best_dist:
                    best_dist = dist
                    best = (m.x, m.y)

        return best

    def find_nearest_by_type(
        self,
        from_x: int,
        from_y: int,
        content_type: str,
    ) -> tuple[int, int] | None:
        """Find the nearest tile that has any content of *content_type*.

        Returns ``(x, y)`` of the closest match, or ``None`` if not found.
        """
        best: tuple[int, int] | None = None
        best_dist = float("inf")

        for m in self._maps:
            if m.content is not None and m.content.type == content_type:
                dist = abs(m.x - from_x) + abs(m.y - from_y)
                if dist < best_dist:
                    best_dist = dist
                    best = (m.x, m.y)

        return best

    def find_all(
        self,
        content_type: str,
        content_code: str | None = None,
    ) -> list[tuple[int, int]]:
        """Return coordinates of all tiles matching the given content filter."""
        results: list[tuple[int, int]] = []
        for m in self._maps:
            if m.content is None:
                continue
            if m.content.type != content_type:
                continue
            if content_code is not None and m.content.code != content_code:
                continue
            results.append((m.x, m.y))
        return results

    @staticmethod
    def manhattan_distance(x1: int, y1: int, x2: int, y2: int) -> int:
        """Compute the Manhattan distance between two points."""
        return abs(x1 - x2) + abs(y1 - y2)
