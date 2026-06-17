-- ──────────────────────────────────────────────────────
-- Bartez CRM — Migración 001: Schema completo
-- ──────────────────────────────────────────────────────

-- ── Enums ─────────────────────────────────────────────
CREATE TYPE etapa_empresa AS ENUM (
  'Prospecto',
  'Contactado',
  'Derivado a Compras',
  'En alta de proveedor',
  'Proveedor habilitado',
  'Cotización enviada',
  'Cliente',
  'Inactivo/Perdido'
);

CREATE TYPE sector_empresa AS ENUM (
  'Siderurgia', 'Metalurgia', 'Autopartes', 'Maquinaria agrícola',
  'Agroexportadora', 'Lácteos', 'Alimentos', 'Frigorífico',
  'Seguros', 'Prepaga', 'Salud', 'Banca', 'Cooperativa',
  'Retail', 'Mutual', 'Automotriz', 'Industria',
  'Servicio público', 'Entretenimiento', 'Otro'
);

CREATE TYPE canal_contacto AS ENUM (
  'Email', 'Formulario', 'Portal', 'WhatsApp', 'Teléfono'
);

CREATE TYPE prioridad_enum AS ENUM ('Alta', 'Media', 'Baja');

CREATE TYPE area_contacto AS ENUM (
  'Recepción', 'Compras', 'IT', 'Administración', 'Gerencia', 'Otro'
);

CREATE TYPE tipo_interaccion AS ENUM (
  'Email enviado', 'Email recibido', 'Llamada', 'WhatsApp',
  'Formulario', 'Reunión', 'Cotización', 'Nota'
);

CREATE TYPE estado_oportunidad AS ENUM (
  'Abierta', 'Cotizada', 'En negociación', 'Ganada', 'Perdida'
);

-- ── Función updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$;

-- ── empresas ───────────────────────────────────────────
CREATE TABLE empresas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  razon_social          text NOT NULL,
  nombre_fantasia       text,
  cuit                  text,
  sector                sector_empresa NOT NULL,
  ciudad                text NOT NULL,
  provincia             text NOT NULL DEFAULT 'Santa Fe',
  distancia_km          integer,
  domicilio             text,
  sitio_web             text,
  telefono              text,
  email_principal       text,

  prioridad             prioridad_enum NOT NULL DEFAULT 'Media',
  canal_preferido       canal_contacto NOT NULL DEFAULT 'Email',
  etapa                 etapa_empresa NOT NULL DEFAULT 'Prospecto',
  origen                text,
  notas                 text,

  proxima_accion        text,
  proxima_accion_fecha  date,

  docs_alta             jsonb NOT NULL DEFAULT '{
    "constancia_afip": false,
    "iibb": false,
    "datos_bancarios": false,
    "cuit_certificado": false,
    "formulario_proveedor": false,
    "contrato_firmado": false
  }',

  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_empresas_etapa         ON empresas(etapa);
CREATE INDEX idx_empresas_prioridad     ON empresas(prioridad);
CREATE INDEX idx_empresas_proxima_fecha ON empresas(proxima_accion_fecha);
CREATE INDEX idx_empresas_user          ON empresas(user_id);
CREATE INDEX idx_empresas_sector        ON empresas(sector);

CREATE TRIGGER trg_empresas_updated
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── contactos ──────────────────────────────────────────
CREATE TABLE contactos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  nombre       text NOT NULL,
  cargo        text,
  area         area_contacto NOT NULL DEFAULT 'Otro',
  email        text,
  telefono     text,
  es_principal boolean NOT NULL DEFAULT false,
  notas        text,

  creado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contactos_empresa ON contactos(empresa_id);

-- ── interacciones ──────────────────────────────────────
CREATE TABLE interacciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  contacto_id     uuid REFERENCES contactos(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  tipo            tipo_interaccion NOT NULL,
  canal           canal_contacto,
  fecha           timestamptz NOT NULL DEFAULT now(),
  asunto          text,
  descripcion     text,
  resultado       text,
  etapa_snapshot  etapa_empresa,

  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interacciones_empresa ON interacciones(empresa_id);
CREATE INDEX idx_interacciones_fecha   ON interacciones(fecha DESC);

-- ── tareas ─────────────────────────────────────────────
CREATE TABLE tareas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid REFERENCES empresas(id) ON DELETE CASCADE,
  oportunidad_id  uuid,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  titulo          text NOT NULL,
  descripcion     text,
  vencimiento     date NOT NULL,
  prioridad       prioridad_enum NOT NULL DEFAULT 'Media',
  completada      boolean NOT NULL DEFAULT false,
  completada_en   timestamptz,

  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tareas_vencimiento ON tareas(vencimiento);
CREATE INDEX idx_tareas_empresa     ON tareas(empresa_id);
CREATE INDEX idx_tareas_pendientes  ON tareas(completada, vencimiento) WHERE completada = false;

-- ── oportunidades ──────────────────────────────────────
CREATE TABLE oportunidades (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  titulo                text NOT NULL,
  descripcion           text,
  monto_estimado        numeric(14,2),
  moneda                text NOT NULL DEFAULT 'ARS',
  estado                estado_oportunidad NOT NULL DEFAULT 'Abierta',
  probabilidad          integer CHECK (probabilidad BETWEEN 0 AND 100),
  fecha_cierre_estimada date,
  motivo_perdida        text,

  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tareas ADD CONSTRAINT fk_tareas_oportunidad
  FOREIGN KEY (oportunidad_id) REFERENCES oportunidades(id) ON DELETE SET NULL;

CREATE INDEX idx_oportunidades_empresa ON oportunidades(empresa_id);
CREATE INDEX idx_oportunidades_estado  ON oportunidades(estado);

CREATE TRIGGER trg_oportunidades_updated
  BEFORE UPDATE ON oportunidades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── historial_etapas ───────────────────────────────────
CREATE TABLE historial_etapas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id),
  etapa_desde  etapa_empresa,
  etapa_hasta  etapa_empresa NOT NULL,
  notas        text,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_historial_empresa ON historial_etapas(empresa_id);

-- ── RLS ────────────────────────────────────────────────
ALTER TABLE empresas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE interacciones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE oportunidades     ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_etapas  ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuario ve y modifica solo sus filas
CREATE POLICY "propietario" ON empresas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "propietario" ON contactos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "propietario" ON interacciones
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "propietario" ON tareas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "propietario" ON oportunidades
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "propietario" ON historial_etapas
  FOR ALL USING (auth.uid() = user_id);
