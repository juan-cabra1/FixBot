# app/services/whatsapp.py — Whapi.cloud: parse webhook + send message
import logging

import httpx

from app.config import settings
from app.schemas.webhook import IncomingMessage

logger = logging.getLogger("fixbot")


def parse_webhook(payload: dict) -> list[IncomingMessage]:
    """Extract and normalize messages from a Whapi.cloud webhook payload."""
    messages = []
    for msg in payload.get("messages", []):
        messages.append(
            IncomingMessage(
                phone=msg.get("chat_id", ""),
                text=msg.get("text", {}).get("body", ""),
                message_id=msg.get("id", ""),
                from_me=msg.get("from_me", False),
            )
        )
    return messages


async def send_message(phone: str, text: str) -> bool:
    """Send a text message via Whapi.cloud. Returns True on success."""
    if not settings.whapi_token:
        logger.warning("WHAPI_TOKEN not set — message not sent")
        return False
    headers = {
        "Authorization": f"Bearer {settings.whapi_token}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{settings.whapi_api_url}/messages/text",
            json={"to": phone, "body": text},
            headers=headers,
        )
        if r.status_code != 200:
            logger.error(f"Whapi error {r.status_code}: {r.text}")
        return r.status_code == 200
