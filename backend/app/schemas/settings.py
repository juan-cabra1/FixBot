# app/schemas/settings.py — Settings and availability DTOs
from datetime import datetime, time

from pydantic import BaseModel


class SettingsResponse(BaseModel):
    id: int
    name: str
    description: str | None
    owner_name: str
    phone: str
    timezone: str
    agent_name: str
    agent_tone: str
    system_prompt: str
    welcome_message: str
    fallback_message: str
    outside_hours_msg: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    owner_name: str | None = None
    phone: str | None = None
    timezone: str | None = None
    agent_name: str | None = None
    agent_tone: str | None = None
    system_prompt: str | None = None
    welcome_message: str | None = None
    fallback_message: str | None = None
    outside_hours_msg: str | None = None


class AvailabilityBlock(BaseModel):
    id: int | None = None
    day_of_week: int
    start_time: time
    end_time: time
    is_active: bool = True

    model_config = {"from_attributes": True}


class AvailabilityUpdate(BaseModel):
    blocks: list[AvailabilityBlock]
