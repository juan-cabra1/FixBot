# Planning — Frontend MVP + Auth

## Estado actual del proyecto

- Backend FastAPI funcionando en `backend/`
- 9 tablas PostgreSQL (business_config, clients, conversations, messages, appointments, services, availability, quotes, reminders)
- Gemini 2.5 Flash como LLM, Whapi.cloud como proveedor WhatsApp
- Debouncer de 6s para mensajes múltiples
- System prompt en DB (`business_config.system_prompt`)
- Deploy: Railway (backend + PostgreSQL), Vercel (frontend)
- Auth backend AÚN NO IMPLEMENTADO

---

## Scope del MVP a construir

### Backend (falta implementar)
1. Agregar a `backend/app/config.py`:
   - `jwt_secret: str`
   - `dashboard_user: str = "admin"`
   - `dashboard_password_hash: str`

2. Crear `backend/app/auth.py`:
   - Función `create_token(username)` → JWT con `python-jose`, expira 24h
   - Función `verify_password(plain, hashed)` → bcrypt
   - Dependency `get_current_user(token)` → decodifica JWT, lanza 401 si inválido

3. Crear `backend/app/routers/auth.py`:
   - `POST /api/v1/auth/login` → recibe `{username, password}`, retorna `{access_token, token_type}`

4. Implementar los endpoints que el frontend necesita (actualmente solo existe `/webhook`):
   - `GET/PATCH /api/v1/clients` y `GET /api/v1/clients/{id}` (con recent_messages)
   - `GET/POST/PATCH/DELETE /api/v1/appointments`
   - `GET/PUT /api/v1/settings` y `GET/PUT /api/v1/settings/availability`
   - Proteger todos con `get_current_user` dependency (excepto `/webhook` y `/login`)

5. Instalar dependencias faltantes: `python-jose[cryptography]`, `bcrypt`

### Frontend (todo nuevo en `frontend/`)
Stack: Next.js 15, React 19, Tailwind CSS, TypeScript strict

**4 páginas:**
1. `/login` — formulario username/password, guarda JWT en localStorage
2. `/` (dashboard home) — turnos del día con status, botón cambiar estado
3. `/clientes` — lista paginada con búsqueda + detalle con historial de chat tipo WhatsApp
4. `/configuracion` — editar system_prompt, nombre del agente, mensajes, horarios

**Estructura:**
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx        ← sidebar + auth guard
│   │       ├── page.tsx          ← turnos del día
│   │       ├── clientes/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       └── configuracion/
│   │           └── page.tsx
│   ├── lib/
│   │   ├── api.ts    ← fetch wrapper con JWT, maneja 401 → redirect /login
│   │   ├── auth.ts   ← useAuth hook, token en localStorage
│   │   └── utils.ts  ← formatDate, formatPhone
│   └── types/
│       └── index.ts  ← interfaces TypeScript (Client, Appointment, BusinessConfig, etc.)
├── package.json
├── tailwind.config.ts
├── next.config.ts
└── .env.local        ← NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Variables de entorno a agregar

**Railway (backend):**
```
JWT_SECRET=<generar con: python -c "import secrets; print(secrets.token_hex(32))">
DASHBOARD_USER=admin
DASHBOARD_PASSWORD_HASH=<generar con: python -c "import bcrypt; print(bcrypt.hashpw(b'tu-password', bcrypt.gensalt()).decode())">
```

**Vercel (frontend):**
```
NEXT_PUBLIC_API_URL=https://tu-app.up.railway.app
```

---

## Dependencias a instalar

**Backend (agregar a `backend/requirements.txt`):**
```
python-jose[cryptography]>=3.3.0
bcrypt>=4.0.0
```

**Frontend (`frontend/package.json`):**
```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.400.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "@types/react": "^19.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Convenciones del proyecto

- Código en inglés (variables, funciones, tipos)
- Español en UI (labels, mensajes al usuario)
- Next.js App Router — Server Components por defecto, `"use client"` solo cuando hay estado
- Tailwind CSS, sin CSS modules
- TypeScript strict, sin `any`
- `const` sobre `let`, nunca `var`
- Functional: `map/filter/reduce` sobre loops

---

## Lo que queda para después (fuera del MVP)
- Métricas y gráficos
- Presupuestos (quotes)
- CRUD de servicios
- Vista semanal de agenda (calendar)
- Editor de disponibilidad
- APScheduler para recordatorios automáticos
- Alembic migrations
