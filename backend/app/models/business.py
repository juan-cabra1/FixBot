# app/models/business.py — BusinessConfig model (always 1 row)
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BusinessConfig(Base):
    __tablename__ = "business_config"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    owner_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    timezone: Mapped[str] = mapped_column(
        String(50), nullable=False, default="America/Argentina/Cordoba"
    )
    # AI agent config
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False)
    agent_tone: Mapped[str] = mapped_column(String(50), nullable=False, default="amigable")
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    welcome_message: Mapped[str] = mapped_column(
        Text, nullable=False, default="Hola! ¿En qué puedo ayudarte?"
    )
    fallback_message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="Disculpa, no entendí tu mensaje. ¿Podrías reformularlo?",
    )
    outside_hours_msg: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="Gracias por escribirnos. Estamos fuera de horario, te responderemos pronto.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
