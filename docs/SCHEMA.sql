-- ============================================================
-- WhatsApp AgentKit — Schema PostgreSQL
-- ============================================================
-- Cada cliente-trabajador tiene su propia DB.
-- Ejecutar via Alembic (este archivo es referencia, no se ejecuta directo).
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. business_config — Configuración del negocio (siempre 1 fila)
-- ============================================================
CREATE TABLE business_config (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200)  NOT NULL,              -- "Electricidad Gómez"
    description     TEXT,                                 -- Rubro, qué hace, zona de cobertura
    owner_name      VARCHAR(200)  NOT NULL,              -- Nombre del trabajador/dueño
    phone           VARCHAR(50)   NOT NULL,              -- WhatsApp del negocio
    timezone        VARCHAR(50)   NOT NULL DEFAULT 'America/Argentina/Cordoba',
    -- Config del agente IA
    agent_name      VARCHAR(100)  NOT NULL,              -- Nombre visible: "Ana", "Soporte", etc.
    agent_tone      VARCHAR(50)   NOT NULL DEFAULT 'amigable', -- profesional/amigable/vendedor/empatico
    system_prompt   TEXT          NOT NULL,               -- Prompt completo para Gemini
    welcome_message TEXT          NOT NULL DEFAULT 'Hola! ¿En qué puedo ayudarte?',
    fallback_message TEXT         NOT NULL DEFAULT 'Disculpa, no entendí tu mensaje. ¿Podrías reformularlo?',
    outside_hours_msg TEXT        NOT NULL DEFAULT 'Gracias por escribirnos. Estamos fuera de horario, te responderemos pronto.',
    -- Timestamps
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Trigger para auto-update de updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_business_config_updated
    BEFORE UPDATE ON business_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 2. services — Servicios que ofrece el trabajador
-- ============================================================
CREATE TABLE services (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(200)   NOT NULL,             -- "Instalación eléctrica domiciliaria"
    description      TEXT,                                -- Detalle del servicio
    price            DECIMAL(12,2),                       -- NULL = "a convenir"
    currency         VARCHAR(3)     NOT NULL DEFAULT 'ARS',
    duration_minutes INT,                                 -- Duración estimada (NULL = variable)
    is_active        BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 3. availability — Bloques de disponibilidad semanal
-- ============================================================
-- El trabajador define cuándo atiende. Varios bloques por día permitidos
-- (ej: lunes 9-12 y 14-18).
CREATE TABLE availability (
    id           SERIAL PRIMARY KEY,
    day_of_week  SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=lunes, 6=domingo
    start_time   TIME        NOT NULL,
    end_time     TIME        NOT NULL,
    is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_availability_day ON availability(day_of_week) WHERE is_active = TRUE;


-- ============================================================
-- 4. clients — Clientes finales (personas que escriben por WhatsApp)
-- ============================================================
CREATE TABLE clients (
    id              SERIAL PRIMARY KEY,
    phone           VARCHAR(50)   NOT NULL UNIQUE,       -- Número de WhatsApp (con código país)
    name            VARCHAR(200),                         -- Puede ser NULL al inicio, el agente lo pregunta
    email           VARCHAR(200),                         -- Opcional
    address         TEXT,                                 -- Dirección habitual (opcional)
    notes           TEXT,                                 -- Notas internas del trabajador
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()  -- Se actualiza con cada mensaje
);

CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_last_contact ON clients(last_contact_at DESC);


-- ============================================================
-- 5. conversations — Hilos de conversación
-- ============================================================
-- Un cliente puede tener varias conversaciones (se archivan por inactividad o manualmente).
CREATE TABLE conversations (
    id          SERIAL PRIMARY KEY,
    client_id   INT          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status      VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_client ON conversations(client_id);
CREATE INDEX idx_conversations_active ON conversations(client_id) WHERE status = 'active';

CREATE TRIGGER trg_conversations_updated
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 6. messages — Mensajes individuales
-- ============================================================
CREATE TABLE messages (
    id                  SERIAL PRIMARY KEY,
    conversation_id     INT          NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role                VARCHAR(20)  NOT NULL CHECK (role IN ('user', 'assistant')),
    content             TEXT         NOT NULL,
    whatsapp_message_id VARCHAR(100),                    -- ID de Whapi para deduplicación
    tokens_in           INT,                              -- Tokens de entrada (para tracking de costos)
    tokens_out          INT,                              -- Tokens de salida
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE UNIQUE INDEX idx_messages_whatsapp_id ON messages(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;


-- ============================================================
-- 7. appointments — Turnos / trabajos agendados
-- ============================================================
CREATE TABLE appointments (
    id          SERIAL PRIMARY KEY,
    client_id   INT          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    service_id  INT          REFERENCES services(id) ON DELETE SET NULL,  -- NULL = trabajo custom
    title       VARCHAR(300) NOT NULL,                   -- "Revisar tablero eléctrico"
    date        DATE         NOT NULL,
    start_time  TIME         NOT NULL,
    end_time    TIME,                                     -- NULL = se calcula de service.duration_minutes
    status      VARCHAR(20)  NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    address     TEXT,                                     -- Dirección del trabajo
    notes       TEXT,                                     -- Notas del turno
    created_by  VARCHAR(20)  NOT NULL DEFAULT 'agent'     -- 'agent' o 'dashboard' (quién lo creó)
                CHECK (created_by IN ('agent', 'dashboard')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_date ON appointments(date, start_time);
CREATE INDEX idx_appointments_client ON appointments(client_id);
CREATE INDEX idx_appointments_status ON appointments(status) WHERE status IN ('pending', 'confirmed');
CREATE INDEX idx_appointments_upcoming ON appointments(date, start_time) WHERE status IN ('pending', 'confirmed');

CREATE TRIGGER trg_appointments_updated
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 8. quotes — Presupuestos
-- ============================================================
CREATE TABLE quotes (
    id          SERIAL PRIMARY KEY,
    client_id   INT           NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    service_id  INT           REFERENCES services(id) ON DELETE SET NULL,
    description TEXT          NOT NULL,                   -- Detalle del presupuesto
    amount      DECIMAL(12,2) NOT NULL,
    currency    VARCHAR(3)    NOT NULL DEFAULT 'ARS',
    status      VARCHAR(20)   NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
    valid_until DATE,                                     -- Fecha de validez
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_quotes_status ON quotes(status);


-- ============================================================
-- 9. reminders — Recordatorios automáticos
-- ============================================================
-- Un appointment puede tener varios reminders (ej: 24h antes + 2h antes).
-- El background job consulta reminders pendientes y envía por WhatsApp.
CREATE TABLE reminders (
    id             SERIAL PRIMARY KEY,
    appointment_id INT          NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    remind_at      TIMESTAMPTZ  NOT NULL,                -- Cuándo enviar el recordatorio
    message        TEXT,                                  -- Mensaje custom (NULL = usar template default)
    status         VARCHAR(20)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    sent_at        TIMESTAMPTZ,                          -- Cuándo se envió efectivamente
    error          TEXT,                                  -- Detalle del error si falló
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reminders_pending ON reminders(remind_at) WHERE status = 'pending';
CREATE INDEX idx_reminders_appointment ON reminders(appointment_id);


-- ============================================================
-- Notas para Alembic
-- ============================================================
-- - Los modelos SQLAlchemy en backend/app/models/ deben espejar este schema
-- - Usar mapped_column() con Mapped[] type hints (SQLAlchemy 2.0 style)
-- - El trigger update_updated_at() se aplica a: business_config, conversations, appointments
-- - Los CHECK constraints se definen también en los modelos con __table_args__
-- - Siempre TIMESTAMPTZ (timezone-aware), nunca TIMESTAMP naive
