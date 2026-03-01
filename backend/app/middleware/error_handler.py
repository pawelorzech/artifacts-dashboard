"""Global error-handling middleware.

Sets a per-request correlation ID and catches unhandled exceptions,
logging them to the database (and Sentry when configured).
"""

from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.database import async_session_factory
from app.services.error_service import hash_token, log_error, new_correlation_id

logger = logging.getLogger(__name__)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        cid = new_correlation_id()
        start = time.monotonic()

        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            duration = time.monotonic() - start
            logger.exception(
                "Unhandled exception on %s %s (cid=%s, %.3fs)",
                request.method,
                request.url.path,
                cid,
                duration,
            )

            # Try to capture in Sentry
            try:
                import sentry_sdk

                sentry_sdk.capture_exception(exc)
            except Exception:
                pass

            # Persist to DB
            token = request.headers.get("X-API-Token")
            await log_error(
                async_session_factory,
                severity="error",
                source="middleware",
                exc=exc,
                context={
                    "method": request.method,
                    "path": request.url.path,
                    "query": str(request.url.query),
                    "duration_s": round(duration, 3),
                },
                correlation_id=cid,
                user_token_hash=hash_token(token) if token else None,
            )

            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal server error",
                    "correlation_id": cid,
                },
            )
