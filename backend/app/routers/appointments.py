# app/routers/appointments.py — Appointments CRUD
import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.appointment import Appointment
from app.services.agent_tools import _add_minutes, check_slot_available
from app.models.client import Client
from app.models.service import Service
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentUpdate,
    AppointmentWithRelations,
    ClientEmbed,
    ServiceEmbed,
)

router = APIRouter(
    prefix="/api/v1/appointments",
    tags=["appointments"],
    dependencies=[Depends(get_current_user)],
)


def _build_with_relations(
    appt: Appointment,
    client: Client | None,
    service: Service | None,
) -> AppointmentWithRelations:
    data = AppointmentWithRelations.model_validate(appt)
    if client:
        data.client = ClientEmbed.model_validate(client)
    if service:
        data.service = ServiceEmbed.model_validate(service)
    return data


@router.get("", response_model=AppointmentListResponse)
async def list_appointments(
    date_filter: dt.date | None = Query(None, alias="date"),
    from_date: dt.date | None = None,
    to_date: dt.date | None = None,
    appt_status: str | None = Query(None, alias="status"),
    client_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> AppointmentListResponse:
    query = select(Appointment)
    if date_filter:
        query = query.where(Appointment.date == date_filter)
    if from_date:
        query = query.where(Appointment.date >= from_date)
    if to_date:
        query = query.where(Appointment.date <= to_date)
    if appt_status:
        query = query.where(Appointment.status == appt_status)
    if client_id:
        query = query.where(Appointment.client_id == client_id)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(query.order_by(Appointment.date, Appointment.start_time))
    appointments = result.scalars().all()

    items: list[AppointmentWithRelations] = []
    for appt in appointments:
        client_res = await db.execute(
            select(Client).where(Client.id == appt.client_id)
        )
        client = client_res.scalar_one_or_none()

        service = None
        if appt.service_id:
            svc_res = await db.execute(
                select(Service).where(Service.id == appt.service_id)
            )
            service = svc_res.scalar_one_or_none()

        items.append(_build_with_relations(appt, client, service))

    return AppointmentListResponse(items=items, total=total)


@router.post("", response_model=AppointmentWithRelations, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    body: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
) -> AppointmentWithRelations:
    client_res = await db.execute(select(Client).where(Client.id == body.client_id))
    client = client_res.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if body.start_time:
        end_time = body.end_time
        if end_time is None and body.service_id:
            svc_res = await db.execute(select(Service).where(Service.id == body.service_id))
            svc = svc_res.scalar_one_or_none()
            if svc and svc.duration_minutes:
                end_time = _add_minutes(body.start_time, svc.duration_minutes)
        if end_time is None:
            end_time = _add_minutes(body.start_time, 60)

        is_available, reason = await check_slot_available(db, body.date, body.start_time, end_time)
        if not is_available:
            raise HTTPException(status_code=409, detail=reason)

    appt = Appointment(
        client_id=body.client_id,
        service_id=body.service_id,
        title=body.title,
        date=body.date,
        start_time=body.start_time,
        end_time=body.end_time,
        address=body.address,
        notes=body.notes,
        created_by="dashboard",
    )
    db.add(appt)
    await db.commit()
    await db.refresh(appt)

    service = None
    if appt.service_id:
        svc_res = await db.execute(select(Service).where(Service.id == appt.service_id))
        service = svc_res.scalar_one_or_none()

    return _build_with_relations(appt, client, service)


@router.patch("/{appointment_id}", response_model=AppointmentWithRelations)
async def update_appointment(
    appointment_id: int,
    body: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
) -> AppointmentWithRelations:
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if appt is None:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(appt, field, value)

    await db.commit()
    await db.refresh(appt)

    client_res = await db.execute(select(Client).where(Client.id == appt.client_id))
    client = client_res.scalar_one_or_none()

    service = None
    if appt.service_id:
        svc_res = await db.execute(select(Service).where(Service.id == appt.service_id))
        service = svc_res.scalar_one_or_none()

    return _build_with_relations(appt, client, service)


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_appointment(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if appt is None:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    appt.status = "cancelled"
    await db.commit()
