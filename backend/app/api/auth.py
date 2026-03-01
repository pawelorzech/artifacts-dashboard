"""Auth endpoints for runtime API token management.

When no ARTIFACTS_TOKEN is set in the environment, users can provide
their own token through the UI. The token is stored in memory only
and must be re-sent if the backend restarts.
"""

import logging

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.config import settings
from app.services.artifacts_client import ArtifactsClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class AuthStatus(BaseModel):
    has_token: bool
    source: str  # "env", "user", or "none"


class SetTokenRequest(BaseModel):
    token: str


class SetTokenResponse(BaseModel):
    success: bool
    source: str
    account: str | None = None
    error: str | None = None


@router.get("/status", response_model=AuthStatus)
async def auth_status(request: Request) -> AuthStatus:
    client: ArtifactsClient = request.app.state.artifacts_client
    return AuthStatus(
        has_token=client.has_token,
        source=client.token_source,
    )


@router.post("/token", response_model=SetTokenResponse)
async def set_token(body: SetTokenRequest, request: Request) -> SetTokenResponse:
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

    # Token is valid — apply it
    client: ArtifactsClient = request.app.state.artifacts_client
    client.set_token(token)

    # Reconnect WebSocket with new token
    game_ws_client = getattr(request.app.state, "game_ws_client", None)
    if game_ws_client is not None:
        try:
            await game_ws_client.reconnect_with_token(token)
        except Exception:
            logger.exception("Failed to reconnect WebSocket with new token")

    logger.info("API token updated via UI (source: user)")
    return SetTokenResponse(success=True, source="user")


@router.delete("/token")
async def clear_token(request: Request) -> AuthStatus:
    client: ArtifactsClient = request.app.state.artifacts_client
    client.clear_token()

    # Reconnect WebSocket with env token (or empty)
    game_ws_client = getattr(request.app.state, "game_ws_client", None)
    if game_ws_client is not None and settings.artifacts_token:
        try:
            await game_ws_client.reconnect_with_token(settings.artifacts_token)
        except Exception:
            logger.exception("Failed to reconnect WebSocket after token clear")

    logger.info("API token cleared, reverted to env")
    return AuthStatus(
        has_token=client.has_token,
        source=client.token_source,
    )
