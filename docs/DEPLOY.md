# Deploy — WhatsApp AgentKit

---

## Arquitectura de deploy

```
┌──────────────┐     ┌──────────────────────────────────┐
│   Vercel      │────▶│   Railway                         │
│   (frontend)  │     │   ┌──────────┐  ┌─────────────┐  │
│   Next.js     │     │   │ FastAPI   │──│ PostgreSQL   │  │
└──────────────┘     │   │ + APSched │  │ (managed)    │  │
                     │   └──────────┘  └─────────────┘  │
┌──────────────┐     │        ↕                          │
│ Whapi.cloud   │────▶│   /webhook                       │
│ (WhatsApp)    │     └──────────────────────────────────┘
└──────────────┘
```

---

## 1. Deploy Backend en Railway

### Prerequisitos
- Repo en GitHub con la carpeta `backend/`
- Cuenta en Railway

### Pasos

1. **Crear proyecto en Railway**
   - railway.app → New Project → Deploy from GitHub
   - Seleccionar el repo, Railway detecta el Dockerfile en `backend/`

2. **Agregar PostgreSQL**
   - En el proyecto, click "New" → Database → PostgreSQL
   - Railway genera la `DATABASE_URL` automáticamente

3. **Variables de entorno**
   En Railway → Settings → Variables, agregar:

   ```
   GEMINI_API_KEY=...
   WHAPI_TOKEN=...
   WHAPI_API_URL=https://gate.whapi.cloud
   DATABASE_URL=${{Postgres.DATABASE_URL}}  ← Railway la interpola automáticamente
   PORT=8000
   ENVIRONMENT=production
   FRONTEND_URL=https://tu-app.vercel.app
   JWT_SECRET=...  ← generar con: python -c "import secrets; print(secrets.token_hex(32))"
   DASHBOARD_USER=admin
   DASHBOARD_PASSWORD_HASH=...  ← generar con: python -c "import bcrypt; print(bcrypt.hashpw(b'tu-password', bcrypt.gensalt()).decode())"
   ```

   **IMPORTANTE:** La `DATABASE_URL` de Railway usa `postgresql://`.
   En `config.py` se debe reemplazar a `postgresql+asyncpg://` para asyncpg.

4. **Configurar root directory**
   Railway → Settings → Root Directory: `backend`

5. **Verificar deploy**
   Railway asigna una URL pública: `https://tu-app.up.railway.app`
   Probar: `curl https://tu-app.up.railway.app/` → `{"status": "ok"}`

6. **Ejecutar migraciones**
   Desde Railway → terminal del servicio:
   ```bash
   alembic upgrade head
   ```
   O agregar al Dockerfile como entrypoint.

7. **Seed de datos iniciales**
   Insertar la fila de `business_config` con los datos del cliente:
   ```bash
   python -c "from app.seed import seed_business; import asyncio; asyncio.run(seed_business())"
   ```

---

## 2. Configurar Webhook en Whapi

1. Ir a whapi.cloud → Dashboard → Settings → Webhooks
2. URL: `https://tu-app.up.railway.app/webhook`
3. Método: POST
4. Eventos: messages (al menos)
5. Guardar y activar

Probar enviando un mensaje al número de WhatsApp conectado.

---

## 3. Deploy Frontend en Vercel

### Pasos

1. Importar repo en Vercel → seleccionar la carpeta `frontend/`
2. Variables de entorno:
   ```
   NEXT_PUBLIC_API_URL=https://tu-app.up.railway.app
   ```
3. Deploy automático con cada push a `main`

### Configuración de Vercel
- Framework: Next.js (auto-detectado)
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `.next`

---

## 4. Checklist post-deploy

- [ ] `GET /` retorna `{"status": "ok"}`
- [ ] Whapi webhook configurado y activo
- [ ] Mensaje de prueba por WhatsApp recibe respuesta
- [ ] Dashboard accesible y login funciona
- [ ] Migraciones ejecutadas (todas las tablas existen)
- [ ] `business_config` tiene la fila con datos del cliente
- [ ] `services` tiene al menos los servicios iniciales
- [ ] `availability` tiene los bloques de horario
- [ ] Recordatorios: verificar que APScheduler está corriendo en logs

---

## 5. Dockerfile (referencia)

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ejecutar migraciones y arrancar servidor
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

---

## 6. docker-compose.yml (desarrollo local)

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "${PORT:-8000}:8000"
    env_file:
      - ./backend/.env
    depends_on:
      - postgres
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: agentkit
      POSTGRES_USER: agentkit
      POSTGRES_PASSWORD: agentkit
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Con esto, `DATABASE_URL=postgresql+asyncpg://agentkit:agentkit@postgres:5432/agentkit`

---

## 7. .gitignore

```gitignore
# Secrets
.env
*.env.local

# DB
*.db
*.sqlite*

# Python
__pycache__/
*.py[cod]
.venv/
venv/

# Node
node_modules/
.next/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

---

## Nuevo cliente: setup rápido

Para cada nuevo cliente-trabajador:

1. Clonar/fork el repo base
2. Crear proyecto Railway + PostgreSQL
3. Configurar variables de entorno
4. Ejecutar migraciones
5. Insertar business_config (nombre, prompt, etc.)
6. Insertar services y availability
7. Conectar número de WhatsApp en Whapi
8. Configurar webhook
9. Deploy frontend en Vercel
10. Verificar con mensaje de prueba
