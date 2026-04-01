# WhatsApp AgentKit — Guía de Proyecto

> Contexto arquitectónico para Claude Code. Este archivo se carga en CADA mensaje,
> mantenerlo corto. Los detalles viven en `docs/` — consultalos con `cat` cuando sea necesario.

---

## Qué es esto

Agente de WhatsApp con IA para trabajadores independientes y PyMEs. El agente atiende
a los clientes finales del trabajador: agenda turnos, responde consultas, genera
presupuestos y envía recordatorios automáticos.

**Modelo:** 1 repo = 1 cliente = 1 deploy. Se personaliza prompt, servicios y config por cliente.

---

## Stack

| Componente      | Tecnología                        |
| --------------- | --------------------------------- |
| Backend         | Python 3.12+ · FastAPI · Uvicorn  |
| LLM             | Gemini 2.5 Flash (`google-genai`) |
| WhatsApp        | Whapi.cloud                       |
| Base de datos   | PostgreSQL · SQLAlchemy · asyncpg |
| Migraciones     | Alembic                           |
| Background jobs | APScheduler                       |
| Auth dashboard  | JWT simple (python-jose + bcrypt) |
| Frontend        | Next.js 15 · React · Tailwind CSS |
| Deploy backend  | Railway (FastAPI + PostgreSQL)     |
| Deploy frontend | Vercel                            |

---

## Documentación detallada (en `docs/`)

Claude Code: leé estos archivos SOLO cuando necesites trabajar en esa área.

| Archivo               | Contenido                                            |
| --------------------- | ---------------------------------------------------- |
| `docs/SCHEMA.sql`     | Schema completo de PostgreSQL con índices y triggers  |
| `docs/API.md`         | Todos los endpoints REST con request/response         |
| `docs/ARCHITECTURE.md`| Estructura de carpetas, flujos, patrones de código    |
| `docs/DEPLOY.md`      | Instrucciones de deploy a Railway + Vercel            |

---

## Estructura del proyecto (resumen)

```
backend/app/
  main.py              # FastAPI app, lifespan, CORS
  config.py            # pydantic-settings
  database.py          # async engine + session
  auth.py              # JWT: login, hash, verify, dependency
  models/              # SQLAlchemy ORM (9 tablas)
  schemas/             # Pydantic v2 request/response
  routers/             # webhook, appointments, clients, services, metrics, settings, auth
  services/            # brain.py, whatsapp.py, scheduler.py, reminder.py
  
frontend/src/app/
  (dashboard)/         # Layout con sidebar
    page.tsx           # Turnos del día
    agenda/            # Vista semanal
    clientes/          # Listado + detalle con historial
    servicios/         # CRUD servicios
    metricas/          # KPIs y gráficos
    configuracion/     # Prompt, negocio, horarios
  login/               # Pantalla de login
```

---

## Variables de entorno

```env
# Gemini
GEMINI_API_KEY=...
# Whapi
WHAPI_TOKEN=...
WHAPI_API_URL=https://gate.whapi.cloud
# PostgreSQL
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/agentkit
# Servidor
PORT=8000
ENVIRONMENT=development
# CORS
FRONTEND_URL=http://localhost:3000
# Auth
JWT_SECRET=...
DASHBOARD_USER=admin
DASHBOARD_PASSWORD_HASH=...  # bcrypt hash
```

---

## Convenciones

- **Async everywhere:** asyncpg, httpx, todas las rutas async
- **Config:** pydantic-settings, jamás hardcodear valores
- **Migraciones:** Alembic siempre. Nunca `create_all()` en producción
- **Schemas:** Pydantic v2, separar Create/Update/Response
- **Código en inglés** (variables, funciones). Español en docstrings, prompts y UI
- **Type hints** en todas las funciones
- **Next.js App Router**, Server Components por defecto, `"use client"` solo con estado
- **Tailwind CSS** para estilos, sin CSS modules
- **Commits:** conventional commits en español
- **Secrets:** jamás en el repo

---

## Reglas para Claude Code

1. No generar archivos ni features que no se pidieron
2. Antes de tocar DB → leer `docs/SCHEMA.sql`
3. Antes de crear endpoints → leer `docs/API.md`
4. Antes de crear archivos nuevos → leer `docs/ARCHITECTURE.md`
5. Cambios de DB siempre con migración Alembic
6. El system prompt vive en `business_config` (DB), no en YAML
7. brain.py usa `google-genai` con `gemini-2.5-flash` — no Anthropic
8. Whapi.cloud es el único proveedor — no abstraer para otros
9. No usar SQLite — siempre PostgreSQL
10. Auth: JWT con python-jose, contraseña hasheada con bcrypt
