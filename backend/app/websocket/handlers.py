"""Event handlers for processing game events from the WebSocket.

The :class:`GameEventHandler` subscribes to all events on the bus and
can be extended with domain-specific logic (e.g. updating caches,
triggering automation adjustments, etc.).
"""

from __future__ import annotations

import asyncio
import logging

from app.websocket.event_bus import EventBus

logger = logging.getLogger(__name__)


class GameEventHandler:
    """Process game events received via the EventBus."""

    def __init__(self, event_bus: EventBus) -> None:
        self._event_bus = event_bus
        self._queue: asyncio.Queue | None = None
        self._task: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> asyncio.Task:
        """Subscribe to all events and start the processing loop."""
        self._queue = self._event_bus.subscribe_all()
        self._task = asyncio.create_task(
            self._process_loop(),
            name="game-event-handler",
        )
        logger.info("Game event handler started")
        return self._task

    async def stop(self) -> None:
        """Stop the processing loop and unsubscribe."""
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._queue is not None:
            self._event_bus.unsubscribe("*", self._queue)
        logger.info("Game event handler stopped")

    # ------------------------------------------------------------------
    # Processing
    # ------------------------------------------------------------------

    async def _process_loop(self) -> None:
        """Read events from the queue and dispatch to handlers."""
        assert self._queue is not None
        try:
            while True:
                event = await self._queue.get()
                try:
                    await self._handle(event)
                except Exception:
                    logger.exception(
                        "Error handling event: %s", event.get("type")
                    )
        except asyncio.CancelledError:
            logger.debug("Event handler process loop cancelled")

    async def _handle(self, event: dict) -> None:
        """Handle a single event.

        Override or extend this method to add domain-specific logic.
        Currently logs notable game events for observability.
        """
        event_type = event.get("type", "")

        if event_type.startswith("game_"):
            logger.info("Game event: %s", event_type)
