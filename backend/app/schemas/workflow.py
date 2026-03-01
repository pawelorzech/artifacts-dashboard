from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Transition conditions
# ---------------------------------------------------------------------------


class TransitionConditionSchema(BaseModel):
    """Defines when a workflow step should transition to the next step."""

    type: str = Field(
        ...,
        description=(
            "Condition type: strategy_complete, loops_completed, inventory_full, "
            "inventory_item_count, bank_item_count, skill_level, gold_amount, "
            "actions_count, timer"
        ),
    )
    operator: str = Field(
        default=">=",
        description="Comparison operator: >=, <=, ==, >, <",
    )
    value: int = Field(
        default=0,
        description="Target value for the condition",
    )
    item_code: str = Field(
        default="",
        description="Item code (for inventory_item_count, bank_item_count)",
    )
    skill: str = Field(
        default="",
        description="Skill name (for skill_level condition)",
    )
    seconds: int = Field(
        default=0,
        ge=0,
        description="Duration in seconds (for timer condition)",
    )


# ---------------------------------------------------------------------------
# Workflow steps
# ---------------------------------------------------------------------------


class WorkflowStepSchema(BaseModel):
    """A single step within a workflow pipeline."""

    id: str = Field(..., description="Unique step identifier (e.g. 'step_1')")
    name: str = Field(..., min_length=1, max_length=100, description="Human-readable step name")
    strategy_type: str = Field(
        ...,
        description="Strategy type: combat, gathering, crafting, trading, task, leveling",
    )
    config: dict = Field(default_factory=dict, description="Strategy-specific configuration")
    transition: TransitionConditionSchema | None = Field(
        default=None,
        description="Condition to advance to the next step (None = run until strategy completes)",
    )


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class WorkflowConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    character_name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="")
    steps: list[WorkflowStepSchema] = Field(..., min_length=1)
    loop: bool = Field(default=False)
    max_loops: int = Field(default=0, ge=0)


class WorkflowConfigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    steps: list[WorkflowStepSchema] | None = Field(default=None, min_length=1)
    loop: bool | None = None
    max_loops: int | None = Field(default=None, ge=0)
    enabled: bool | None = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class WorkflowConfigResponse(BaseModel):
    id: int
    name: str
    character_name: str
    description: str
    steps: list[dict]
    loop: bool
    max_loops: int
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowRunResponse(BaseModel):
    id: int
    workflow_id: int
    status: str
    current_step_index: int
    current_step_id: str
    loop_count: int
    total_actions_count: int
    step_actions_count: int
    started_at: datetime
    stopped_at: datetime | None = None
    error_message: str | None = None
    step_history: list[dict] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class WorkflowStatusResponse(BaseModel):
    workflow_id: int
    character_name: str
    status: str
    run_id: int | None = None
    current_step_index: int = 0
    current_step_id: str = ""
    total_steps: int = 0
    loop_count: int = 0
    total_actions_count: int = 0
    step_actions_count: int = 0
    strategy_state: str = ""

    model_config = {"from_attributes": True}


class WorkflowConfigDetailResponse(BaseModel):
    """Workflow config with its run history."""

    config: WorkflowConfigResponse
    runs: list[WorkflowRunResponse] = Field(default_factory=list)
