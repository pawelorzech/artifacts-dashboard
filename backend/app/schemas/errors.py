"""Pydantic schemas for the errors API."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AppErrorResponse(BaseModel):
    id: int
    severity: str
    source: str
    error_type: str
    message: str
    stack_trace: str | None = None
    context: dict[str, Any] | None = None
    correlation_id: str | None = None
    resolved: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AppErrorListResponse(BaseModel):
    errors: list[AppErrorResponse]
    total: int
    page: int
    pages: int


class AppErrorStats(BaseModel):
    total: int = 0
    unresolved: int = 0
    last_hour: int = 0
    by_severity: dict[str, int] = Field(default_factory=dict)
    by_source: dict[str, int] = Field(default_factory=dict)


class FrontendErrorReport(BaseModel):
    error_type: str = "FrontendError"
    message: str
    stack_trace: str | None = None
    context: dict[str, Any] | None = None
    severity: str = "error"
