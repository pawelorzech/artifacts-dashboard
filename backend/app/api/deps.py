"""Shared FastAPI dependencies for API endpoints."""

import hashlib

from fastapi import HTTPException, Request

from app.services.artifacts_client import ArtifactsClient


def get_user_client(request: Request) -> ArtifactsClient:
    """Return an ArtifactsClient scoped to the requesting user's token.

    Reads the ``X-API-Token`` header sent by the frontend and creates a
    lightweight clone of the global client that uses that token.  Falls
    back to the global client when no per-request token is provided (e.g.
    for public / unauthenticated endpoints).
    """
    token = request.headers.get("X-API-Token")
    base_client: ArtifactsClient = request.app.state.artifacts_client

    if token:
        return base_client.with_token(token)

    # No per-request token — use the global client if it has a token
    if base_client.has_token:
        return base_client

    raise HTTPException(status_code=401, detail="No API token provided")


async def get_user_character_names(request: Request) -> list[str]:
    """Return the character names belonging to the requesting user.

    Calls the Artifacts API with the user's token to get their characters,
    then returns just the names.  Used to scope DB queries to a single user.
    """
    client = get_user_client(request)
    characters = await client.get_characters()
    return [c.name for c in characters]


def get_token_hash(request: Request) -> str | None:
    """Return a SHA-256 hash of the user's API token, or None."""
    token = request.headers.get("X-API-Token")
    if token:
        return hashlib.sha256(token.encode()).hexdigest()
    return None
