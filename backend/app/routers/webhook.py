# app/routers/webhook.py — WhatsApp webhook handler
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.database import async_session
from app.models.client import Client
from app.models.conversation import Conversation
from app.models.message import Message
from app.services import brain, debouncer, whatsapp

logger = logging.getLogger("fixbot")

router = APIRouter()

# In-memory deduplication set for whatsapp_message_ids
# Single-instance deploy (Railway), so this is safe
_seen_message_ids: set[str] = set()


@router.get("/webhook")
async def webhook_health() -> dict:
    """Health check endpoint for Whapi."""
    return {"status": "ok"}


@router.post("/webhook")
async def webhook_handler(request: Request, response: Response) -> dict:
    """
    Receive messages from Whapi.cloud, enqueue them in the debouncer, and
    return 200 immediately. Processing happens in the background after the
    debounce window.
    """
    # Validate webhook token — Whapi signs requests with the same API token
    incoming_token = request.headers.get("Authorization", "")
    # Accept both raw token and "Bearer <token>" format
    incoming_token = incoming_token.removeprefix("Bearer ").strip()
    if incoming_token != settings.whapi_token:
        logger.warning(f"Rejected webhook: invalid token from {request.client.host}")
        response.status_code = 403
        return {"detail": "Forbidden"}

    try:
        payload = await request.json()
        messages = whatsapp.parse_webhook(payload)

        for msg in messages:
            # Ignore own messages and empty text
            if msg.from_me or not msg.text.strip():
                continue

            # Deduplicate by whatsapp message_id
            if msg.message_id and msg.message_id in _seen_message_ids:
                logger.debug(f"Duplicate message_id {msg.message_id} — skipped")
                continue
            if msg.message_id:
                _seen_message_ids.add(msg.message_id)

            logger.info(f"Received from {msg.phone}: {msg.text[:60]}")
            await debouncer.enqueue(msg.phone, msg.text, process_message)

    except Exception as e:
        logger.error(f"Webhook error: {e}")
        # Always return 200 — WhatsApp providers retry on non-200, causing duplicates

    return {"status": "ok"}


async def process_message(phone: str, text: str) -> None:
    """
    Process a (possibly batched) message and send a response.

    Flow: get/create client → get/create conversation → load history
          → generate response → save messages → send reply
    """
    async with async_session() as db:
        try:
            # Get or create client
            result = await db.execute(select(Client).where(Client.phone == phone))
            client = result.scalar_one_or_none()
            if client is None:
                client = Client(phone=phone)
                db.add(client)
                await db.flush()  # Get the client.id before committing
            else:
                # Update last contact time
                await db.execute(
                    update(Client)
                    .where(Client.id == client.id)
                    .values(last_contact_at=datetime.now(timezone.utc))
                )

            # Get or create active conversation
            result = await db.execute(
                select(Conversation)
                .where(Conversation.client_id == client.id, Conversation.status == "active")
                .order_by(Conversation.created_at.desc())
                .limit(1)
            )
            conversation = result.scalar_one_or_none()
            if conversation is None:
                conversation = Conversation(client_id=client.id, status="active")
                db.add(conversation)
                await db.flush()

            # Load history: last 20 messages from this conversation
            result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.created_at.desc())
                .limit(20)
            )
            raw_history = result.scalars().all()
            history = [
                {"role": msg.role, "content": msg.content}
                for msg in reversed(raw_history)
            ]

            # Generate response with Gemini
            response_text = await brain.generate_response(text, history, db, client_id=client.id)

            # Save user message
            user_message = Message(
                conversation_id=conversation.id,
                role="user",
                content=text,
            )
            db.add(user_message)

            # Save assistant message
            assistant_message = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=response_text,
            )
            db.add(assistant_message)

            await db.commit()

            # Send reply via WhatsApp
            await whatsapp.send_message(phone, response_text)
            logger.info(f"Replied to {phone}: {response_text[:60]}")

        except IntegrityError as e:
            await db.rollback()
            logger.error(f"DB integrity error for {phone}: {e}")
        except Exception as e:
            await db.rollback()
            logger.error(f"Error processing message for {phone}: {e}")
