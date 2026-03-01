from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Strategy-specific config schemas
# ---------------------------------------------------------------------------


class CombatConfig(BaseModel):
    """Configuration for the combat automation strategy."""

    monster_code: str = Field(..., description="Code of the monster to fight")
    auto_heal_threshold: int = Field(
        default=50,
        ge=0,
        le=100,
        description="Heal when HP drops below this percentage",
    )
    heal_method: str = Field(
        default="rest",
        description="Healing method: 'rest' or 'consumable'",
    )
    consumable_code: str | None = Field(
        default=None,
        description="Item code of the consumable to use for healing (required when heal_method='consumable')",
    )
    min_inventory_slots: int = Field(
        default=3,
        ge=0,
        description="Deposit loot when free inventory slots drops to this number",
    )
    deposit_loot: bool = Field(
        default=True,
        description="Whether to automatically deposit loot at the bank",
    )


class GatheringConfig(BaseModel):
    """Configuration for the gathering automation strategy."""

    resource_code: str = Field(..., description="Code of the resource to gather")
    deposit_on_full: bool = Field(
        default=True,
        description="Whether to deposit items at bank when inventory is full",
    )
    max_loops: int = Field(
        default=0,
        ge=0,
        description="Maximum gather-deposit cycles (0 = infinite)",
    )


class CraftingConfig(BaseModel):
    """Configuration for the crafting automation strategy."""

    item_code: str = Field(..., description="Code of the item to craft")
    quantity: int = Field(
        default=1,
        ge=1,
        description="How many items to craft in total",
    )
    gather_materials: bool = Field(
        default=False,
        description="If True, automatically gather missing materials",
    )
    recycle_excess: bool = Field(
        default=False,
        description="If True, recycle crafted items for XP grinding",
    )


class TradingConfig(BaseModel):
    """Configuration for the trading (Grand Exchange) automation strategy."""

    mode: str = Field(
        default="sell_loot",
        description="Trading mode: 'sell_loot', 'buy_materials', or 'flip'",
    )
    item_code: str = Field(..., description="Code of the item to trade")
    quantity: int = Field(
        default=1,
        ge=1,
        description="Quantity to trade",
    )
    min_price: int = Field(
        default=0,
        ge=0,
        description="Minimum acceptable price (for selling)",
    )
    max_price: int = Field(
        default=0,
        ge=0,
        description="Maximum acceptable price (for buying, 0 = no limit)",
    )


class TaskConfig(BaseModel):
    """Configuration for the task automation strategy."""

    max_tasks: int = Field(
        default=0,
        ge=0,
        description="Maximum tasks to complete (0 = infinite)",
    )
    auto_exchange: bool = Field(
        default=True,
        description="Automatically exchange task coins for rewards",
    )
    task_type: str = Field(
        default="",
        description="Preferred task type filter (empty = accept any)",
    )


class LevelingConfig(BaseModel):
    """Configuration for the leveling automation strategy."""

    target_skill: str = Field(
        default="",
        description="Specific skill to level (empty = auto-pick lowest skill)",
    )
    min_level: int = Field(
        default=0,
        ge=0,
        description="Minimum level threshold",
    )
    max_level: int = Field(
        default=0,
        ge=0,
        description="Stop when skill reaches this level (0 = no limit)",
    )


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class AutomationConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    character_name: str = Field(..., min_length=1, max_length=100)
    strategy_type: str = Field(
        ...,
        description="Strategy type: combat, gathering, crafting, trading, task, leveling",
    )
    config: dict = Field(default_factory=dict)


class AutomationConfigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    config: dict | None = None
    enabled: bool | None = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class AutomationConfigResponse(BaseModel):
    id: int
    name: str
    character_name: str
    strategy_type: str
    config: dict
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AutomationRunResponse(BaseModel):
    id: int
    config_id: int
    status: str
    started_at: datetime
    stopped_at: datetime | None = None
    actions_count: int
    error_message: str | None = None

    model_config = {"from_attributes": True}


class AutomationLogResponse(BaseModel):
    id: int
    run_id: int
    action_type: str
    details: dict
    success: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AutomationStatusResponse(BaseModel):
    config_id: int
    character_name: str
    strategy_type: str
    status: str
    run_id: int | None = None
    actions_count: int = 0
    latest_logs: list[AutomationLogResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class AutomationConfigDetailResponse(BaseModel):
    """Config with its run history."""

    config: AutomationConfigResponse
    runs: list[AutomationRunResponse] = Field(default_factory=list)
