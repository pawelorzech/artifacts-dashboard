"""Async pub/sub event bus for internal communication.

Provides a simple in-process publish/subscribe mechanism built on
``asyncio.Queue``.  Components can subscribe to specific event types
(string keys) or use ``subscribe_all`` to receive every published event.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)


class EventBus:
    """Async pub/sub event bus for internal communication."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)

    # ------------------------------------------------------------------
    # Subscribe / unsubscribe
    # ------------------------------------------------------------------

    def subscribe(self, event_type: str) -> asyncio.Queue:
        """Subscribe to a specific event type.

        Returns an ``asyncio.Queue`` that will receive dicts of the form
        ``{"type": event_type, "data": ...}`` whenever an event of that
        type is published.
        """
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers[event_type].append(queue)
        return queue

    def subscribe_all(self) -> asyncio.Queue:
        """Subscribe to **all** events (wildcard ``*``).

        Returns a queue that receives every event regardless of type.
        """
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers["*"].append(queue)
        return queue

    def unsubscribe(self, event_type: str, queue: asyncio.Queue) -> None:
        """Remove a queue from a given event type's subscriber list."""
        if queue in self._subscribers[event_type]:
            self._subscribers[event_type].remove(queue)

    # ------------------------------------------------------------------
    # Publish
    # ------------------------------------------------------------------

    async def publish(self, event_type: str, data: dict) -> None:
        """Publish an event to type-specific *and* wildcard subscribers.

        Parameters
        ----------
        event_type:
            A string key identifying the event (e.g. ``"automation_action"``).
        data:
            Arbitrary dict payload delivered to subscribers.
        """
        event = {"type": event_type, "data": data}

        # Deliver to type-specific subscribers
        for queue in self._subscribers[event_type]:
            await queue.put(event)

        # Deliver to wildcard subscribers
        for queue in self._subscribers["*"]:
            await queue.put(event)
