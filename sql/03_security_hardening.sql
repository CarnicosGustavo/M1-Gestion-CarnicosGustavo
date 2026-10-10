-- ============================================================================
-- 03_security_hardening.sql — Cierre de huecos de seguridad (Supabase advisors)
-- Proyecto: uajezdrnqujmutjokwfo · Aplicado en producción: 2026-10-10 (migración security_hardening_20261010) · NO destructivo
--
-- Contexto verificado (solo lectura) antes de escribir este script:
--   * La app M1 (Drizzle) y Proyecto 2 / app de pedidos se conectan como
--     `postgres` (pooler) o con `service_role`; ambos roles tienen BYPASSRLS
--     y conservan sus privilegios aquí. Nada de este script les afecta.
--   * Ningún repo (M1 todas las ramas, ui-CarnicosGustavo, app.carnicosgustavo,
--     carnicosgustavo.com) consulta credit_balances ni bkp_uid_migration_* por
--     REST, ni llama RPCs con anon/authenticated. ui-CarnicosGustavo llama
--     rpc('validar_saldo_legacy') con service_role (se conserva).
--   * Edge functions submit-web-order / app-config usan service_role y no
--     invocan RPCs. El trigger sync_web_orders_trigger NO requiere EXECUTE del
--     rol que inserta (Postgres solo valida EXECUTE al crear el trigger).
--   * Logs de 24 h: 0 peticiones a /rest/v1/rpc/*, credit_balances o bkp_*.
-- ============================================================================

BEGIN;

-- 1) Tabla de respaldo sin RLS, legible por anon vía REST (352 filas).
--    Opción por defecto (no destructiva): activar RLS sin políticas ⇒ anon y
--    authenticated quedan bloqueados; postgres/service_role siguen leyendo.
ALTER TABLE public.bkp_uid_migration_20260618 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bkp_uid_migration_20260618 FROM anon, authenticated;
--    Alternativas (elegir UNA en lugar de lo anterior, requieren aprobación):
--    a) Mover fuera del esquema expuesto:
--       CREATE SCHEMA IF NOT EXISTS backup;
--       ALTER TABLE public.bkp_uid_migration_20260618 SET SCHEMA backup;
--    b) Borrar (si ya no se necesita):  DROP TABLE public.bkp_uid_migration_20260618;

-- 2) Vista credit_balances (SECURITY DEFINER implícito: dueño postgres) —
--    hoy anon puede leer nombre + saldo + límite de crédito de los clientes.
ALTER VIEW public.credit_balances SET (security_invoker = true);
REVOKE ALL ON TABLE public.credit_balances FROM anon, authenticated;

-- 3) Funciones SECURITY DEFINER ejecutables por anon/authenticated vía /rpc.
--    Nota: el ACL actual de validar/importar incluye EXECUTE para PUBLIC
--    ("=X/postgres"), por eso anon las puede ejecutar; hay que revocar a PUBLIC.
REVOKE EXECUTE ON FUNCTION public.importar_saldo_legacy(integer, text)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_saldo_legacy(integer, text)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_web_order_to_dashboard()          FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.importar_saldo_legacy(integer, text)   TO service_role;
GRANT  EXECUTE ON FUNCTION public.validar_saldo_legacy(integer, text)    TO service_role;
GRANT  EXECUTE ON FUNCTION public.sync_web_order_to_dashboard()          TO service_role;

-- 3b) search_path: las 3 funciones de public YA lo tienen fijo
--     (staging, public / public) — no se tocan. Se fija en las 2 de staging
--     (advisor 0011), con el mismo valor que hoy heredan del llamador.
ALTER FUNCTION staging.validar_saldo_legacy(integer, text) SET search_path = staging, public, pg_temp;
ALTER FUNCTION staging.validar_todos_los_saldos(text)      SET search_path = staging, public, pg_temp;

-- 4) Evitar que funciones NUEVAS creadas por postgres en public nazcan
--    ejecutables por anon/authenticated (hoy el default ACL de public las
--    concede). Solo afecta funciones futuras. El EXECUTE global a PUBLIC no se
--    puede quitar por esquema; si se quiere, sería (opcional, afecta todos los
--    esquemas, incluido n8n):
--      ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- Verificación post-aplicación (solo lectura)
-- ============================================================================
-- SELECT relname, relrowsecurity FROM pg_class WHERE oid='public.bkp_uid_migration_20260618'::regclass;
-- SELECT reloptions FROM pg_class WHERE oid='public.credit_balances'::regclass;      -- {security_invoker=true}
-- SELECT has_table_privilege('anon','public.credit_balances','SELECT');              -- false
-- SELECT p.oid::regprocedure, has_function_privilege('anon', p.oid, 'EXECUTE')
--   FROM pg_proc p WHERE proname IN ('importar_saldo_legacy','validar_saldo_legacy','sync_web_order_to_dashboard'); -- false
-- SELECT has_function_privilege('service_role','public.validar_saldo_legacy(integer,text)','EXECUTE'); -- true
-- Y volver a correr el advisor de seguridad.

-- ============================================================================
-- Rollback (si algo se rompe)
-- ============================================================================
-- ALTER TABLE public.bkp_uid_migration_20260618 DISABLE ROW LEVEL SECURITY;
-- ALTER VIEW public.credit_balances RESET (security_invoker);
-- GRANT SELECT ON public.credit_balances TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.validar_saldo_legacy(integer, text) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.importar_saldo_legacy(integer, text) TO authenticated;
-- ALTER FUNCTION staging.validar_saldo_legacy(integer, text) RESET search_path;
-- ALTER FUNCTION staging.validar_todos_los_saldos(text)      RESET search_path;
