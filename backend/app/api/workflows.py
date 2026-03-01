import logging

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_user_character_names
from app.database import async_session_factory
from app.engine.manager import AutomationManager
from app.models.automation import AutomationLog
from app.models.workflow import WorkflowConfig, WorkflowRun
from app.schemas.automation import AutomationLogResponse
from app.schemas.workflow import (
    WorkflowConfigCreate,
    WorkflowConfigDetailResponse,
    WorkflowConfigResponse,
    WorkflowConfigUpdate,
    WorkflowRunResponse,
    WorkflowStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


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
# CRUD -- Workflow Configs
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[WorkflowConfigResponse])
async def list_workflows(request: Request) -> list[WorkflowConfigResponse]:
    """List workflow configurations belonging to the current user."""
    user_chars = await get_user_character_names(request)
    async with async_session_factory() as db:
        stmt = (
            select(WorkflowConfig)
            .where(WorkflowConfig.character_name.in_(user_chars))
            .order_by(WorkflowConfig.id)
        )
        result = await db.execute(stmt)
        configs = result.scalars().all()
        return [WorkflowConfigResponse.model_validate(c) for c in configs]


@router.post("/", response_model=WorkflowConfigResponse, status_code=201)
async def create_workflow(
    payload: WorkflowConfigCreate,
    request: Request,
) -> WorkflowConfigResponse:
    """Create a new workflow configuration."""
    async with async_session_factory() as db:
        config = WorkflowConfig(
            name=payload.name,
            character_name=payload.character_name,
            description=payload.description,
            steps=[step.model_dump() for step in payload.steps],
            loop=payload.loop,
            max_loops=payload.max_loops,
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
        return WorkflowConfigResponse.model_validate(config)


@router.get("/status/all", response_model=list[WorkflowStatusResponse])
async def get_all_workflow_statuses(request: Request) -> list[WorkflowStatusResponse]:
    """Get live status for all active workflows."""
    manager = _get_manager(request)
    return manager.get_all_workflow_statuses()


@router.get("/{workflow_id}", response_model=WorkflowConfigDetailResponse)
async def get_workflow(workflow_id: int, request: Request) -> WorkflowConfigDetailResponse:
    """Get a workflow configuration with its run history."""
    async with async_session_factory() as db:
        stmt = (
            select(WorkflowConfig)
            .options(selectinload(WorkflowConfig.runs))
            .where(WorkflowConfig.id == workflow_id)
        )
        result = await db.execute(stmt)
        config = result.scalar_one_or_none()

        if config is None:
            raise HTTPException(status_code=404, detail="Workflow config not found")

        return WorkflowConfigDetailResponse(
            config=WorkflowConfigResponse.model_validate(config),
            runs=[WorkflowRunResponse.model_validate(r) for r in config.runs],
        )


@router.put("/{workflow_id}", response_model=WorkflowConfigResponse)
async def update_workflow(
    workflow_id: int,
    payload: WorkflowConfigUpdate,
    request: Request,
) -> WorkflowConfigResponse:
    """Update a workflow configuration. Cannot update while running."""
    manager = _get_manager(request)
    if manager.is_workflow_running(workflow_id):
        raise HTTPException(
            status_code=409,
            detail="Cannot update a workflow while it is running. Stop it first.",
        )

    async with async_session_factory() as db:
        config = await db.get(WorkflowConfig, workflow_id)
        if config is None:
            raise HTTPException(status_code=404, detail="Workflow config not found")

        if payload.name is not None:
            config.name = payload.name
        if payload.description is not None:
            config.description = payload.description
        if payload.steps is not None:
            config.steps = [step.model_dump() for step in payload.steps]
        if payload.loop is not None:
            config.loop = payload.loop
        if payload.max_loops is not None:
            config.max_loops = payload.max_loops
        if payload.enabled is not None:
            config.enabled = payload.enabled

        await db.commit()
        await db.refresh(config)
        return WorkflowConfigResponse.model_validate(config)


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: int, request: Request) -> None:
    """Delete a workflow configuration. Cannot delete while running."""
    manager = _get_manager(request)
    if manager.is_workflow_running(workflow_id):
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a workflow while it is running. Stop it first.",
        )

    async with async_session_factory() as db:
        config = await db.get(WorkflowConfig, workflow_id)
        if config is None:
            raise HTTPException(status_code=404, detail="Workflow config not found")
        await db.delete(config)
        await db.commit()


# ---------------------------------------------------------------------------
# Control -- Start / Stop / Pause / Resume
# ---------------------------------------------------------------------------


@router.post("/{workflow_id}/start", response_model=WorkflowRunResponse)
async def start_workflow(workflow_id: int, request: Request) -> WorkflowRunResponse:
    """Start a workflow from its configuration."""
    manager = _get_manager(request)
    try:
        return await manager.start_workflow(workflow_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{workflow_id}/stop", status_code=204)
async def stop_workflow(workflow_id: int, request: Request) -> None:
    """Stop a running workflow."""
    manager = _get_manager(request)
    try:
        await manager.stop_workflow(workflow_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{workflow_id}/pause", status_code=204)
async def pause_workflow(workflow_id: int, request: Request) -> None:
    """Pause a running workflow."""
    manager = _get_manager(request)
    try:
        await manager.pause_workflow(workflow_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{workflow_id}/resume", status_code=204)
async def resume_workflow(workflow_id: int, request: Request) -> None:
    """Resume a paused workflow."""
    manager = _get_manager(request)
    try:
        await manager.resume_workflow(workflow_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Status & Logs
# ---------------------------------------------------------------------------


@router.get("/{workflow_id}/status", response_model=WorkflowStatusResponse)
async def get_workflow_status(
    workflow_id: int,
    request: Request,
) -> WorkflowStatusResponse:
    """Get live status for a specific workflow."""
    manager = _get_manager(request)
    status = manager.get_workflow_status(workflow_id)
    if status is None:
        async with async_session_factory() as db:
            config = await db.get(WorkflowConfig, workflow_id)
            if config is None:
                raise HTTPException(status_code=404, detail="Workflow config not found")
        return WorkflowStatusResponse(
            workflow_id=workflow_id,
            character_name=config.character_name,
            status="stopped",
            total_steps=len(config.steps),
        )
    return status


@router.get("/{workflow_id}/logs", response_model=list[AutomationLogResponse])
async def get_workflow_logs(
    workflow_id: int,
    request: Request,
    limit: int = 100,
) -> list[AutomationLogResponse]:
    """Get recent logs for a workflow (across all its runs)."""
    async with async_session_factory() as db:
        config = await db.get(WorkflowConfig, workflow_id)
        if config is None:
            raise HTTPException(status_code=404, detail="Workflow config not found")

        # Fetch logs for all runs belonging to this workflow
        stmt = (
            select(AutomationLog)
            .join(WorkflowRun, AutomationLog.run_id == WorkflowRun.id)
            .where(WorkflowRun.workflow_id == workflow_id)
            .order_by(AutomationLog.created_at.desc())
            .limit(min(limit, 500))
        )
        result = await db.execute(stmt)
        logs = result.scalars().all()
        return [AutomationLogResponse.model_validate(log) for log in logs]
