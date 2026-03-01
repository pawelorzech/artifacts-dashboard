from datetime import datetime

from pydantic import BaseModel, Field


# --- Inventory ---


class InventorySlot(BaseModel):
    slot: int
    code: str
    quantity: int


# --- Crafting ---


class CraftItem(BaseModel):
    code: str
    quantity: int


class CraftSchema(BaseModel):
    skill: str | None = None
    level: int | None = None
    items: list[CraftItem] = Field(default_factory=list)
    quantity: int | None = None


# --- Effects ---


class EffectSchema(BaseModel):
    name: str = ""
    value: int = 0


# --- Items ---


class ItemSchema(BaseModel):
    name: str
    code: str
    level: int = 0
    type: str = ""
    subtype: str = ""
    description: str = ""
    effects: list[EffectSchema] = Field(default_factory=list)
    craft: CraftSchema | None = None


# --- Drops ---


class DropSchema(BaseModel):
    code: str
    rate: int = 0
    min_quantity: int = 0
    max_quantity: int = 0


# --- Monsters ---


class MonsterSchema(BaseModel):
    name: str
    code: str
    level: int = 0
    hp: int = 0
    attack_fire: int = 0
    attack_earth: int = 0
    attack_water: int = 0
    attack_air: int = 0
    res_fire: int = 0
    res_earth: int = 0
    res_water: int = 0
    res_air: int = 0
    min_gold: int = 0
    max_gold: int = 0
    drops: list[DropSchema] = Field(default_factory=list)


# --- Resources ---


class ResourceSchema(BaseModel):
    name: str
    code: str
    skill: str = ""
    level: int = 0
    drops: list[DropSchema] = Field(default_factory=list)


# --- Maps ---


class ContentSchema(BaseModel):
    type: str
    code: str


class MapSchema(BaseModel):
    name: str = ""
    x: int
    y: int
    content: ContentSchema | None = None


# --- Characters ---


class CharacterSchema(BaseModel):
    name: str
    account: str = ""
    skin: str = ""
    level: int = 0
    xp: int = 0
    max_xp: int = 0
    gold: int = 0
    speed: int = 0
    hp: int = 0
    max_hp: int = 0
    haste: int = 0
    critical_strike: int = 0
    stamina: int = 0

    # Attack stats
    attack_fire: int = 0
    attack_earth: int = 0
    attack_water: int = 0
    attack_air: int = 0

    # Damage stats
    dmg_fire: int = 0
    dmg_earth: int = 0
    dmg_water: int = 0
    dmg_air: int = 0

    # Resistance stats
    res_fire: int = 0
    res_earth: int = 0
    res_water: int = 0
    res_air: int = 0

    # Position
    x: int = 0
    y: int = 0

    # Cooldown
    cooldown: int = 0
    cooldown_expiration: datetime | None = None

    # Equipment slots
    weapon_slot: str = ""
    shield_slot: str = ""
    helmet_slot: str = ""
    body_armor_slot: str = ""
    leg_armor_slot: str = ""
    boots_slot: str = ""
    ring1_slot: str = ""
    ring2_slot: str = ""
    amulet_slot: str = ""
    artifact1_slot: str = ""
    artifact2_slot: str = ""
    artifact3_slot: str = ""
    utility1_slot: str = ""
    utility1_slot_quantity: int = 0
    utility2_slot: str = ""
    utility2_slot_quantity: int = 0

    # Inventory
    inventory_max_items: int = 0
    inventory: list[InventorySlot] = Field(default_factory=list)

    # Task
    task: str = ""
    task_type: str = ""
    task_progress: int = 0
    task_total: int = 0

    # Skill levels and XP
    mining_level: int = 0
    mining_xp: int = 0
    woodcutting_level: int = 0
    woodcutting_xp: int = 0
    fishing_level: int = 0
    fishing_xp: int = 0
    weaponcrafting_level: int = 0
    weaponcrafting_xp: int = 0
    gearcrafting_level: int = 0
    gearcrafting_xp: int = 0
    jewelrycrafting_level: int = 0
    jewelrycrafting_xp: int = 0
    cooking_level: int = 0
    cooking_xp: int = 0
    alchemy_level: int = 0
    alchemy_xp: int = 0


# --- Dashboard ---


class DashboardData(BaseModel):
    characters: list[CharacterSchema] = Field(default_factory=list)
    server_status: dict | None = None
