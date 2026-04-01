# app/schemas/appointment.py — Appointment request/response DTOs
import datetime as dt
from datetime import datetime

from pydantic import BaseModel


class ClientEmbed(BaseModel):
    id: int
    phone: str
    name: str | None

    model_config = {"from_attributes": True}


class ServiceEmbed(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class AppointmentResponse(BaseModel):
    id: int
    client_id: int
    service_id: int | None
    title: str
    date: dt.date
    start_time: dt.time
    end_time: dt.time | None
    status: str
    address: str | None
    notes: str | None
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AppointmentWithRelations(AppointmentResponse):
    client: ClientEmbed | None = None
    service: ServiceEmbed | None = None


class AppointmentCreate(BaseModel):
    client_id: int
    service_id: int | None = None
    title: str
    date: dt.date
    start_time: dt.time
    end_time: dt.time | None = None
    address: str | None = None
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    title: str | None = None
    date: dt.date | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    status: str | None = None
    address: str | None = None
    notes: str | None = None


class AppointmentListResponse(BaseModel):
    items: list[AppointmentWithRelations]
    total: int
