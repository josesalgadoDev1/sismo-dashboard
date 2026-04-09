-- =====================================================================
-- Autenticación: tabla de usuarios y seeds iniciales
-- Ejecutar contra la BD de Collahuasi (psql $DATABASE_URL -f sql/001_auth.sql)
-- =====================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255),                      -- NULL cuando auth_method = 'sso'
  nombre          VARCHAR(255) NOT NULL,
  rol             VARCHAR(20)  NOT NULL CHECK (rol IN ('admin', 'operador')),
  activo          BOOLEAN      NOT NULL DEFAULT TRUE,
  auth_method     VARCHAR(20)  NOT NULL DEFAULT 'password'
                  CHECK (auth_method IN ('password', 'sso')),
  ultimo_login    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios (activo) WHERE activo = TRUE;

-- Trigger sencillo para updated_at
CREATE OR REPLACE FUNCTION trg_usuarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS usuarios_updated_at ON usuarios;
CREATE TRIGGER usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION trg_usuarios_updated_at();

-- =====================================================================
-- Seeds iniciales
-- Contraseñas bcrypt generadas localmente (cost = 10):
--   admin@collahuasi.cl      -> Admin2026!
--   operador@collahuasi.cl   -> Operador2026!
-- IMPORTANTE: cambiar estas contraseñas después del primer login.
-- =====================================================================

INSERT INTO usuarios (email, password_hash, nombre, rol, auth_method)
VALUES
  (
    'admin@collahuasi.cl',
    '$2b$10$bLXLWIAnYLr39Zg8vuHp4.2sa/b4/Su3dEJ/AtFAFtRuMVbRNnQTO',
    'Administrador Collahuasi',
    'admin',
    'password'
  ),
  (
    'operador@collahuasi.cl',
    '$2b$10$9U2KySEFygHTgF.4ERIqMu6ZsxGlgkSUJfBIaFmxyaI/IJK9/tXV6',
    'Operador Collahuasi',
    'operador',
    'password'
  )
ON CONFLICT (email) DO NOTHING;
