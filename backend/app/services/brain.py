# app/services/brain.py — Gemini AI: dynamic prompt builder + tool-call loop
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from google import genai
from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.availability import Availability
from app.models.business import BusinessConfig
from app.models.service import Service
from app.services.agent_tools import AGENT_TOOLS, DAY_NAMES, execute_tool

logger = logging.getLogger("fixbot")

client = genai.Client(api_key=settings.gemini_api_key)
MODEL = "gemini-2.5-flash"

_TONE_INSTRUCTIONS: dict[str, str] = {
    "amigable": (
        "Tu tono es amigable, cálido y cercano. Usá el voseo (vos/te). "
        "Podés usar emojis con moderación para dar calidez."
    ),
    "profesional": (
        "Tu tono es formal y profesional. Tratá al cliente de usted. "
        "Sin emojis ni lenguaje informal."
    ),
    "neutro": "Tu tono es neutro y directo. Sin formalismos exagerados ni lenguaje muy informal.",
}


_MATERIALS_LABELS: dict[str, str] = {
    "included": "Los materiales están incluidos en el presupuesto",
    "client_provides": "Los materiales los provee el cliente",
    "to_agree": "A convenir con el cliente",
}


def _format_custom_instructions(raw: str) -> str:
    """Format system_prompt content, supporting JSON structured format and legacy plain text."""
    if not raw or not raw.strip():
        return ""

    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("not a dict")
    except (json.JSONDecodeError, ValueError):
        return f"## Instrucciones personalizadas del dueño\n{raw.strip()}"

    lines: list[str] = []

    if data.get("coverage_zone"):
        lines.append(f"- Zona de cobertura: {data['coverage_zone']}")

    if data.get("materials_policy"):
        label = _MATERIALS_LABELS.get(data["materials_policy"], data["materials_policy"])
        lines.append(f"- Política de materiales: {label}")

    if data.get("handles_emergencies"):
        detail = data.get("emergency_details", "")
        lines.append(
            f"- Urgencias: Sí — {detail}" if detail else "- Urgencias: Sí, se atienden"
        )
    else:
        lines.append("- Urgencias: No se atienden urgencias fuera de horario")

    custom_rules: list[str] = data.get("custom_rules", [])
    if custom_rules:
        lines.append("- Reglas adicionales:")
        for rule in custom_rules:
            lines.append(f"  • {rule}")

    if not lines:
        return ""

    return "## Instrucciones personalizadas del dueño\n" + "\n".join(lines)


async def _load_config(db: AsyncSession) -> BusinessConfig | None:
    result = await db.execute(select(BusinessConfig).limit(1))
    return result.scalar_one_or_none()


async def build_system_prompt(db: AsyncSession) -> str:
    """
    Build the full system prompt dynamically from DB data:
    business config + active services + availability blocks + custom instructions.
    """
    config = await _load_config(db)
    if config is None:
        return "Sos un asistente útil. Respondé en español."

    services_result = await db.execute(
        select(Service).where(Service.is_active.is_(True)).order_by(Service.name)
    )
    services = services_result.scalars().all()

    availability_result = await db.execute(
        select(Availability)
        .where(Availability.is_active.is_(True))
        .order_by(Availability.day_of_week, Availability.start_time)
    )
    availability_blocks = availability_result.scalars().all()

    # Current datetime in business timezone
    tz = ZoneInfo(config.timezone)
    now_str = datetime.now(tz).strftime("%A %d/%m/%Y %H:%M")

    tone = _TONE_INSTRUCTIONS.get(config.agent_tone, _TONE_INSTRUCTIONS["neutro"])

    # Services section
    if services:
        svc_lines = []
        for svc in services:
            price = f"{svc.price} {svc.currency}" if svc.price is not None else "a convenir con el dueño"
            duration = f"{svc.duration_minutes} min" if svc.duration_minutes else "variable"
            desc = f" — {svc.description}" if svc.description else ""
            svc_lines.append(f"  • {svc.name}{desc} | Precio: {price} | Duración aprox: {duration}")
        services_section = "## Servicios disponibles\n" + "\n".join(svc_lines)
    else:
        services_section = "## Servicios disponibles\n  (Sin servicios cargados aún)"

    # Availability section
    if availability_blocks:
        avail_by_day: dict[int, list[str]] = {}
        for block in availability_blocks:
            avail_by_day.setdefault(block.day_of_week, []).append(
                f"{block.start_time.strftime('%H:%M')} a {block.end_time.strftime('%H:%M')}"
            )
        avail_lines = [
            f"  • {DAY_NAMES[day]}: {', '.join(times)}"
            for day, times in sorted(avail_by_day.items())
        ]
        availability_section = (
            "## Horarios disponibles para visitas a domicilio\n" + "\n".join(avail_lines)
        )
    else:
        availability_section = "## Horarios disponibles para visitas a domicilio\n  (Sin horarios configurados)"

    # Custom instructions from DB (supports JSON structured format or legacy plain text)
    custom_instructions = _format_custom_instructions(config.system_prompt)

    prompt = f"""Sos {config.agent_name}, el asistente virtual de {config.name}.
{f"{config.description}" if config.description else ""}

{tone}

El dueño del negocio es {config.owner_name}. La fecha y hora actual es: {now_str}.

{services_section}

{availability_section}

## Herramientas disponibles
Tenés acceso a estas herramientas que debés usar activamente:
- **get_services**: para mostrar los servicios y precios actualizados al cliente
- **get_available_slots**: para consultar horarios libres en una fecha — SIEMPRE usá esta herramienta antes de proponer un horario
- **create_appointment**: para agendar un turno una vez que el cliente confirmó fecha, hora y dirección
- **create_quote**: para generar un presupuesto cuando el monto está definido

## Reglas importantes
- NUNCA inventes precios, horarios ni información que no esté en tus datos
- SIEMPRE verificá disponibilidad con get_available_slots antes de proponer un horario
- Si no podés dar un precio exacto o resolver una duda técnica, decile al cliente que esa consulta la va a responder {config.owner_name} personalmente cuando pueda — NO des el teléfono del dueño ni invites al cliente a llamar
- Confirmá todos los datos (fecha, hora, dirección) antes de crear un turno
- El chat funciona 24/7; los horarios de atención son solo para visitas a domicilio

{custom_instructions}""".strip()

    return prompt


async def load_fallback_message(db: AsyncSession) -> str:
    config = await _load_config(db)
    if config is None:
        return "Disculpá, no logré entender tu mensaje. ¿Podés reformularlo?"
    return config.fallback_message


async def generate_response(
    message: str,
    history: list[dict],
    db: AsyncSession,
    client_id: int,
) -> str:
    """
    Generate a response using Gemini 2.5 Flash with tool-call support.

    Args:
        message: The new user message (may contain multiple messages joined with \\n)
        history: Previous messages [{"role": "user"|"assistant", "content": "..."}]
        db: Database session
        client_id: ID of the client in the DB (used by tools)

    Returns:
        The generated response text
    """
    if not message or len(message.strip()) < 2:
        return await load_fallback_message(db)

    system_prompt = await build_system_prompt(db)

    # Build conversation history for Gemini (uses "model" instead of "assistant")
    contents: list[types.Content] = []
    for msg in history:
        role = "model" if msg["role"] == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))

    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        tools=[AGENT_TOOLS],
        max_output_tokens=1024,
        temperature=0.7,
    )

    try:
        # Tool-call loop — max 5 iterations to prevent infinite cycles
        last_response = None
        for _ in range(5):
            response = await client.aio.models.generate_content(
                model=MODEL,
                contents=contents,
                config=config,
            )
            last_response = response

            # Collect function calls from this response
            candidate_content = response.candidates[0].content
            function_calls = [
                part.function_call
                for part in candidate_content.parts
                if part.function_call is not None
            ]

            if not function_calls:
                # No tool calls — return the final text
                return response.text or await load_fallback_message(db)

            # Append model's response (contains the function calls) to history
            contents.append(candidate_content)

            # Execute each tool and build function response parts
            fc_parts: list[types.Part] = []
            for fc in function_calls:
                result = await execute_tool(
                    name=fc.name,
                    args=dict(fc.args or {}),
                    db=db,
                    client_id=client_id,
                )
                fc_parts.append(
                    types.Part(
                        function_response=types.FunctionResponse(
                            name=fc.name,
                            response=result,
                        )
                    )
                )

            contents.append(types.Content(role="user", parts=fc_parts))

        # Exhausted iterations — return whatever text we got last
        if last_response and last_response.text:
            return last_response.text
        return await load_fallback_message(db)

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return "Lo siento, estoy experimentando inconvenientes técnicos. Por favor intentá nuevamente en unos minutos."
