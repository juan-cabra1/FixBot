# tests/test_local.py — Local chat simulator (no WhatsApp needed)
# Run from backend/: python -m tests.test_local
import asyncio
import sys

from app.database import async_session, engine
from app.models import Base
from app.models.client import Client
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.brain import generate_response
from sqlalchemy import select, delete

TEST_PHONE = "test-local-001"


async def get_or_create_session() -> tuple[int, int]:
    """Return (client_id, conversation_id) for the test phone."""
    async with async_session() as db:
        result = await db.execute(select(Client).where(Client.phone == TEST_PHONE))
        client = result.scalar_one_or_none()
        if client is None:
            client = Client(phone=TEST_PHONE, name="Test User")
            db.add(client)
            await db.flush()

        result = await db.execute(
            select(Conversation)
            .where(Conversation.client_id == client.id, Conversation.status == "active")
            .limit(1)
        )
        conv = result.scalar_one_or_none()
        if conv is None:
            conv = Conversation(client_id=client.id, status="active")
            db.add(conv)
            await db.flush()

        await db.commit()
        return client.id, conv.id


async def get_history(conversation_id: int) -> list[dict]:
    async with async_session() as db:
        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(20)
        )
        msgs = result.scalars().all()
        return [{"role": m.role, "content": m.content} for m in reversed(msgs)]


async def save_message(conversation_id: int, role: str, content: str) -> None:
    async with async_session() as db:
        db.add(Message(conversation_id=conversation_id, role=role, content=content))
        await db.commit()


async def clear_history(conversation_id: int) -> None:
    async with async_session() as db:
        await db.execute(delete(Message).where(Message.conversation_id == conversation_id))
        await db.commit()


async def main() -> None:
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    _, conv_id = await get_or_create_session()

    print()
    print("=" * 55)
    print("   FixBot — Test Local")
    print("=" * 55)
    print()
    print("  Escribí mensajes como si fueras un cliente.")
    print("  Comandos:")
    print("    limpiar  — borra el historial de esta sesión")
    print("    salir    — termina el test")
    print()
    print("-" * 55)
    print()

    while True:
        try:
            message = input("Vos: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nTest finalizado.")
            break

        if not message:
            continue

        if message.lower() == "salir":
            print("Test finalizado.")
            break

        if message.lower() == "limpiar":
            await clear_history(conv_id)
            print("[Historial borrado]\n")
            continue

        history = await get_history(conv_id)

        print("FixBot: ", end="", flush=True)
        async with async_session() as db:
            response = await generate_response(message, history, db)
        print(response)
        print()

        await save_message(conv_id, "user", message)
        await save_message(conv_id, "assistant", response)


if __name__ == "__main__":
    asyncio.run(main())
