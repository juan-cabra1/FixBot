# API Reference — WhatsApp AgentKit

Base URL: `http://localhost:8000` (dev) / `https://<app>.up.railway.app` (prod)

---

## Autenticación

JWT Bearer token en header `Authorization: Bearer <token>`.
Solo `/webhook` y `/api/v1/auth/login` son públicos.

### POST /api/v1/auth/login

```json
// Request
{ "username": "admin", "password": "..." }

// Response 200
{ "access_token": "eyJ...", "token_type": "bearer" }

// Response 401
{ "detail": "Credenciales inválidas" }
```

El token expira en 24 horas. El frontend lo guarda en localStorage y lo envía en cada request.

---

## Webhook (WhatsApp)

### POST /webhook
Recibe mensajes de Whapi.cloud. No requiere auth (Whapi no soporta JWT).
Validar con el header `X-Whapi-Token` o por IP si se necesita seguridad extra.

```json
// Request (Whapi payload)
{
  "messages": [{
    "id": "msg_abc123",
    "chat_id": "5491155001234@s.whatsapp.net",
    "from_me": false,
    "text": { "body": "Hola, necesito un electricista" }
  }]
}

// Response 200
{ "status": "ok" }
```

### GET /webhook
Health check simple para Whapi.

---

## Turnos

### GET /api/v1/appointments
Lista turnos con filtros.

Query params:
- `date` (YYYY-MM-DD) — filtrar por fecha exacta
- `from_date` / `to_date` — rango de fechas
- `status` — pending | confirmed | completed | cancelled
- `client_id` — filtrar por cliente

```json
// Response 200
{
  "items": [
    {
      "id": 1,
      "client": { "id": 5, "phone": "+5491155001234", "name": "María López" },
      "service": { "id": 2, "name": "Revisión eléctrica" },
      "title": "Revisar tablero en cocina",
      "date": "2026-04-02",
      "start_time": "10:00",
      "end_time": "11:30",
      "status": "confirmed",
      "address": "Av. Colón 1234, Córdoba",
      "notes": null,
      "created_by": "agent",
      "created_at": "2026-03-30T14:22:00Z"
    }
  ],
  "total": 1
}
```

### POST /api/v1/appointments
Crear turno desde el dashboard.

```json
// Request
{
  "client_id": 5,
  "service_id": 2,
  "title": "Revisar tablero en cocina",
  "date": "2026-04-02",
  "start_time": "10:00",
  "end_time": "11:30",
  "address": "Av. Colón 1234, Córdoba",
  "notes": null,
  "send_reminder": true,
  "reminder_hours_before": [24, 2]
}
```

Si `send_reminder: true`, se crean entradas en `reminders` automáticamente.

### PATCH /api/v1/appointments/{id}
Actualizar turno (cambiar estado, horario, etc).

```json
// Request (campos parciales)
{ "status": "completed" }
{ "date": "2026-04-03", "start_time": "14:00" }
```

### DELETE /api/v1/appointments/{id}
Cancela el turno (soft delete: cambia status a `cancelled`).

---

## Clientes

### GET /api/v1/clients
Lista clientes con búsqueda.

Query params:
- `search` — busca en nombre y teléfono
- `page` / `per_page` — paginación (default: page=1, per_page=20)
- `order_by` — last_contact_at (default) | name | created_at

```json
// Response 200
{
  "items": [
    {
      "id": 5,
      "phone": "+5491155001234",
      "name": "María López",
      "notes": "Clienta frecuente, zona norte",
      "created_at": "2026-01-15T10:00:00Z",
      "last_contact_at": "2026-03-30T14:22:00Z",
      "total_appointments": 3
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 20
}
```

### GET /api/v1/clients/{id}
Detalle del cliente con historial de conversaciones recientes.

```json
// Response 200
{
  "id": 5,
  "phone": "+5491155001234",
  "name": "María López",
  "email": null,
  "address": "Zona norte, Córdoba",
  "notes": "Clienta frecuente",
  "created_at": "2026-01-15T10:00:00Z",
  "last_contact_at": "2026-03-30T14:22:00Z",
  "recent_messages": [
    { "role": "user", "content": "Hola, necesito revisar el tablero", "created_at": "..." },
    { "role": "assistant", "content": "¡Hola María! Claro, ...", "created_at": "..." }
  ],
  "appointments": [
    { "id": 1, "title": "Revisar tablero", "date": "2026-04-02", "status": "confirmed" }
  ],
  "quotes": []
}
```

### PATCH /api/v1/clients/{id}
Actualizar datos del cliente (nombre, notas, dirección).

---

## Servicios

### GET /api/v1/services
Lista todos los servicios.

```json
// Response 200
[
  {
    "id": 2,
    "name": "Revisión eléctrica",
    "description": "Revisión completa del sistema eléctrico domiciliario",
    "price": 15000.00,
    "currency": "ARS",
    "duration_minutes": 90,
    "is_active": true
  }
]
```

### POST /api/v1/services

```json
// Request
{
  "name": "Instalación de luminarias",
  "description": "Colocación de luminarias con materiales incluidos",
  "price": 25000.00,
  "duration_minutes": 120
}
```

### PUT /api/v1/services/{id}
Actualizar servicio completo.

### DELETE /api/v1/services/{id}
Desactiva el servicio (soft delete: `is_active = false`).

---

## Presupuestos

### GET /api/v1/quotes
Lista presupuestos con filtros.

Query params:
- `client_id`, `status`, `from_date`, `to_date`

### POST /api/v1/quotes

```json
// Request
{
  "client_id": 5,
  "service_id": 2,
  "description": "Revisión de tablero + cambio de térmica",
  "amount": 35000.00,
  "valid_until": "2026-04-15"
}
```

### PATCH /api/v1/quotes/{id}
Cambiar estado del presupuesto.

---

## Métricas

### GET /api/v1/metrics
KPIs agregados del negocio.

Query params:
- `from_date` / `to_date` — período (default: últimos 30 días)

```json
// Response 200
{
  "period": { "from": "2026-03-01", "to": "2026-03-31" },
  "messages": {
    "total": 342,
    "from_clients": 180,
    "from_agent": 162
  },
  "appointments": {
    "total": 28,
    "completed": 22,
    "cancelled": 3,
    "pending": 3
  },
  "quotes": {
    "total": 12,
    "accepted": 7,
    "rejected": 2,
    "pending": 3,
    "total_amount": 245000.00
  },
  "clients": {
    "new": 8,
    "returning": 15,
    "total_active": 23
  },
  "top_services": [
    { "service": "Revisión eléctrica", "count": 12 },
    { "service": "Instalación", "count": 8 }
  ]
}
```

### GET /api/v1/metrics/daily
Datos por día para gráficos.

```json
// Response 200
{
  "days": [
    { "date": "2026-03-25", "messages": 45, "appointments": 3, "quotes_sent": 1 },
    { "date": "2026-03-26", "messages": 38, "appointments": 4, "quotes_sent": 2 }
  ]
}
```

---

## Configuración

### GET /api/v1/settings
Retorna la config actual del negocio y agente.

### PUT /api/v1/settings
Actualiza configuración completa.

```json
// Request
{
  "name": "Electricidad Gómez",
  "description": "Servicio eléctrico domiciliario en Córdoba",
  "owner_name": "Carlos Gómez",
  "agent_name": "Ana",
  "agent_tone": "amigable",
  "system_prompt": "Eres Ana, la asistente virtual de...",
  "welcome_message": "¡Hola! Soy Ana...",
  "fallback_message": "...",
  "outside_hours_msg": "..."
}
```

### GET /api/v1/settings/availability
Retorna bloques de disponibilidad semanal.

### PUT /api/v1/settings/availability
Reemplaza todos los bloques de disponibilidad.

```json
// Request
{
  "blocks": [
    { "day_of_week": 0, "start_time": "09:00", "end_time": "13:00" },
    { "day_of_week": 0, "start_time": "15:00", "end_time": "19:00" },
    { "day_of_week": 1, "start_time": "09:00", "end_time": "13:00" }
  ]
}
```

---

## Notas generales

- Todas las fechas en ISO 8601, timezone-aware (UTC en respuestas)
- Paginación: `page` + `per_page` donde aplique
- Errores: `{ "detail": "mensaje de error" }` con HTTP status code apropiado
- Soft deletes en appointments (→ cancelled) y services (→ is_active=false)
- El frontend convierte UTC → timezone del negocio (de business_config)
