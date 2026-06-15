# CLAUDE.md — M1-Gestion-CarnicosGustavo (PROYECTO 1 de 2: sistema actual)

> Lee esto primero. Identifica plenamente este proyecto y su relación con el otro.

## 🪪 Identidad
- **Nombre:** `M1-Gestion-CarnicosGustavo` — **Centro de Distribución de Cárnicos Gustavo**.
  Fork de **FinOpenPOS**, personalizado a fondo para el negocio.
- **Qué es:** el **sistema completo en producción** — backend + lógica de negocio +
  la **UI actual (shadcn/ui)**. Es la fuente de verdad funcional y de datos.
- **Repositorio:** https://github.com/CarnicosGustavo/M1-Gestion-CarnicosGustavo
- **Rama de producción:** `main`
- **Deploy (Vercel):**
  - **Producción:** `dashboard.carnicosgustavo.com`
  - **Desarrollo:** `carnicosgustavo.abdev.click`
- **Ubicación local (este entorno):** `/home/claude/app`

## 🎯 Propósito
Cubre el ciclo operativo del día de una distribuidora de carne de cerdo (CEDIS):
**Compra del día → Despiece → Pedidos/POS → Pesaje → Cobro → Cobranza → Rendimiento**,
con inventario dual (piezas + kg), recetas de despiece y un asistente IA (Antonella).

## 🔗 Relación con el PROYECTO 2 (ui-CarnicosGustavo)
- El **Proyecto 2** es **una UI nueva** (diseño pixel-perfect, Vite) que **reemplazará**
  a esta UI shadcn cuando esté lista.
- Ambos **comparten la misma base de datos Supabase** (proyecto `uajezdrnqujmutjokwfo`).
- El Proyecto 2 **no usa la API tRPC de este repo**; replica su contrato vía funciones
  serverless propias. Por eso **este proyecto es la referencia funcional**: su guía
  `GUIA_UI_UX_PLATAFORMA.md` documenta qué hace cada pantalla/botón.

## 🧱 Stack
- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**.
- **API:** **tRPC v11** (routers en `apps/web/src/lib/trpc/routers/`).
- **DB:** **PostgreSQL en Supabase** + **Drizzle ORM** (schema: `packages/db/src/schema.ts`).
- **Auth:** **Better-Auth**. **UI:** **Tailwind v4 + shadcn/ui** (`@finopenpos/ui`).
- **IA:** **Anthropic SDK** (Claude) — asistente "Antonella".
- **Monorepo:** **Turborepo + Bun**. **Deploy:** Vercel.
- Migraciones: **Drizzle** (`apps/web/drizzle/`, baseline adoptado). Triggers/seed en `sql/`.
- Nota: `next.config.mjs` tiene `typescript.ignoreBuildErrors: true` (hay deuda de tipos
  preexistente; la compilación pasa igual).

## 📁 Estructura (resumen)
```
M1-Gestion-CarnicosGustavo/
├── apps/web/                 App Next.js (admin, POS, API tRPC, login)
│   └── src/
│       ├── app/admin/        Pantallas (panel, purchase, despiece, orders, pos,
│       │                     weighing-station, checkout, collections, customers,
│       │                     yield, prices, products, cold-inventory, cashier,
│       │                     payment-methods, settings, antonella, ...)
│       ├── components/        (admin-layout, ticket-modal, order-disassembly-manager…)
│       └── lib/trpc/routers/  Lógica de negocio (orders, products, yields, inventory,
│                              collections, customers, customer-prices, dashboard…)
├── packages/                 db (schema Drizzle), ui (shadcn), auth, api, env, fiscal
├── sql/                      triggers/seed manuales (Supabase SQL editor)
└── docs/                     documentación técnica
```

## ▶️ Cómo correr
```
bun install
cp apps/web/.env.example apps/web/.env.local   # editar con valores reales
bun run dev --filter=web                        # http://localhost:3001
```
Env clave: `DATABASE_URL` (Supabase), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`/`BASE_URL`,
`ANTHROPIC_API_KEY` (Antonella), `NEXT_PUBLIC_LOCALE=es`.

## 📚 Documentación clave
- **`GUIA_UI_UX_PLATAFORMA.md`** — guía funcional **exhaustiva** (cada pantalla, botón,
  input, estado, endpoint). **La referencia para comparar UI/UX.**
- `README.md` — visión general, módulos, flujo del día.
- `docs/` — arquitectura, motor fiscal (heredado), esquema de DB, etc.
- `docs/mapa-despiece-porcino.md` — dominio del despiece.

## 🆚 Para comparar UI/UX con el Proyecto 2
- **Proyecto 1 (este, `dashboard.carnicosgustavo.com`):** UI **shadcn**, completa y
  estable, genérica. Referencia funcional.
- **Proyecto 2 (`1.carnicosgustavo.com`):** UI de **diseño** (cremas, fuentes display,
  Ramón en header, layout táctil), más fiel a la marca, cableando funcionalidad.
- Comparar pantalla por pantalla con `GUIA_UI_UX_PLATAFORMA.md` (aquí) y, en el
  Proyecto 2, `docs/TAREAS_POR_PANTALLA.md`.
