# app/main.py — FastAPI application entry point
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models import Base
from app.routers import appointments, auth, webhook
from app.routers import settings as settings_router

log_level = logging.DEBUG if settings.environment == "development" else logging.INFO
logging.basicConfig(
    level=log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fixbot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (use Alembic for production schema changes)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info(f"FixBot backend started on port {settings.port}")
    logger.info(f"Environment: {settings.environment}")
    yield


app = FastAPI(
    title="FixBot — WhatsApp AI Agent",
    version="1.0.0",
    lifespan=lifespan,
)

_cors_origins = (
    # In development allow any localhost port (frontend can start on 3000, 3001, etc.)
    ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]
    if settings.environment == "development"
    else [settings.frontend_url]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook.router)
app.include_router(auth.router)
app.include_router(appointments.router)
app.include_router(settings_router.router)


@app.get("/")
async def health_check() -> dict:
    """Health check for Railway monitoring."""
    return {"status": "ok", "service": "fixbot"}
