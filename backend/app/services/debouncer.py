# app/services/debouncer.py — Message debouncer: batch rapid messages into one
import asyncio
import logging
from collections.abc import Callable, Coroutine
from typing import Any

from app.config import settings

logger = logging.getLogger("fixbot")

# Module-level state: one buffer and one timer per phone number
_buffers: dict[str, list[str]] = {}
_timers: dict[str, asyncio.Task] = {}  # type: ignore[type-arg]


async def enqueue(
    phone: str,
    text: str,
    callback: Callable[[str, str], Coroutine[Any, Any, None]],
) -> None:
    """
    Accumulate a message for a phone number and (re)start the debounce timer.

    When the timer fires (after DEBOUNCE_SECONDS of inactivity), all accumulated
    messages are joined and the callback is invoked once with the combined text.
    """
    if phone not in _buffers:
        _buffers[phone] = []
    _buffers[phone].append(text)

    # Cancel any existing timer for this phone
    existing = _timers.get(phone)
    if existing and not existing.done():
        existing.cancel()

    # Schedule a new flush after the debounce window
    _timers[phone] = asyncio.create_task(_flush(phone, callback))


async def _flush(
    phone: str,
    callback: Callable[[str, str], Coroutine[Any, Any, None]],
) -> None:
    """Wait for the debounce window, then process all buffered messages as one."""
    try:
        await asyncio.sleep(settings.debounce_seconds)
    except asyncio.CancelledError:
        # Timer was reset because a new message arrived — do nothing
        return

    messages = _buffers.pop(phone, [])
    _timers.pop(phone, None)

    if not messages:
        return

    combined_text = "\n".join(messages)
    logger.info(f"Debounce flush for {phone}: {len(messages)} message(s)")

    try:
        await callback(phone, combined_text)
    except Exception as e:
        logger.error(f"Error processing message batch for {phone}: {e}")
