# app/schemas/service.py — Service DTOs
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class ServiceResponse(BaseModel):
    id: int
    name: str
    description: str | None
    price: Decimal | None
    currency: str
    duration_minutes: int | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    price: Decimal | None = None
    currency: str = "ARS"
    duration_minutes: int | None = None


class ServiceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: Decimal | None = None
    currency: str | None = None
    duration_minutes: int | None = None
    is_active: bool | None = None
