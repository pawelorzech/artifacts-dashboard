"""Persistent WebSocket client for the Artifacts MMO game server.

Maintains a long-lived connection to ``wss://realtime.artifactsmmo.com``
and dispatches every incoming game event to the :class:`EventBus` so that
other components (event handlers, the frontend relay) can react in real
time.

Reconnection is handled automatically with exponential back-off.
"""

from __future__ import annotations

import asyncio
import json
import logging

import websockets

from app.websocket.event_bus import EventBus

logger = logging.getLogger(__name__)


class GameWebSocketClient:
    """Persistent WebSocket connection to the Artifacts game server."""

    WS_URL = "wss://realtime.artifactsmmo.com"

    def __init__(self, token: str, event_bus: EventBus) -> None:
        self._token = token
        self._event_bus = event_bus
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._task: asyncio.Task | None = None
        self._reconnect_delay = 1.0
        self._max_reconnect_delay = 60.0
        self._running = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> asyncio.Task:
        """Start the persistent WebSocket connection in a background task."""
        self._running = True
        self._task = asyncio.create_task(
            self._connection_loop(),
            name="game-ws-client",
        )
        logger.info("Game WebSocket client starting")
        return self._task

    async def stop(self) -> None:
        """Gracefully shut down the WebSocket connection."""
        self._running = False
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Game WebSocket client stopped")

    # ------------------------------------------------------------------
    # Connection loop
    # ------------------------------------------------------------------

    async def _connection_loop(self) -> None:
        """Reconnect loop with exponential back-off."""
        while self._running:
            try:
                async with websockets.connect(
                    self.WS_URL,
                    additional_headers={"Authorization": f"Bearer {self._token}"},
                ) as ws:
                    self._ws = ws
                    self._reconnect_delay = 1.0
                    logger.info("Game WebSocket connected")
                    await self._event_bus.publish("ws_status", {"connected": True})

                    async for message in ws:
                        try:
                            data = json.loads(message)
                            await self._handle_message(data)
                        except json.JSONDecodeError:
                            logger.warning(
                                "Invalid JSON from game WS: %s", message[:100]
                            )

            except asyncio.CancelledError:
                raise
            except websockets.ConnectionClosed:
                logger.warning("Game WebSocket disconnected")
            except Exception:
                logger.exception("Game WebSocket error")

            self._ws = None

            if self._running:
                await self._event_bus.publish("ws_status", {"connected": False})
                logger.info("Reconnecting in %.1fs", self._reconnect_delay)
                await asyncio.sleep(self._reconnect_delay)
                self._reconnect_delay = min(
                    self._reconnect_delay * 2,
                    self._max_reconnect_delay,
                )

    # ------------------------------------------------------------------
    # Message dispatch
    # ------------------------------------------------------------------

    async def _handle_message(self, data: dict) -> None:
        """Dispatch a game event to the event bus.

        Game events are published under the key ``game_{type}`` where
        *type* is the value of the ``"type"`` field in the incoming
        message (defaults to ``"unknown"`` if absent).
        """
        event_type = data.get("type", "unknown")
        await self._event_bus.publish(f"game_{event_type}", data)
