"""Coordinator for multi-character operations.

Provides simple sequential setup of automations across characters
for pipelines like: gatherer collects materials -> crafter processes them.
"""

import logging
from typing import Any

from app.engine.manager import AutomationManager

logger = logging.getLogger(__name__)


class Coordinator:
    """Coordinates multi-character operations by sequentially setting up automations.

    This is a lightweight orchestrator that configures multiple characters
    to work in a pipeline. It does not manage real-time synchronization
    between characters; each character runs its automation independently.
    """

    def __init__(self, manager: AutomationManager) -> None:
        self._manager = manager

    async def resource_pipeline(
        self,
        gatherer_config_id: int,
        crafter_config_id: int,
        item_code: str,
    ) -> dict[str, Any]:
        """Set up a gather-then-craft pipeline across two characters.

        The gatherer character will gather resources and deposit them.
        The crafter character will withdraw materials and craft the item.

        This is a simple sequential setup -- both automations run
        independently after being started.

        Parameters
        ----------
        gatherer_config_id:
            Automation config ID for the gathering character.
        crafter_config_id:
            Automation config ID for the crafting character.
        item_code:
            The item code that the crafter will produce.

        Returns
        -------
        Dict with the run IDs and status of both automations.
        """
        results: dict[str, Any] = {
            "item_code": item_code,
            "gatherer": None,
            "crafter": None,
            "errors": [],
        }

        # Start the gatherer first
        try:
            gatherer_run = await self._manager.start(gatherer_config_id)
            results["gatherer"] = {
                "config_id": gatherer_config_id,
                "run_id": gatherer_run.id,
                "status": gatherer_run.status,
            }
            logger.info(
                "Pipeline: started gatherer config=%d run=%d",
                gatherer_config_id,
                gatherer_run.id,
            )
        except ValueError as exc:
            error_msg = f"Failed to start gatherer: {exc}"
            results["errors"].append(error_msg)
            logger.warning("Pipeline: %s", error_msg)

        # Start the crafter
        try:
            crafter_run = await self._manager.start(crafter_config_id)
            results["crafter"] = {
                "config_id": crafter_config_id,
                "run_id": crafter_run.id,
                "status": crafter_run.status,
            }
            logger.info(
                "Pipeline: started crafter config=%d run=%d",
                crafter_config_id,
                crafter_run.id,
            )
        except ValueError as exc:
            error_msg = f"Failed to start crafter: {exc}"
            results["errors"].append(error_msg)
            logger.warning("Pipeline: %s", error_msg)

        return results

    async def stop_pipeline(
        self,
        gatherer_config_id: int,
        crafter_config_id: int,
    ) -> dict[str, Any]:
        """Stop both automations in a resource pipeline.

        Parameters
        ----------
        gatherer_config_id:
            Automation config ID for the gathering character.
        crafter_config_id:
            Automation config ID for the crafting character.

        Returns
        -------
        Dict with the stop results for both automations.
        """
        results: dict[str, Any] = {
            "gatherer_stopped": False,
            "crafter_stopped": False,
            "errors": [],
        }

        for label, config_id in [
            ("gatherer", gatherer_config_id),
            ("crafter", crafter_config_id),
        ]:
            try:
                await self._manager.stop(config_id)
                results[f"{label}_stopped"] = True
                logger.info("Pipeline: stopped %s config=%d", label, config_id)
            except ValueError as exc:
                results["errors"].append(f"Failed to stop {label}: {exc}")
                logger.warning(
                    "Pipeline: failed to stop %s config=%d: %s",
                    label,
                    config_id,
                    exc,
                )

        return results
