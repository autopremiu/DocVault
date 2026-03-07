-- ============================================================
-- DOCVAULT v2 — SCHEMA SUPABASE (PostgreSQL)
-- Ejecutar en: Supabase → SQL Editor → New Query
-- ============================================================

-- 1. ADMINS
CREATE TABLE IF NOT EXISTS dv_admins (
  id           SERIAL PRIMARY KEY,
  nombre       VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  activo       BOOLEAN DEFAULT TRUE,
  ultimo_acceso TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CUENTAS MEGA (estado de uso)
CREATE TABLE IF NOT EXISTS dv_mega_cuentas (
  id           SERIAL PRIMARY KEY,
  numero       INT NOT NULL UNIQUE,        -- 1, 2, 3, 4
  email        VARCHAR(150) NOT NULL,
  bytes_usados BIGINT DEFAULT 0,
  limite_bytes BIGINT DEFAULT 15032385536, -- 14 GB en bytes
  activa       BOOLEAN DEFAULT TRUE,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CARPETAS
CREATE TABLE IF NOT EXISTS dv_carpetas (
  id           SERIAL PRIMARY KEY,
  nombre       VARCHAR(200) NOT NULL,
  descripcion  VARCHAR(500),
  icono        VARCHAR(50) DEFAULT '📁',
  departamento VARCHAR(100),
  admin_id     INT REFERENCES dv_admins(id),
  activo       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carpetas_nombre ON dv_carpetas(nombre);
CREATE INDEX IF NOT EXISTS idx_carpetas_dept   ON dv_carpetas(departamento);

-- 4. DOCUMENTOS (solo metadata — archivos en MEGA)
CREATE TABLE IF NOT EXISTS dv_documentos (
  id              SERIAL PRIMARY KEY,
  uuid            VARCHAR(36)  NOT NULL UNIQUE,
  nombre_original VARCHAR(500) NOT NULL,
  nombre_display  VARCHAR(500) NOT NULL,
  tipo            VARCHAR(20)  NOT NULL CHECK (tipo IN ('excel','word','ppt','pdf','otro')),
  extension       VARCHAR(10)  NOT NULL,
  tamanio_bytes   BIGINT       NOT NULL,
  tamanio_display VARCHAR(20),
  carpeta_id      INT REFERENCES dv_carpetas(id),
  admin_id        INT REFERENCES dv_admins(id),
  -- Datos de MEGA (dónde está el archivo físico)
  mega_cuenta_id  INT REFERENCES dv_mega_cuentas(id),
  mega_node_id    VARCHAR(200),            -- ID del nodo en MEGA
  mega_link       VARCHAR(500),            -- Link público de descarga
  -- Extra
  descripcion     VARCHAR(1000),
  tags            VARCHAR(500),
  descargas       INT DEFAULT 0,
  activo          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_carpeta  ON dv_documentos(carpeta_id);
CREATE INDEX IF NOT EXISTS idx_docs_tipo     ON dv_documentos(tipo);
CREATE INDEX IF NOT EXISTS idx_docs_created  ON dv_documentos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_uuid     ON dv_documentos(uuid);
CREATE INDEX IF NOT EXISTS idx_docs_mega     ON dv_documentos(mega_cuenta_id);
-- Índice de texto completo
CREATE INDEX IF NOT EXISTS idx_docs_busqueda ON dv_documentos 
  USING gin(to_tsvector('spanish', nombre_display || ' ' || COALESCE(tags,'')));

-- 5. ACTIVIDAD / AUDIT LOG
CREATE TABLE IF NOT EXISTS dv_actividad (
  id          SERIAL PRIMARY KEY,
  admin_id    INT REFERENCES dv_admins(id),
  accion      VARCHAR(50)  NOT NULL,
  descripcion VARCHAR(500),
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_act_admin   ON dv_actividad(admin_id);
CREATE INDEX IF NOT EXISTS idx_act_created ON dv_actividad(created_at DESC);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION fn_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_docs_updated
  BEFORE UPDATE ON dv_documentos
  FOR EACH ROW EXECUTE FUNCTION fn_updated_at();

-- ============================================================
-- DATOS INICIALES
-- ============================================================

-- Admin por defecto  (password: Admin2024! — CAMBIAR EN PRODUCCIÓN)
INSERT INTO dv_admins (nombre, email, password) VALUES
('Administrador', 'admin@docvault.com',
 '$2a$10$X9vUxBPqTl5kOHGx4mE9aOyQ5lK8NqB1cZ3dR7tM2sW6jF0iE4pGu')
ON CONFLICT (email) DO NOTHING;

-- Registrar las 4 cuentas MEGA (actualizar con los emails reales)
INSERT INTO dv_mega_cuentas (numero, email) VALUES
(1, 'autopremiummanizales@gmail.com'),
(2, 'cuenta2@gmail.com'),
(3, 'cuenta3@gmail.com'),
(4, 'cuenta4@gmail.com')
ON CONFLICT (numero) DO NOTHING;

-- Carpetas iniciales
INSERT INTO dv_carpetas (nombre, icono, departamento, admin_id) VALUES
('Finanzas',          '💰', 'Finanzas',   1),
('Recursos Humanos',  '👥', 'RRHH',       1),
('Proyectos',         '🚀', 'Proyectos',  1),
('Legal',             '⚖️', 'Legal',      1),
('Marketing',         '📢', 'Marketing',  1),
('Dirección General', '🏢', 'Dirección',  1)
ON CONFLICT DO NOTHING;
