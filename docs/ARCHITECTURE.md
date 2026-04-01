# Arquitectura — WhatsApp AgentKit

---

## Estructura completa del proyecto

```
/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # FastAPI app, lifespan (init DB + scheduler), CORS
│   │   ├── config.py                   # Settings con pydantic-settings
│   │   ├── database.py                 # async engine, sessionmaker, get_db dependency
│   │   ├── auth.py                     # JWT: create_token, verify, hash_password, get_current_user
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py             # Importa todos los modelos + Base
│   │   │   ├── business.py             # BusinessConfig
│   │   │   ├── service.py              # Service
│   │   │   ├── availability.py         # Availability
│   │   │   ├── client.py               # Client
│   │   │   ├── conversation.py         # Conversation
│   │   │   ├── message.py              # Message
│   │   │   ├── appointment.py          # Appointment
│   │   │   ├── quote.py                # Quote
│   │   │   └── reminder.py             # Reminder
│   │   │
│   │   ├── schemas/                    # Pydantic v2 DTOs
│   │   │   ├── __init__.py
│   │   │   ├── auth.py                 # LoginRequest, TokenResponse
│   │   │   ├── appointment.py          # AppointmentCreate, AppointmentUpdate, AppointmentResponse
│   │   │   ├── client.py               # ClientUpdate, ClientResponse, ClientDetail
│   │   │   ├── service.py              # ServiceCreate, ServiceUpdate, ServiceResponse
│   │   │   ├── quote.py                # QuoteCreate, QuoteUpdate, QuoteResponse
│   │   │   ├── metrics.py              # MetricsResponse, DailyMetrics
│   │   │   └── settings.py             # SettingsUpdate, SettingsResponse, AvailabilityBlock
│   │   │
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── webhook.py              # POST/GET /webhook — sin auth
│   │   │   ├── auth.py                 # POST /api/v1/auth/login
│   │   │   ├── appointments.py         # /api/v1/appointments — CRUD
│   │   │   ├── clients.py              # /api/v1/clients — list, detail, update
│   │   │   ├── services.py             # /api/v1/services — CRUD
│   │   │   ├── quotes.py               # /api/v1/quotes — CRUD
│   │   │   ├── metrics.py              # /api/v1/metrics — readonly
│   │   │   └── settings.py             # /api/v1/settings — get/update config + availability
│   │   │
│   │   └── services/                   # Lógica de negocio (NO confundir con routers)
│   │       ├── __init__.py
│   │       ├── brain.py                # Gemini: system prompt + historial → respuesta
│   │       ├── whatsapp.py             # Whapi: parsear webhook + enviar mensaje
│   │       ├── scheduler.py            # Lógica de disponibilidad y chequeo de slots
│   │       └── reminder.py             # APScheduler: job que envía recordatorios
│   │
│   ├── alembic/
│   │   ├── alembic.ini
│   │   ├── env.py
│   │   └── versions/
│   │
│   ├── tests/
│   │   ├── conftest.py                 # fixtures: async client, test DB
│   │   ├── test_webhook.py
│   │   ├── test_appointments.py
│   │   └── test_brain.py
│   │
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── .env                            # NUNCA en git
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx              # Root layout
│   │   │   ├── login/
│   │   │   │   └── page.tsx            # Formulario de login
│   │   │   └── (dashboard)/
│   │   │       ├── layout.tsx          # Sidebar + header + auth guard
│   │   │       ├── page.tsx            # Home: turnos del día + resumen
│   │   │       ├── agenda/
│   │   │       │   └── page.tsx        # Vista semanal tipo calendario
│   │   │       ├── clientes/
│   │   │       │   ├── page.tsx        # Listado con búsqueda
│   │   │       │   └── [id]/
│   │   │       │       └── page.tsx    # Detalle: datos + historial + turnos
│   │   │       ├── servicios/
│   │   │       │   └── page.tsx        # CRUD servicios con modal
│   │   │       ├── metricas/
│   │   │       │   └── page.tsx        # KPIs + gráficos
│   │   │       └── configuracion/
│   │   │           └── page.tsx        # Datos negocio + prompt + horarios
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                     # Componentes base (Button, Input, Card, Modal, etc.)
│   │   │   ├── Sidebar.tsx
│   │   │   ├── AppointmentCard.tsx
│   │   │   ├── ClientList.tsx
│   │   │   ├── ServiceForm.tsx
│   │   │   ├── MetricsChart.tsx
│   │   │   ├── AvailabilityEditor.tsx
│   │   │   └── ChatHistory.tsx         # Vista de conversación tipo chat
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                  # fetch wrapper con JWT, base URL, error handling
│   │   │   ├── auth.ts                 # useAuth hook, token storage, redirect
│   │   │   └── utils.ts               # formatDate, formatPhone, etc.
│   │   │
│   │   └── types/
│   │       └── index.ts                # Interfaces que espejan Pydantic schemas
│   │
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── package.json
│   └── .env.local                      # NEXT_PUBLIC_API_URL
│
├── docker-compose.yml                  # backend + postgres (dev local)
├── CLAUDE.md
└── docs/
    ├── SCHEMA.sql
    ├── API.md
    ├── ARCHITECTURE.md
    └── DEPLOY.md
```

---

## Flujos principales

### 1. Mensaje entrante (WhatsApp → Agente → Respuesta)

```
Whapi POST /webhook
    ↓
webhook.py: parsear payload → MensajeEntrante(phone, text, message_id, from_me)
    ↓
¿from_me? → ignorar
¿message_id ya existe en DB? → ignorar (dedup)
    ↓
Buscar client por phone → si no existe, crear con name=NULL
Buscar conversation activa → si no existe, crear una nueva
    ↓
Guardar message(role=user) en DB
    ↓
brain.py:
  1. Cargar system_prompt de business_config
  2. Cargar últimos 20 messages de la conversación
  3. Llamar Gemini API con: system + historial + mensaje nuevo
  4. Parsear respuesta: ¿detectó intención de agendar? ¿presupuesto?
    ↓
Si intención de agendar:
  scheduler.py: buscar slot disponible → crear appointment(status=pending)
  → respuesta incluye confirmación del turno
    ↓
Guardar message(role=assistant) en DB
Actualizar client.last_contact_at
    ↓
whatsapp.py: enviar respuesta via Whapi POST /messages/text
```

### 2. Recordatorio automático

```
APScheduler job (cada 5 minutos):
    ↓
reminder.py: SELECT * FROM reminders WHERE status='pending' AND remind_at <= NOW()
    ↓
Para cada reminder:
  1. Cargar appointment + client
  2. Armar mensaje (template default o custom)
  3. Enviar via whatsapp.py
  4. UPDATE reminder SET status='sent', sent_at=NOW()
  5. Si falla: status='failed', error=detalle
```

### 3. Auth del dashboard

```
Login: POST /api/v1/auth/login { username, password }
    ↓
auth.py: verificar username == DASHBOARD_USER, bcrypt.verify(password, DASHBOARD_PASSWORD_HASH)
    ↓
Generar JWT con python-jose: { sub: username, exp: now + 24h }
    ↓
Frontend guarda token en localStorage
    ↓
Cada request: header Authorization: Bearer <token>
    ↓
Dependency get_current_user() decodifica y valida JWT
```

---

## Patrones de código

### Config (pydantic-settings)

```python
# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    gemini_api_key: str
    whapi_token: str
    whapi_api_url: str = "https://gate.whapi.cloud"
    port: int = 8000
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"
    jwt_secret: str
    dashboard_user: str = "admin"
    dashboard_password_hash: str

    class Config:
        env_file = ".env"

settings = Settings()
```

### Database session (dependency)

```python
# app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

engine = create_async_engine(settings.database_url)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with async_session() as session:
        yield session
```

### Gemini (brain.py)

```python
# app/services/brain.py
from google import genai

client = genai.Client(api_key=settings.gemini_api_key)

async def generate_response(message: str, history: list[dict], system_prompt: str) -> str:
    contents = []
    for msg in history:
        contents.append(genai.types.Content(
            role=msg["role"],
            parts=[genai.types.Part(text=msg["content"])]
        ))
    contents.append(genai.types.Content(
        role="user",
        parts=[genai.types.Part(text=message)]
    ))

    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            max_output_tokens=1024,
        )
    )
    return response.text
```

### Whapi (whatsapp.py)

```python
# app/services/whatsapp.py
import httpx
from dataclasses import dataclass

@dataclass
class IncomingMessage:
    phone: str
    text: str
    message_id: str
    from_me: bool

def parse_webhook(payload: dict) -> list[IncomingMessage]:
    messages = []
    for msg in payload.get("messages", []):
        messages.append(IncomingMessage(
            phone=msg.get("chat_id", ""),
            text=msg.get("text", {}).get("body", ""),
            message_id=msg.get("id", ""),
            from_me=msg.get("from_me", False),
        ))
    return messages

async def send_message(phone: str, text: str) -> bool:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{settings.whapi_api_url}/messages/text",
            json={"to": phone, "body": text},
            headers={"Authorization": f"Bearer {settings.whapi_token}"},
        )
        return r.status_code == 200
```

### Frontend API client

```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  appointments: {
    list: (params?: string) => fetchAPI(`/api/v1/appointments?${params}`),
    create: (data: any) => fetchAPI("/api/v1/appointments", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => fetchAPI(`/api/v1/appointments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },
  // ... similar para clients, services, quotes, metrics, settings
};
```

---

## Dependencias Python (requirements.txt)

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
google-genai>=1.0.0
httpx>=0.27.0
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.30.0
alembic>=1.14.0
pydantic-settings>=2.6.0
python-jose[cryptography]>=3.3.0
bcrypt>=4.0.0
python-dotenv>=1.0.0
apscheduler>=3.10.0
python-multipart>=0.0.9
```

---

## Dependencias Frontend (package.json parcial)

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^2.12.0",
    "lucide-react": "^0.400.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "@types/react": "^19.0.0"
  }
}
```

---

## Notas sobre recordatorios (APScheduler)

- Se inicializa en el lifespan de FastAPI
- Job `check_reminders` corre cada 5 minutos
- Busca reminders con `status='pending'` y `remind_at <= now()`
- Template default: "Hola {client.name}, te recordamos tu turno de {appointment.title} mañana a las {appointment.start_time}. Si necesitás cancelar o reprogramar, respondé a este mensaje."
- Al crear un appointment con `send_reminder=true`, se crean reminders automáticamente (ej: 24h antes y 2h antes)
- Si el appointment se cancela, los reminders pendientes pasan a `status='cancelled'`
