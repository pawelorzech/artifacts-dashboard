"""Common fixtures for the Artifacts MMO Dashboard backend test suite."""

import pytest

from app.engine.pathfinder import Pathfinder
from app.schemas.game import (
    CharacterSchema,
    ContentSchema,
    CraftItem,
    CraftSchema,
    EffectSchema,
    InventorySlot,
    ItemSchema,
    MapSchema,
    MonsterSchema,
    ResourceSchema,
)


@pytest.fixture
def make_character():
    """Factory fixture that returns a CharacterSchema with sensible defaults.

    Any field can be overridden via keyword arguments.
    """

    def _factory(**overrides) -> CharacterSchema:
        defaults = {
            "name": "TestHero",
            "account": "test_account",
            "level": 10,
            "hp": 100,
            "max_hp": 100,
            "x": 0,
            "y": 0,
            "inventory_max_items": 20,
            "inventory": [],
            "mining_level": 5,
            "woodcutting_level": 5,
            "fishing_level": 5,
        }
        defaults.update(overrides)

        # Convert raw inventory dicts to InventorySlot instances if needed
        raw_inv = defaults.get("inventory", [])
        if raw_inv and isinstance(raw_inv[0], dict):
            defaults["inventory"] = [InventorySlot(**slot) for slot in raw_inv]

        return CharacterSchema(**defaults)

    return _factory


@pytest.fixture
def make_monster():
    """Factory fixture that returns a MonsterSchema with sensible defaults."""

    def _factory(**overrides) -> MonsterSchema:
        defaults = {
            "name": "Chicken",
            "code": "chicken",
            "level": 1,
            "hp": 50,
        }
        defaults.update(overrides)
        return MonsterSchema(**defaults)

    return _factory


@pytest.fixture
def make_resource():
    """Factory fixture that returns a ResourceSchema with sensible defaults."""

    def _factory(**overrides) -> ResourceSchema:
        defaults = {
            "name": "Copper Rocks",
            "code": "copper_rocks",
            "skill": "mining",
            "level": 1,
        }
        defaults.update(overrides)
        return ResourceSchema(**defaults)

    return _factory


@pytest.fixture
def make_map_tile():
    """Factory fixture that returns a MapSchema tile with content."""

    def _factory(
        x: int,
        y: int,
        content_type: str | None = None,
        content_code: str | None = None,
    ) -> MapSchema:
        content = None
        if content_type and content_code:
            content = ContentSchema(type=content_type, code=content_code)
        return MapSchema(x=x, y=y, content=content)

    return _factory


@pytest.fixture
def pathfinder_with_maps(make_map_tile):
    """Fixture that returns a Pathfinder pre-loaded with tiles.

    Usage::

        pf = pathfinder_with_maps([
            (0, 0, "monster", "chicken"),
            (5, 5, "bank", "bank"),
        ])
    """

    def _factory(tile_specs: list[tuple[int, int, str, str]]) -> Pathfinder:
        tiles = [make_map_tile(x, y, ct, cc) for x, y, ct, cc in tile_specs]
        pf = Pathfinder()
        pf.load_maps(tiles)
        return pf

    return _factory


@pytest.fixture
def make_item():
    """Factory fixture that returns an ItemSchema with sensible defaults."""

    def _factory(**overrides) -> ItemSchema:
        defaults = {
            "name": "Iron Sword",
            "code": "iron_sword",
            "level": 10,
            "type": "weapon",
            "subtype": "sword",
            "effects": [],
            "craft": None,
        }
        defaults.update(overrides)

        # Convert raw effect dicts to EffectSchema instances if needed
        raw_effects = defaults.get("effects", [])
        if raw_effects and isinstance(raw_effects[0], dict):
            defaults["effects"] = [EffectSchema(**e) for e in raw_effects]

        # Convert raw craft dict to CraftSchema if needed
        raw_craft = defaults.get("craft")
        if raw_craft and isinstance(raw_craft, dict):
            if "items" in raw_craft and raw_craft["items"]:
                if isinstance(raw_craft["items"][0], dict):
                    raw_craft["items"] = [CraftItem(**ci) for ci in raw_craft["items"]]
            defaults["craft"] = CraftSchema(**raw_craft)

        return ItemSchema(**defaults)

    return _factory
