import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_user_character_names
from app.database import async_session_factory
from app.engine.manager import AutomationManager
from app.models.automation import AutomationConfig, AutomationLog, AutomationRun
from app.schemas.automation import (
    AutomationConfigCreate,
    AutomationConfigDetailResponse,
    AutomationConfigResponse,
    AutomationConfigUpdate,
    AutomationLogResponse,
    AutomationRunResponse,
    AutomationStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/automations", tags=["automations"])


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
# CRUD -- Automation Configs
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[AutomationConfigResponse])
async def list_configs(request: Request) -> list[AutomationConfigResponse]:
    """List automation configurations belonging to the current user."""
    user_chars = await get_user_character_names(request)
    async with async_session_factory() as db:
        stmt = (
            select(AutomationConfig)
            .where(AutomationConfig.character_name.in_(user_chars))
            .order_by(AutomationConfig.id)
        )
        result = await db.execute(stmt)
        configs = result.scalars().all()
        return [AutomationConfigResponse.model_validate(c) for c in configs]


@router.post("/", response_model=AutomationConfigResponse, status_code=201)
async def create_config(
    payload: AutomationConfigCreate,
    request: Request,
) -> AutomationConfigResponse:
    """Create a new automation configuration."""
    async with async_session_factory() as db:
        config = AutomationConfig(
            name=payload.name,
            character_name=payload.character_name,
            strategy_type=payload.strategy_type,
            config=payload.config,
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
        return AutomationConfigResponse.model_validate(config)


@router.get("/{config_id}", response_model=AutomationConfigDetailResponse)
async def get_config(config_id: int, request: Request) -> AutomationConfigDetailResponse:
    """Get an automation configuration with its run history."""
    async with async_session_factory() as db:
        stmt = (
            select(AutomationConfig)
            .options(selectinload(AutomationConfig.runs))
            .where(AutomationConfig.id == config_id)
        )
        result = await db.execute(stmt)
        config = result.scalar_one_or_none()

        if config is None:
            raise HTTPException(status_code=404, detail="Automation config not found")

        return AutomationConfigDetailResponse(
            config=AutomationConfigResponse.model_validate(config),
            runs=[AutomationRunResponse.model_validate(r) for r in config.runs],
        )


@router.put("/{config_id}", response_model=AutomationConfigResponse)
async def update_config(
    config_id: int,
    payload: AutomationConfigUpdate,
    request: Request,
) -> AutomationConfigResponse:
    """Update an automation configuration.

    Cannot update a configuration that has an active runner.
    """
    manager = _get_manager(request)
    if manager.is_running(config_id):
        raise HTTPException(
            status_code=409,
            detail="Cannot update a config while its automation is running. Stop it first.",
        )

    async with async_session_factory() as db:
        config = await db.get(AutomationConfig, config_id)
        if config is None:
            raise HTTPException(status_code=404, detail="Automation config not found")

        if payload.name is not None:
            config.name = payload.name
        if payload.config is not None:
            config.config = payload.config
        if payload.enabled is not None:
            config.enabled = payload.enabled

        await db.commit()
        await db.refresh(config)
        return AutomationConfigResponse.model_validate(config)


@router.delete("/{config_id}", status_code=204)
async def delete_config(config_id: int, request: Request) -> None:
    """Delete an automation configuration and all its runs/logs.

    Cannot delete a configuration that has an active runner.
    """
    manager = _get_manager(request)
    if manager.is_running(config_id):
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a config while its automation is running. Stop it first.",
        )

    async with async_session_factory() as db:
        config = await db.get(AutomationConfig, config_id)
        if config is None:
            raise HTTPException(status_code=404, detail="Automation config not found")

        await db.delete(config)
        await db.commit()


# ---------------------------------------------------------------------------
# Control -- Start / Stop / Pause / Resume
# ---------------------------------------------------------------------------


@router.post("/{config_id}/start", response_model=AutomationRunResponse)
async def start_automation(config_id: int, request: Request) -> AutomationRunResponse:
    """Start an automation from its configuration."""
    manager = _get_manager(request)
    try:
        return await manager.start(config_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{config_id}/stop", status_code=204)
async def stop_automation(config_id: int, request: Request) -> None:
    """Stop a running automation."""
    manager = _get_manager(request)
    try:
        await manager.stop(config_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{config_id}/pause", status_code=204)
async def pause_automation(config_id: int, request: Request) -> None:
    """Pause a running automation."""
    manager = _get_manager(request)
    try:
        await manager.pause(config_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{config_id}/resume", status_code=204)
async def resume_automation(config_id: int, request: Request) -> None:
    """Resume a paused automation."""
    manager = _get_manager(request)
    try:
        await manager.resume(config_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Status & Logs
# ---------------------------------------------------------------------------


@router.get("/status/all", response_model=list[AutomationStatusResponse])
async def get_all_statuses(request: Request) -> list[AutomationStatusResponse]:
    """Get live status for active automations belonging to the current user."""
    manager = _get_manager(request)
    user_chars = set(await get_user_character_names(request))
    return [s for s in manager.get_all_statuses() if s.character_name in user_chars]


@router.get("/{config_id}/status", response_model=AutomationStatusResponse)
async def get_automation_status(
    config_id: int,
    request: Request,
) -> AutomationStatusResponse:
    """Get live status for a specific automation."""
    manager = _get_manager(request)
    status = manager.get_status(config_id)
    if status is None:
        # Check if the config exists at all
        async with async_session_factory() as db:
            config = await db.get(AutomationConfig, config_id)
            if config is None:
                raise HTTPException(status_code=404, detail="Automation config not found")
        # Config exists but no active runner
        return AutomationStatusResponse(
            config_id=config_id,
            character_name=config.character_name,
            strategy_type=config.strategy_type,
            status="stopped",
        )
    return status


@router.get("/{config_id}/logs", response_model=list[AutomationLogResponse])
async def get_logs(
    config_id: int,
    request: Request,
    limit: int = 100,
) -> list[AutomationLogResponse]:
    """Get recent logs for an automation config (across all its runs)."""
    async with async_session_factory() as db:
        # Verify config exists
        config = await db.get(AutomationConfig, config_id)
        if config is None:
            raise HTTPException(status_code=404, detail="Automation config not found")

        # Fetch logs for all runs belonging to this config
        stmt = (
            select(AutomationLog)
            .join(AutomationRun, AutomationLog.run_id == AutomationRun.id)
            .where(AutomationRun.config_id == config_id)
            .order_by(AutomationLog.created_at.desc())
            .limit(min(limit, 500))
        )
        result = await db.execute(stmt)
        logs = result.scalars().all()
        return [AutomationLogResponse.model_validate(log) for log in logs]
