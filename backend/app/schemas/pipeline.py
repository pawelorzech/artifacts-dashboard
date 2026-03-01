from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.workflow import TransitionConditionSchema


# ---------------------------------------------------------------------------
# Character step within a stage
# ---------------------------------------------------------------------------


class CharacterStepSchema(BaseModel):
    """A single character's work within a pipeline stage."""

    id: str = Field(..., description="Unique step identifier (e.g. 'cs_1a')")
    character_name: str = Field(..., min_length=1, max_length=100)
    strategy_type: str = Field(
        ...,
        description="Strategy type: combat, gathering, crafting, trading, task, leveling",
    )
    config: dict = Field(default_factory=dict, description="Strategy-specific configuration")
    transition: TransitionConditionSchema | None = Field(
        default=None,
        description="Condition for this character-step to be considered done",
    )


# ---------------------------------------------------------------------------
# Pipeline stage
# ---------------------------------------------------------------------------


class PipelineStageSchema(BaseModel):
    """A stage in the pipeline — character steps within it run in parallel."""

    id: str = Field(..., description="Unique stage identifier (e.g. 'stage_1')")
    name: str = Field(..., min_length=1, max_length=100)
    character_steps: list[CharacterStepSchema] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class PipelineConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="")
    stages: list[PipelineStageSchema] = Field(..., min_length=1)
    loop: bool = Field(default=False)
    max_loops: int = Field(default=0, ge=0)


class PipelineConfigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    stages: list[PipelineStageSchema] | None = Field(default=None, min_length=1)
    loop: bool | None = None
    max_loops: int | None = Field(default=None, ge=0)
    enabled: bool | None = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class PipelineConfigResponse(BaseModel):
    id: int
    name: str
    description: str
    stages: list[dict]
    loop: bool
    max_loops: int
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PipelineRunResponse(BaseModel):
    id: int
    pipeline_id: int
    status: str
    current_stage_index: int
    current_stage_id: str
    loop_count: int
    total_actions_count: int
    character_states: dict
    stage_history: list[dict] = Field(default_factory=list)
    started_at: datetime
    stopped_at: datetime | None = None
    error_message: str | None = None

    model_config = {"from_attributes": True}


class CharacterStateResponse(BaseModel):
    """Status of a single character within an active pipeline."""

    character_name: str
    status: str  # running, completed, error, idle
    step_id: str = ""
    actions_count: int = 0
    strategy_state: str = ""
    error: str | None = None


class PipelineStatusResponse(BaseModel):
    pipeline_id: int
    status: str
    run_id: int | None = None
    current_stage_index: int = 0
    current_stage_id: str = ""
    total_stages: int = 0
    loop_count: int = 0
    total_actions_count: int = 0
    character_states: list[CharacterStateResponse] = Field(default_factory=list)


class PipelineConfigDetailResponse(BaseModel):
    """Pipeline config with its run history."""

    config: PipelineConfigResponse
    runs: list[PipelineRunResponse] = Field(default_factory=list)
