# Scripts SQL — Cárnicos Gustavo

Scripts que se ejecutan **manualmente** en el editor SQL de Supabase.
No forman parte de las migraciones de Drizzle; son operaciones puntuales o
triggers que viven en la base de datos.

## Vigentes

| Archivo | Qué hace | Cuándo se corre |
|---------|----------|-----------------|
| `01_sync_web_orders_trigger.sql` | Trigger que sincroniza `web_orders` → `orders` cuando llega un pedido del sitio web / app de pedidos. Vincula `web_order_id`, busca `product_id` por nombre, calcula `requires_weighing`. | Una vez (ya aplicado). Re-ejecutar solo si se modifica el trigger. |
| `02_fix_trigger_pedidos_app.sql` | Parche al trigger anterior: acepta también `source='pedidos-app'` (pedidos.carnicosgustavo.com), no solo `'website'`. | Una vez (ya aplicado, 30 may 2026). |
| `03_security_hardening.sql` | Cierra huecos del advisor de seguridad: RLS en `bkp_uid_migration_20260618`, `credit_balances` → `security_invoker` + sin acceso anon/authenticated, revoca EXECUTE de anon/authenticated/PUBLIC en las funciones SECURITY DEFINER (`importar_saldo_legacy`, `validar_saldo_legacy`, `sync_web_order_to_dashboard`), fija `search_path` en funciones de staging. No destructivo; incluye verificación y rollback. | Una vez (ya aplicado en producción el 10 oct 2026, migración `security_hardening_20261010`). |

## Rebuild (reconstrucción del catálogo — históricos)

Scripts de la reconstrucción limpia del 29 may 2026. **Ya ejecutados.** Se
conservan como referencia del catálogo canónico de productos y recetas.

| Archivo | Qué hace |
|---------|----------|
| `rebuild_01_products.sql` | Limpieza total + catálogo canónico de productos (cuenta admin única `test@carnicosgustavo.com`). |
| `rebuild_03_recipes.sql` | Recetas de despiece (`product_transformations`): AMERICANO, NACIONAL_LOMO, NACIONAL_ESPILOMO (nivel 1) y BASE (nivel 2/variantes). Pesos/ratios provisionales. |

## archive/

SQL antiguo superado por los scripts de rebuild. Solo referencia histórica;
no ejecutar.

> ⚠️ Antes de correr cualquier script de rebuild en producción, hacer respaldo.

## Versionado de la base de datos (cómo encaja todo)

Hay **dos historiales** de cambios y ambos están ahora en el repo:

| Dónde | Qué contiene |
|-------|--------------|
| `supabase/migrations/` | Las 29 migraciones aplicadas en producción vía Supabase (tabla `supabase_migrations.schema_migrations`), copiadas literalmente (verificado por md5 contra la BD). Nombre: `<version>_<nombre>.sql`. |
| `apps/web/drizzle/` | Migraciones de Drizzle: `0000_baseline` (jun-2026) + `0001_align_live_schema` (no-op que actualiza el snapshot). Ver `apps/web/drizzle/README.md`. |
| `supabase/schema/app_tables.sql` | Snapshot de **solo estructura** de las tablas de la app (columnas, defaults, FKs, UNIQUE, índices), sacado del catálogo de producción. Base para verificar drift en local. |
| `packages/db/src/schema.ts` | Fuente de verdad para el código. **Alineado con la BD real** (oct 2026). |

⚠️ Algunas migraciones de `supabase/migrations/` son **scripts de datos
destructivos** que ya se corrieron una vez y NO deben re-ejecutarse:
`rebuild_01_clean_slate` (borra pedidos/productos), `rebuild_02_canonical_products`,
`rebuild_03_recipes`, `reset_pruebas_para_real` (respalda y borra datos de
operación) y `fill_estimated_weights_all`. Están versionadas como historial, no
para reproducir una base desde cero.

La BD también tiene objetos que **no** están versionados aquí: tablas heredadas
del sistema anterior, tablas de respaldo `bkp_*`, el esquema `staging` y las
vistas de validación de saldos. No las gestiona Drizzle (`drizzle.config.ts`
usa `tablesFilter` para no tocarlas).

### Flujo para cambios de esquema (a partir de ahora)

1. Editar `packages/db/src/schema.ts`.
2. `cd apps/web && bun run db:generate` → revisar el SQL de `drizzle/NNNN_*.sql`.
3. Aplicar con `bun run db:migrate` (o pegar el SQL en el editor de Supabase y
   registrar la fila en `drizzle.__drizzle_migrations`).
4. Actualizar `supabase/schema/app_tables.sql` si cambió la estructura y correr
   la verificación de drift.

No usar `drizzle-kit push` contra producción.

### Verificar drift (sin tocar producción)

```bash
cd apps/web
bun run db:verify-drift   # carga supabase/schema/app_tables.sql en PGlite (memoria)
                          # y pide a drizzle-kit el diff contra schema.ts → "0 statements"
```

Para refrescar el snapshot desde producción se usan consultas de **solo lectura**
a `pg_catalog`/`information_schema` (o `pg_dump --schema-only` con credenciales
de solo lectura). Nunca subir credenciales ni cadenas de conexión al repo.
