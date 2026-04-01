# app/schemas/webhook.py — Normalized incoming message (provider-agnostic)
from dataclasses import dataclass


@dataclass
class IncomingMessage:
    """Normalized message from any WhatsApp provider."""
    phone: str
    text: str
    message_id: str
    from_me: bool
