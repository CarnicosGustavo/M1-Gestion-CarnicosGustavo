-- ============================================================================
--  ADOPCIÓN DEL BASELINE DE MIGRACIONES  (ejecutar UNA sola vez)
-- ============================================================================
--  Contexto: la base de datos de Supabase ya existe (se creó históricamente con
--  `drizzle-kit push`). Al introducir migraciones versionadas, la migración
--  0000_baseline representa el estado ACTUAL de la base. NO debe ejecutarse
--  sobre la base real (los CREATE TABLE fallarían porque las tablas ya existen).
--
--  En su lugar, este script registra 0000_baseline como "ya aplicada" creando
--  la tabla de control de drizzle e insertando su marca de tiempo. Así,
--  `drizzle-kit migrate` SALTA el baseline y solo aplicará migraciones futuras
--  (0001, 0002, …).
--
--  Cómo correrlo:
--    Supabase → SQL Editor → pega TODO esto → Run.  (Solo una vez, en prod.)
--
--  ⚠️ Solo en bases que YA tienen el schema. En una base vacía no corras esto:
--     ahí sí debe ejecutarse `drizzle-kit migrate` para crear todo desde 0000.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id          SERIAL PRIMARY KEY,
  hash        text NOT NULL,
  created_at  bigint
);

-- Registra 0000_baseline como aplicada solo si la tabla aún no tiene registros
-- (evita duplicar el baseline si este script se corre por error dos veces).
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT
  'a90a7965fd64081086584f57a9281ee368ef758778dddb104fb349419a600c93', -- sha256 de 0000_baseline.sql
  1781451521417  -- "when" de drizzle/meta/_journal.json (idx 0)
WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations);

-- Verificación: debe devolver 1 fila con el baseline.
SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;
