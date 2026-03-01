"""Auth endpoints for per-user API token management.

Each user provides their own Artifacts API token via the frontend.
The token is stored in the browser's localStorage and sent with every
request as the ``X-API-Token`` header. The backend validates the token
but does NOT store it globally — this allows true multi-user support.
"""

import logging

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class AuthStatus(BaseModel):
    has_token: bool
    source: str  # "header", "env", or "none"


class SetTokenRequest(BaseModel):
    token: str


class SetTokenResponse(BaseModel):
    success: bool
    source: str
    account: str | None = None
    error: str | None = None


@router.get("/status", response_model=AuthStatus)
async def auth_status(request: Request) -> AuthStatus:
    """Check whether the *requesting* client has a valid token.

    The frontend sends the token in the ``X-API-Token`` header.
    This endpoint tells the frontend whether that token is present.
    """
    token = request.headers.get("X-API-Token")
    if token:
        return AuthStatus(has_token=True, source="header")
    return AuthStatus(has_token=False, source="none")


@router.post("/token", response_model=SetTokenResponse)
async def validate_token(body: SetTokenRequest) -> SetTokenResponse:
    """Validate an Artifacts API token.

    Does NOT store the token on the server. The frontend is responsible
    for persisting it in localStorage and sending it with every request.
    """
    token = body.token.strip()
    if not token:
        return SetTokenResponse(success=False, source="none", error="Token cannot be empty")

    # Validate the token by making a test call
    try:
        async with httpx.AsyncClient(
            base_url=settings.artifacts_api_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
            timeout=httpx.Timeout(10.0),
        ) as test_client:
            resp = await test_client.get("/my/characters")
            if resp.status_code == 401:
                return SetTokenResponse(success=False, source="none", error="Invalid token")
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        return SetTokenResponse(
            success=False,
            source="none",
            error=f"API error: {exc.response.status_code}",
        )
    except Exception as exc:
        logger.warning("Token validation failed: %s", exc)
        return SetTokenResponse(
            success=False,
            source="none",
            error="Could not validate token. Check your network connection.",
        )

    logger.info("API token validated via UI")
    return SetTokenResponse(success=True, source="user")


@router.delete("/token")
async def clear_token() -> AuthStatus:
    """No-op on the backend — the frontend clears its own localStorage."""
    return AuthStatus(has_token=False, source="none")
