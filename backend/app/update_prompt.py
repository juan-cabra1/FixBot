# app/update_prompt.py — Update system_prompt in DB without resetting data
# Run: python -m app.update_prompt (from backend/)
import asyncio
import logging

from sqlalchemy import update

from app.database import async_session
from app.models.business import BusinessConfig
from app.seed import SYSTEM_PROMPT

logger = logging.getLogger("fixbot")


async def run() -> None:
    async with async_session() as db:
        result = await db.execute(
            update(BusinessConfig)
            .values(system_prompt=SYSTEM_PROMPT)
        )
        await db.commit()
        print(f"Updated {result.rowcount} row(s) — system_prompt applied.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    asyncio.run(run())
