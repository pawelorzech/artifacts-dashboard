import logging

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_user_character_names
from app.database import async_session_factory
from app.engine.manager import AutomationManager
from app.models.automation import AutomationLog
from app.models.pipeline import PipelineConfig, PipelineRun
from app.schemas.automation import AutomationLogResponse
from app.schemas.pipeline import (
    PipelineConfigCreate,
    PipelineConfigDetailResponse,
    PipelineConfigResponse,
    PipelineConfigUpdate,
    PipelineRunResponse,
    PipelineStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_manager(request: Request) -> AutomationManager:
    manager: AutomationManager | None = getattr(request.app.state, "automation_manager", None)
    if manager is None:
        raise HTTPException(
            status_code=503,
            detail="Automation engine is not available",
        )
    return manager


# ---------------------------------------------------------------------------
# CRUD -- Pipeline Configs
# ---------------------------------------------------------------------------


def _pipeline_belongs_to_user(pipeline: PipelineConfig, user_chars: set[str]) -> bool:
    """Check if any character in the pipeline stages belongs to the user."""
    for stage in (pipeline.stages or []):
        for step in (stage.get("character_steps") or []):
            if step.get("character_name") in user_chars:
                return True
    return False


@router.get("/", response_model=list[PipelineConfigResponse])
async def list_pipelines(request: Request) -> list[PipelineConfigResponse]:
    """List pipeline configurations belonging to the current user."""
    user_chars = set(await get_user_character_names(request))
    async with async_session_factory() as db:
        stmt = select(PipelineConfig).order_by(PipelineConfig.id)
        result = await db.execute(stmt)
        configs = result.scalars().all()
        return [
            PipelineConfigResponse.model_validate(c)
            for c in configs
            if _pipeline_belongs_to_user(c, user_chars)
        ]


@router.post("/", response_model=PipelineConfigResponse, status_code=201)
async def create_pipeline(
    payload: PipelineConfigCreate,
    request: Request,
) -> PipelineConfigResponse:
    """Create a new pipeline configuration."""
    async with async_session_factory() as db:
        config = PipelineConfig(
            name=payload.name,
            description=payload.description,
            stages=[stage.model_dump() for stage in payload.stages],
            loop=payload.loop,
            max_loops=payload.max_loops,
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
        return PipelineConfigResponse.model_validate(config)


@router.get("/status/all", response_model=list[PipelineStatusResponse])
async def get_all_pipeline_statuses(request: Request) -> list[PipelineStatusResponse]:
    """Get live status for all active pipelines."""
    manager = _get_manager(request)
    return manager.get_all_pipeline_statuses()


@router.get("/{pipeline_id}", response_model=PipelineConfigDetailResponse)
async def get_pipeline(pipeline_id: int, request: Request) -> PipelineConfigDetailResponse:
    """Get a pipeline configuration with its run history."""
    async with async_session_factory() as db:
        stmt = (
            select(PipelineConfig)
            .options(selectinload(PipelineConfig.runs))
            .where(PipelineConfig.id == pipeline_id)
        )
        result = await db.execute(stmt)
        config = result.scalar_one_or_none()

        if config is None:
            raise HTTPException(status_code=404, detail="Pipeline config not found")

        return PipelineConfigDetailResponse(
            config=PipelineConfigResponse.model_validate(config),
            runs=[PipelineRunResponse.model_validate(r) for r in config.runs],
        )


@router.put("/{pipeline_id}", response_model=PipelineConfigResponse)
async def update_pipeline(
    pipeline_id: int,
    payload: PipelineConfigUpdate,
    request: Request,
) -> PipelineConfigResponse:
    """Update a pipeline configuration. Cannot update while running."""
    manager = _get_manager(request)
    if manager.is_pipeline_running(pipeline_id):
        raise HTTPException(
            status_code=409,
            detail="Cannot update a pipeline while it is running. Stop it first.",
        )

    async with async_session_factory() as db:
        config = await db.get(PipelineConfig, pipeline_id)
        if config is None:
            raise HTTPException(status_code=404, detail="Pipeline config not found")

        if payload.name is not None:
            config.name = payload.name
        if payload.description is not None:
            config.description = payload.description
        if payload.stages is not None:
            config.stages = [stage.model_dump() for stage in payload.stages]
        if payload.loop is not None:
            config.loop = payload.loop
        if payload.max_loops is not None:
            config.max_loops = payload.max_loops
        if payload.enabled is not None:
            config.enabled = payload.enabled

        await db.commit()
        await db.refresh(config)
        return PipelineConfigResponse.model_validate(config)


@router.delete("/{pipeline_id}", status_code=204)
async def delete_pipeline(pipeline_id: int, request: Request) -> None:
    """Delete a pipeline configuration. Cannot delete while running."""
    manager = _get_manager(request)
    if manager.is_pipeline_running(pipeline_id):
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a pipeline while it is running. Stop it first.",
        )

    async with async_session_factory() as db:
        config = await db.get(PipelineConfig, pipeline_id)
        if config is None:
            raise HTTPException(status_code=404, detail="Pipeline config not found")
        await db.delete(config)
        await db.commit()


# ---------------------------------------------------------------------------
# Control -- Start / Stop / Pause / Resume
# ---------------------------------------------------------------------------


@router.post("/{pipeline_id}/start", response_model=PipelineRunResponse)
async def start_pipeline(pipeline_id: int, request: Request) -> PipelineRunResponse:
    """Start a pipeline from its configuration."""
    manager = _get_manager(request)
    try:
        return await manager.start_pipeline(pipeline_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{pipeline_id}/stop", status_code=204)
async def stop_pipeline(pipeline_id: int, request: Request) -> None:
    """Stop a running pipeline."""
    manager = _get_manager(request)
    try:
        await manager.stop_pipeline(pipeline_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{pipeline_id}/pause", status_code=204)
async def pause_pipeline(pipeline_id: int, request: Request) -> None:
    """Pause a running pipeline."""
    manager = _get_manager(request)
    try:
        await manager.pause_pipeline(pipeline_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{pipeline_id}/resume", status_code=204)
async def resume_pipeline(pipeline_id: int, request: Request) -> None:
    """Resume a paused pipeline."""
    manager = _get_manager(request)
    try:
        await manager.resume_pipeline(pipeline_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Status & Logs
# ---------------------------------------------------------------------------


@router.get("/{pipeline_id}/status", response_model=PipelineStatusResponse)
async def get_pipeline_status(
    pipeline_id: int,
    request: Request,
) -> PipelineStatusResponse:
    """Get live status for a specific pipeline."""
    manager = _get_manager(request)
    status = manager.get_pipeline_status(pipeline_id)
    if status is None:
        async with async_session_factory() as db:
            config = await db.get(PipelineConfig, pipeline_id)
            if config is None:
                raise HTTPException(status_code=404, detail="Pipeline config not found")
        return PipelineStatusResponse(
            pipeline_id=pipeline_id,
            status="stopped",
            total_stages=len(config.stages),
        )
    return status


@router.get("/{pipeline_id}/logs", response_model=list[AutomationLogResponse])
async def get_pipeline_logs(
    pipeline_id: int,
    request: Request,
    limit: int = 100,
) -> list[AutomationLogResponse]:
    """Get recent logs for a pipeline (across all its runs)."""
    async with async_session_factory() as db:
        config = await db.get(PipelineConfig, pipeline_id)
        if config is None:
            raise HTTPException(status_code=404, detail="Pipeline config not found")

        stmt = (
            select(AutomationLog)
            .join(PipelineRun, AutomationLog.run_id == PipelineRun.id)
            .where(PipelineRun.pipeline_id == pipeline_id)
            .order_by(AutomationLog.created_at.desc())
            .limit(min(limit, 500))
        )
        result = await db.execute(stmt)
        logs = result.scalars().all()
        return [AutomationLogResponse.model_validate(log) for log in logs]
