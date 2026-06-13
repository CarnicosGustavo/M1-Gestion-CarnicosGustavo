# Integración con Supabase

La app conecta a Supabase por **dos vías independientes**:

| Vía | Para qué | Mecanismo |
|---|---|---|
| **Drizzle → Postgres** | Toda la lógica de negocio (CRUD, tRPC) | Conexión Postgres (`DATABASE_URL`), pooler en modo *transaction* |
| **Cliente Supabase JS** | Realtime y Storage | HTTPS REST/WebSocket (`NEXT_PUBLIC_SUPABASE_URL` + claves) |

La autenticación de usuarios es **Better-Auth**, no Supabase Auth. Las claves de
Supabase JS solo habilitan features de infraestructura.

## Archivos

- `client.ts` — cliente de navegador (anon key), singleton. `getSupabaseBrowserClient()`, `isSupabaseConfigured()`.
- `server.ts` — cliente de servidor (service role, omite RLS). `import "server-only"`. `getSupabaseServerClient()`.
- `use-realtime-table.ts` — hook `useRealtimeTable` para suscribirse a cambios de una tabla. **No-op silencioso** si Supabase no está configurado.

Ya está cableado en `app/admin/weighing-station` y `app/admin/orders`: cuando
cambian `orders` / `order_items`, la lista se refresca al instante (con el
polling existente como respaldo).

## Variables de entorno

Definidas y validadas en `@finopenpos/env` (zod). Ver `apps/web/.env.example`.

```bash
# Postgres (Drizzle) — runtime de la app: usar el POOLER (transaction, :6543)
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres

# Migraciones — opcional pero RECOMENDADO: conexión DIRECTA (:5432).
# El pooler en modo transaction no soporta bien el DDL de drizzle-kit.
DATABASE_URL_MIGRATIONS=postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres

# Cliente Supabase JS
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # solo servidor, nunca al cliente
```

> Las credenciales se obtienen en Supabase → Project Settings → **Database**
> (connection strings) y **API** (URL + claves).

## Runbook de puesta en marcha (local / Vercel)

> ⚠️ Estos pasos **no** corren en Claude Code on the web: su proxy solo enruta
> HTTP/HTTPS, así que el puerto Postgres queda bloqueado. Ejecútalos en tu
> máquina o en un entorno con acceso a la base.

1. **Configura el entorno.** Crea `apps/web/.env` (gitignored) con las variables
   de arriba, o ponlas en las env vars de Vercel.

2. **Aplica el esquema** (crea las tablas en Supabase):
   ```bash
   cd apps/web
   bun run db:push        # drizzle-kit push
   ```

3. **Verifica la conexión** (Postgres + cliente JS):
   ```bash
   cd apps/web
   bun run db:check
   ```
   Debe reportar conexión OK, tablas presentes y consulta REST exitosa.

4. **Habilita Realtime** para las tablas que se observan en vivo. **No requiere
   plan Pro.** Hazlo por SQL (SQL Editor):
   ```sql
   alter publication supabase_realtime add table public.orders, public.order_items;
   ```
   O por dashboard: Database → **Publications** → `supabase_realtime` → activa
   `orders` y `order_items`.

   > ⚠️ No confundir con Database → **Replication** (Read Replicas): esa función
   > sí pide Small compute / Pro y **no la necesitamos** para Realtime.

5. **(Opcional) RLS.** El cliente de navegador usa la anon key y respeta RLS.
   Si no defines políticas, las suscripciones Realtime/consultas anónimas no
   verán filas. El cliente de servidor (service role) omite RLS.

## Probar el cliente JS dentro de Claude Code on the web

Es posible (solo el cliente JS, no Drizzle) si añades el host al egress:
entorno → **Custom** network access → *Allowed domains* → `*.supabase.co`
(deja marcado el set por defecto). El cambio aplica a una **sesión nueva**.
