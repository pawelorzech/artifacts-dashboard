"""WebSocket endpoint for the frontend dashboard.

Provides a ``/ws/live`` WebSocket endpoint that relays events from the
internal :class:`EventBus` to connected browser clients.  Multiple
frontend connections are supported simultaneously.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket.event_bus import EventBus

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manage active frontend WebSocket connections."""

    def __init__(self) -> None:
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)
        logger.info(
            "Frontend WebSocket connected (total=%d)", len(self._connections)
        )

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._connections:
            self._connections.remove(ws)
        logger.info(
            "Frontend WebSocket removed (total=%d)", len(self._connections)
        )

    async def broadcast(self, message: dict) -> None:
        """Send a message to all connected clients.

        Silently removes any clients whose connections have broken.
        """
        disconnected: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws)

    @property
    def connection_count(self) -> int:
        return len(self._connections)


# Singleton connection manager -- shared across all WebSocket endpoint
# invocations within the same process.
ws_manager = ConnectionManager()


@router.websocket("/ws/live")
async def websocket_live(ws: WebSocket) -> None:
    """WebSocket endpoint that relays internal events to the frontend.

    Once connected the client receives a stream of JSON events from the
    :class:`EventBus`.  The client may send text frames (reserved for
    future command support); they are currently ignored.
    """
    await ws_manager.connect(ws)

    # Obtain the event bus from application state
    event_bus: EventBus = ws.app.state.event_bus
    queue = event_bus.subscribe_all()

    relay_task: asyncio.Task | None = None

    try:
        # Background task: relay events from the bus to the client
        async def _relay() -> None:
            try:
                while True:
                    event = await queue.get()
                    await ws.send_json(event)
            except asyncio.CancelledError:
                pass

        relay_task = asyncio.create_task(
            _relay(), name="ws-relay"
        )

        # Main loop: keep connection alive by reading client frames
        while True:
            _data = await ws.receive_text()
            # Client messages can be handled here in the future

    except WebSocketDisconnect:
        logger.info("Frontend WebSocket disconnected")
    except Exception:
        logger.exception("WebSocket error")
    finally:
        if relay_task is not None:
            relay_task.cancel()
            try:
                await relay_task
            except asyncio.CancelledError:
                pass
        event_bus.unsubscribe("*", queue)
        ws_manager.disconnect(ws)
