# Migraciones de base de datos (Drizzle)

Migraciones **versionadas** del schema de Cárnicos Gustavo. La fuente de verdad
del schema sigue siendo `packages/db/src/schema.ts`; esta carpeta guarda el
historial de cambios aplicados a la base (Supabase Postgres).

> Antes solo se usaba `drizzle-kit push` (diff directo contra la base, sin
> historial). Eso provocó al menos un incidente: código en producción que
> esperaba una columna (`customers.price_list_id`) que aún no existía en la base.
> Las migraciones versionadas evitan esa desincronización.

## Flujo de trabajo

### 1. Cambiaste el schema (`packages/db/src/schema.ts`)

```bash
cd apps/web
bun run db:generate            # crea drizzle/NNNN_<nombre>.sql + snapshot
```

Revisa el SQL generado (`drizzle/NNNN_*.sql`) **antes** de aplicarlo. Commitéalo
junto con el cambio de schema.

### 2. Aplicar a la base

```bash
cd apps/web
# requiere DATABASE_URL real (Session pooler de Supabase; ver Vercel/Supabase,
# nunca la pongas en el repo)
bun run db:migrate
```

`db:migrate` solo ejecuta las migraciones que falten (las registra en
`drizzle.__drizzle_migrations`). Es idempotente.

> Alternativa sin terminal: copiar el contenido del `NNNN_*.sql` nuevo y correrlo
> en el **SQL Editor** de Supabase. (Si lo haces así, recuerda que `db:migrate`
> luego lo volvería a intentar; en ese caso registra la fila a mano como en
> `ADOPT_BASELINE.sql`.)

## Primera vez en una base que YA existe (baseline)

La migración `0000_baseline` retrata el estado actual de la base. **No la corras**
sobre la base real (las tablas ya existen). En su lugar, una sola vez:

1. Abre Supabase → SQL Editor.
2. Ejecuta [`ADOPT_BASELINE.sql`](./ADOPT_BASELINE.sql).

Eso marca 0000 como aplicada. A partir de ahí, `db:migrate` solo correrá 0001+.

En una base **vacía** (entorno nuevo) no hagas lo anterior: ahí `db:migrate`
sí debe ejecutar 0000 para crear todo.

## `push` vs `migrate`

- `db:push` — sigue disponible para prototipado rápido en local/desarrollo.
- `db:migrate` — **el camino para staging/producción** (deja historial auditable).

No mezcles ambos sobre la misma base: si usaste `push` para un cambio, genera
igual la migración para mantener el historial consistente.

## Estado actual (oct 2026)

- `0000_baseline` — retrato del schema.ts de jun-2026 (ya registrado en
  producción vía `ADOPT_BASELINE.sql`).
- `0001_align_live_schema` — **no-op** (`SELECT 1;`). Entre jun y oct la BD se
  modificó con migraciones SQL de Supabase (`supabase/migrations/`) y
  `packages/db/src/schema.ts` quedó desfasado. Se alineó schema.ts con la BD real
  y esta migración solo actualiza el snapshot; el diff que drizzle-kit generó
  queda comentado dentro del archivo como referencia. Ejecutarla en producción
  solo registra la fila en `drizzle.__drizzle_migrations`.
- Las tablas `cities`, `fiscal_settings`, `invoices`, `invoice_items`,
  `invoice_events` y `purchase_orders` siguen declaradas en schema.ts (restos del
  proyecto base / código sin uso real) pero **no existen** en producción.
- `drizzle.config.ts` tiene `tablesFilter` para que `push` nunca toque tablas que
  no gestiona drizzle (la BD tiene otras tablas, vistas y el esquema `staging`).

## Triggers y datos semilla

Los triggers SQL y seeds siguen viviendo en [`../../../sql/`](../../../sql/) y se
aplican a mano (no los maneja drizzle). Ver `sql/README.md`.
