import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character_snapshot import CharacterSnapshot
from app.schemas.game import CharacterSchema
from app.services.artifacts_client import ArtifactsClient

logger = logging.getLogger(__name__)


class CharacterService:
    """High-level service for character data and snapshot management."""

    async def get_all(self, client: ArtifactsClient) -> list[CharacterSchema]:
        """Return all characters belonging to the authenticated account."""
        return await client.get_characters()

    async def get_one(self, client: ArtifactsClient, name: str) -> CharacterSchema:
        """Return a single character by name."""
        return await client.get_character(name)

    async def take_snapshot(
        self,
        db: AsyncSession,
        client: ArtifactsClient,
    ) -> list[CharacterSnapshot]:
        """Fetch current character states and persist snapshots.

        Returns the list of newly created snapshot rows.
        """
        characters = await client.get_characters()
        snapshots: list[CharacterSnapshot] = []

        for char in characters:
            snapshot = CharacterSnapshot(
                name=char.name,
                data=char.model_dump(mode="json"),
            )
            db.add(snapshot)
            snapshots.append(snapshot)

        await db.commit()
        logger.info("Saved %d character snapshots", len(snapshots))
        return snapshots
