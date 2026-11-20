-- 0005: añade el valor COBRADO al enum order_item_status (bases NUEVAS).
--
-- Verificado en el repo (sin consultar ninguna base real):
--   * Producción / schema.ts / supabase/schema/app_tables.sql:
--     order_items.status es varchar(50). El tipo order_item_status NO existe.
--   * Bases nuevas creadas con 0000_baseline.sql: la columna usa el enum
--     public.order_item_status, que no incluye COBRADO. El primer cobro
--     parcial fallaría al insertar ese valor.
--
-- Este script es un no-op si el tipo no existe (producción) o si COBRADO
-- ya está en el enum. NO aplicar sin OK de Beto: `bun run db:migrate`
-- también ejecutaría 0003 y 0004, que siguen pendientes.

DO $migration$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_catalog.pg_type t
		JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
		WHERE t.typname = 'order_item_status'
			AND n.nspname = 'public'
	) AND NOT EXISTS (
		SELECT 1
		FROM pg_catalog.pg_enum e
		JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
		JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public'
			AND t.typname = 'order_item_status'
			AND e.enumlabel = 'COBRADO'
	) THEN
		ALTER TYPE "public"."order_item_status" ADD VALUE IF NOT EXISTS 'COBRADO';
	END IF;
END
$migration$;
