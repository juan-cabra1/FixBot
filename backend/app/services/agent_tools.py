# app/services/agent_tools.py — Tool declarations and handlers for Gemini function calling
import logging
from datetime import date, datetime, time

from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.models.availability import Availability
from app.models.quote import Quote
from app.models.service import Service

logger = logging.getLogger("fixbot")

DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

# ── Tool declarations ─────────────────────────────────────────────────────────

_get_available_slots_decl = types.FunctionDeclaration(
    name="get_available_slots",
    description=(
        "Consulta los horarios disponibles para agendar una visita a domicilio en una fecha específica. "
        "Descuenta automáticamente los turnos ya agendados. "
        "Usá esta herramienta ANTES de proponer cualquier horario al cliente."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "date": types.Schema(
                type="STRING",
                description="Fecha a consultar en formato YYYY-MM-DD",
            )
        },
        required=["date"],
    ),
)

_get_services_decl = types.FunctionDeclaration(
    name="get_services",
    description=(
        "Lista los servicios activos con nombre, descripción, precio y duración estimada. "
        "Usá esta herramienta cuando el cliente pregunte qué servicios se ofrecen, cuánto cuestan o cuánto tardan."
    ),
    parameters=types.Schema(type="OBJECT", properties={}),
)

_create_appointment_decl = types.FunctionDeclaration(
    name="create_appointment",
    description=(
        "Agenda un turno para una visita a domicilio. "
        "Verificá disponibilidad con get_available_slots antes de llamar esta herramienta. "
        "Confirmá todos los datos con el cliente antes de agendar."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "date": types.Schema(
                type="STRING",
                description="Fecha del turno en formato YYYY-MM-DD",
            ),
            "start_time": types.Schema(
                type="STRING",
                description="Hora de inicio en formato HH:MM (ej: 09:30)",
            ),
            "title": types.Schema(
                type="STRING",
                description="Descripción breve del trabajo a realizar",
            ),
            "service_id": types.Schema(
                type="INTEGER",
                description="ID del servicio (opcional, obtenido con get_services)",
            ),
            "address": types.Schema(
                type="STRING",
                description="Dirección de la visita a domicilio (opcional)",
            ),
            "notes": types.Schema(
                type="STRING",
                description="Notas adicionales sobre el trabajo (opcional)",
            ),
        },
        required=["date", "start_time", "title"],
    ),
)

_create_quote_decl = types.FunctionDeclaration(
    name="create_quote",
    description=(
        "Genera un presupuesto para el cliente cuando se conoce el monto. "
        "No uses esta herramienta si el precio es incierto — en ese caso indicá que el dueño lo va a responder."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "description": types.Schema(
                type="STRING",
                description="Descripción detallada del trabajo presupuestado",
            ),
            "amount": types.Schema(
                type="NUMBER",
                description="Monto del presupuesto en pesos argentinos",
            ),
        },
        required=["description", "amount"],
    ),
)

AGENT_TOOLS = types.Tool(
    function_declarations=[
        _get_available_slots_decl,
        _get_services_decl,
        _create_appointment_decl,
        _create_quote_decl,
    ]
)

# ── Time helpers ──────────────────────────────────────────────────────────────


def _time_to_min(t: time) -> int:
    return t.hour * 60 + t.minute


def _min_to_str(minutes: int) -> str:
    h, m = divmod(minutes, 60)
    return f"{h:02d}:{m:02d}"


def _add_minutes(t: time, minutes: int) -> time:
    total = _time_to_min(t) + minutes
    return time(total // 60, total % 60)


def _parse_time(s: str) -> time:
    parts = s.strip().split(":")
    return time(int(parts[0]), int(parts[1]))


def _free_slots(
    block_start: int, block_end: int, booked: list[tuple[int, int]]
) -> list[tuple[int, int]]:
    """Compute free intervals within [block_start, block_end] minus booked ranges."""
    free: list[tuple[int, int]] = []
    cursor = block_start
    for start, end in sorted(booked):
        if start > cursor:
            free.append((cursor, start))
        cursor = max(cursor, end)
    if cursor < block_end:
        free.append((cursor, block_end))
    # Discard slots shorter than 30 minutes
    return [(s, e) for s, e in free if e - s >= 30]


# ── Conflict checker (shared with appointments router) ────────────────────────


async def check_slot_available(
    db: AsyncSession,
    target_date: date,
    start: time,
    end: time,
) -> tuple[bool, str]:
    """
    Check whether the given time slot is bookable.
    Returns (True, "") if available, (False, reason) if not.
    """
    weekday = target_date.weekday()  # 0=Mon, matches DB convention

    result = await db.execute(
        select(Availability).where(
            Availability.day_of_week == weekday,
            Availability.is_active.is_(True),
        )
    )
    blocks = result.scalars().all()

    if not blocks:
        return False, f"No hay atención los {DAY_NAMES[weekday]}"

    start_min = _time_to_min(start)
    end_min = _time_to_min(end)

    in_block = any(
        _time_to_min(b.start_time) <= start_min and end_min <= _time_to_min(b.end_time)
        for b in blocks
    )
    if not in_block:
        return (
            False,
            f"El horario {start.strftime('%H:%M')}–{end.strftime('%H:%M')} "
            f"está fuera del horario de atención",
        )

    result = await db.execute(
        select(Appointment).where(
            Appointment.date == target_date,
            Appointment.status != "cancelled",
        )
    )
    existing = result.scalars().all()

    for appt in existing:
        appt_end = appt.end_time if appt.end_time else _add_minutes(appt.start_time, 60)
        if appt.start_time < end and appt_end > start:
            return (
                False,
                f"Ya hay un turno de {appt.start_time.strftime('%H:%M')} "
                f"a {appt_end.strftime('%H:%M')}",
            )

    return True, ""


# ── Handlers ──────────────────────────────────────────────────────────────────


async def handle_get_available_slots(
    db: AsyncSession, client_id: int, date: str
) -> dict:
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        return {"error": f"Formato de fecha inválido: '{date}'. Usar YYYY-MM-DD"}

    weekday = target_date.weekday()

    result = await db.execute(
        select(Availability).where(
            Availability.day_of_week == weekday,
            Availability.is_active.is_(True),
        ).order_by(Availability.start_time)
    )
    blocks = result.scalars().all()

    if not blocks:
        return {
            "date": date,
            "day": DAY_NAMES[weekday],
            "slots": [],
            "message": f"No hay atención los {DAY_NAMES[weekday]}",
        }

    result = await db.execute(
        select(Appointment).where(
            Appointment.date == target_date,
            Appointment.status != "cancelled",
        )
    )
    appointments = result.scalars().all()

    booked: list[tuple[int, int]] = []
    for appt in appointments:
        s = _time_to_min(appt.start_time)
        e = _time_to_min(appt.end_time) if appt.end_time else s + 60
        booked.append((s, e))

    slots: list[dict] = []
    for block in blocks:
        for s, e in _free_slots(_time_to_min(block.start_time), _time_to_min(block.end_time), booked):
            slots.append({"start": _min_to_str(s), "end": _min_to_str(e)})

    if not slots:
        return {
            "date": date,
            "day": DAY_NAMES[weekday],
            "slots": [],
            "message": "No hay horarios disponibles para ese día",
        }

    return {"date": date, "day": DAY_NAMES[weekday], "slots": slots}


async def handle_get_services(db: AsyncSession, client_id: int) -> dict:
    result = await db.execute(
        select(Service).where(Service.is_active.is_(True)).order_by(Service.name)
    )
    services = result.scalars().all()

    return {
        "services": [
            {
                "id": svc.id,
                "name": svc.name,
                "description": svc.description or "",
                "price": str(svc.price) if svc.price is not None else "a convenir",
                "currency": svc.currency,
                "duration_minutes": svc.duration_minutes,
            }
            for svc in services
        ]
    }


async def handle_create_appointment(
    db: AsyncSession,
    client_id: int,
    date: str,
    start_time: str,
    title: str,
    service_id: int | None = None,
    address: str | None = None,
    notes: str | None = None,
) -> dict:
    try:
        appt_date = datetime.strptime(date, "%Y-%m-%d").date()
        appt_start = _parse_time(start_time)
    except ValueError as exc:
        return {"error": f"Formato inválido: {exc}"}

    appt_end: time | None = None
    if service_id is not None:
        svc_result = await db.execute(select(Service).where(Service.id == service_id))
        service = svc_result.scalar_one_or_none()
        if service and service.duration_minutes:
            appt_end = _add_minutes(appt_start, service.duration_minutes)

    if appt_end is None:
        appt_end = _add_minutes(appt_start, 60)

    is_available, reason = await check_slot_available(db, appt_date, appt_start, appt_end)
    if not is_available:
        return {"error": reason, "available": False}

    appt = Appointment(
        client_id=client_id,
        service_id=service_id,
        title=title,
        date=appt_date,
        start_time=appt_start,
        end_time=appt_end,
        address=address,
        notes=notes,
        created_by="agent",
    )
    db.add(appt)
    await db.flush()

    return {
        "success": True,
        "appointment_id": appt.id,
        "date": date,
        "start_time": appt_start.strftime("%H:%M"),
        "end_time": appt_end.strftime("%H:%M"),
        "title": title,
        "address": address or "a confirmar",
    }


async def handle_create_quote(
    db: AsyncSession,
    client_id: int,
    description: str,
    amount: float,
) -> dict:
    quote = Quote(
        client_id=client_id,
        description=description,
        amount=amount,
        currency="ARS",
        status="sent",
    )
    db.add(quote)
    await db.flush()

    return {
        "success": True,
        "quote_id": quote.id,
        "description": description,
        "amount": amount,
        "currency": "ARS",
    }


# ── Dispatcher ────────────────────────────────────────────────────────────────

_HANDLERS = {
    "get_available_slots": handle_get_available_slots,
    "get_services": handle_get_services,
    "create_appointment": handle_create_appointment,
    "create_quote": handle_create_quote,
}


async def execute_tool(
    name: str, args: dict, db: AsyncSession, client_id: int
) -> dict:
    handler = _HANDLERS.get(name)
    if handler is None:
        return {"error": f"Herramienta desconocida: {name}"}
    try:
        return await handler(db=db, client_id=client_id, **args)
    except Exception as exc:
        logger.error(f"Tool '{name}' failed: {exc}")
        return {"error": f"Error al ejecutar {name}: {exc}"}
