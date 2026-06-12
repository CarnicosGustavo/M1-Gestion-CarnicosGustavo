# Centro de Distribución de Cárnicos Gustavo

Sistema de gestión integral para una **distribuidora de carne de cerdo (CEDIS)**.
Cubre el ciclo operativo completo del día — desde la compra de cerdos en pie
hasta el cobro al cliente — con inventario dual (piezas + kilos), despiece por
recetas, pesaje en báscula, cobranza a crédito y un asistente de IA integrado.

Construido sobre el núcleo de [FinOpenPOS](https://github.com/JoaoHenriqueBarbosa/FinOpenPOS)
y personalizado a fondo para el negocio.

> **App en producción:** [dashboard.carnicosgustavo.com](https://dashboard.carnicosgustavo.com) · **Desarrollo:** carnicosgustavo.abdev.click (Vercel)

---

## 🔄 El flujo operativo del día

```
1. Compra del día   →  Registra cerdos comprados (americanos/nacionales) → stock de canales
2. Despiece         →  Corta canales en piezas según recetas y demanda de pedidos
3. Pedidos / POS    →  Captura lo que pide cada cliente (por pieza y/o kg)
4. Pesaje (báscula) →  Pesa cada pieza (peso real = bruto − tara) → listo para cobro
5. Cobro            →  Fija precio/kg → cobra (contado o crédito) → ticket
6. Cobranza         →  Gestiona cuentas por cobrar y abonos
7. Rendimiento      →  Mide cuánto rindió el despiece vs lo estimado; calibra recetas
```

**Transversal:** **Antonella**, un asistente de IA (Claude) que consulta y opera
todos los módulos anteriores mediante lenguaje natural.

---

## 🧩 Módulos

| Módulo | Ruta | Qué hace |
|--------|------|----------|
| **Panel** | `/admin` | KPIs financieros (ingresos, gastos, utilidad) y gráficas. |
| **Compra del día** | `/admin/purchase` | Compra en pie por proveedor; alimenta el stock de canales. |
| **Despiece** | `/admin/despiece` | Despieza canales en piezas y variantes según la demanda. |
| **Pedidos** | `/admin/orders` | Lista y detalle de pedidos; crear, editar, cobrar, ticket. |
| **POS** | `/admin/pos` | Captura de pedidos con resolución de precios y stock. |
| **Báscula** | `/admin/weighing-station` | Estación de pesaje pieza por pieza (modo kiosco). |
| **Cobro** | `/admin/checkout` | Cola de cobro: precio/kg → total → contado/crédito. |
| **Cobranza** | `/admin/collections` | Cuentas por cobrar, abonos, recordatorios WhatsApp. |
| **Clientes** | `/admin/customers` | Catálogo de clientes con saldo y ficha 360°. |
| **Rendimiento** | `/admin/yield` | Rendimiento de despiece por proveedor; calibra recetas. |
| **Productos** | `/admin/products` | Catálogo maestro (piezas padre vs hijos). |
| **Recetas / Configurador** | `/admin/inventory/recipes` · `/admin/configurador` | Define el despiece: canal → piezas → variantes, con % de peso. **Núcleo del sistema.** |
| **Precios** | `/admin/prices` | Lista de precios propia por cliente. |
| **Inventario Frío** | `/admin/cold-inventory` | Transferencias entre fresco y congelado. |
| **Caja / Métodos de pago** | `/admin/cashier` · `/admin/payment-methods` | Transacciones de caja y catálogo de pagos. |
| **Antonella (IA)** | `/admin/antonella` · `/admin/settings/antonella` | Asistente de IA + su pantalla de configuración. |

> 📐 Para una descripción exhaustiva pantalla por pantalla (botones, datos,
> conexiones) ver [`GUIA_UI_UX_PLATAFORMA.md`](GUIA_UI_UX_PLATAFORMA.md).

---

## 🐷 Conceptos del dominio

- **Canal** — medio cerdo o cerdo entero sacrificado. Tipos: **Americano**
  (canal completo ≈105 kg), **Nacional Lado Lomo** (≈52.5 kg), **Nacional Lado
  Espilomo** (≈52.5 kg), **Polinesio** (≈105 kg).
- **Despiece** — cortar un canal en piezas según una **receta** que define
  cuántas piezas y qué % del peso sale de cada corte.
- **Variante / 2º nivel** — una pieza se corta a su vez (PIERNA → JAMÓN) y el
  jamón tiene variantes (JAMÓN S/H, C/G, PINTO).
- **Inventario dual** — el stock se mide en **piezas (pz)** y **kilos (kg)** a la vez.
- **Demanda viva** — piezas pedidas en órdenes abiertas (no canceladas/completadas).

Mapa detallado del despiece: [`docs/mapa-despiece-porcino.md`](docs/mapa-despiece-porcino.md).

---

## 🛠️ Stack técnico

- **Framework:** Next.js 16 (App Router, Turbopack)
- **API:** tRPC v11 (routers en `apps/web/src/lib/trpc/routers/`)
- **Base de datos:** PostgreSQL en Supabase + ORM Drizzle (`packages/db/src/schema.ts`)
- **Auth:** Better-Auth
- **UI:** React 19 + Tailwind CSS v4 + componentes `@finopenpos/ui` (shadcn/ui)
- **IA:** SDK de Anthropic (`@anthropic-ai/sdk`) — modelos Claude
- **Monorepo:** Turborepo + Bun
- **Deploy:** Vercel

### Estructura del monorepo

```
dashboard/
├── apps/web/              App Next.js (admin, POS, API tRPC, login)
│   └── src/
│       ├── app/admin/         Páginas del dashboard
│       ├── components/         Componentes (antonella-chat, admin-layout…)
│       ├── hooks/              Hooks (useAntonellaHistory…)
│       └── lib/trpc/routers/   Lógica de negocio (orders, products, yields, antonella…)
├── packages/
│   ├── db/                Esquema Drizzle (fuente de verdad del schema)
│   ├── api/              Utilidades de API compartidas
│   ├── auth/             Better-Auth
│   ├── ui/               Design system (shadcn/ui)
│   └── fiscal/          Motor fiscal (heredado de FinOpenPOS; NFC-e Brasil, no usado por CG)
├── sql/                  Scripts SQL manuales (triggers, rebuild) — ver sql/README.md
└── docs/                Documentación técnica
```

---

## 🚀 Puesta en marcha (local)

Requisitos: **Bun** ≥ 1.3, acceso a la base de datos de Supabase.

```bash
# 1. Instalar dependencias (desde la raíz del monorepo)
bun install

# 2. Configurar variables de entorno
cp apps/web/.env.example apps/web/.env.local
#   → edita apps/web/.env.local con los valores reales (ver PROYECTO_INFO.md)

# 3. Levantar el servidor de desarrollo
bun run dev --filter=web      # http://localhost:3001
```

### Verificación antes de hacer push (evita fallos de build en Vercel)

```bash
cd apps/web
bunx tsc --noEmit            # tipos
cd ..
bunx biome check apps/web/src/…   # lint/format de los archivos tocados
bunx next build             # build real (lo que corre Vercel)
```

> El proyecto tiene ~20 errores de tipos **preexistentes** en archivos heredados
> (fiscal, health). Al validar, filtra por los archivos que tocaste; lo que no
> debe fallar es la **compilación** (`✓ Compiled successfully`).

---

## ⚙️ Variables de entorno

Plantilla completa en [`apps/web/.env.example`](apps/web/.env.example). Resumen:

| Variable | Para qué | Dónde |
|----------|----------|-------|
| `DATABASE_URL` | Conexión a Supabase (Postgres) | Local + Vercel |
| `BETTER_AUTH_SECRET` | Firma de sesiones | Local + Vercel |
| `BETTER_AUTH_URL` / `BASE_URL` | URL del despliegue | Local + Vercel |
| `ANTHROPIC_API_KEY` | Motor de IA de Antonella | Local + **Vercel** ⚠️ |
| `NEXT_PUBLIC_LOCALE` | Idioma (`es`) | Local + Vercel |
| `RUN_SEED` | Semilla inicial (siempre `false` en prod) | Local |

> ⚠️ **Antonella** no funciona sin `ANTHROPIC_API_KEY` configurada en las
> variables de entorno de Vercel (Production/Preview/Development).
>
> 🔐 Los **valores reales** de claves y conexiones están en `PROYECTO_INFO.md`
> (no versionado). Nunca subas secretos al repositorio.

---

## 🗄️ Base de datos

- El **esquema** es la fuente de verdad en `packages/db/src/schema.ts` (Drizzle).
- Los **triggers** y datos semilla viven en [`sql/`](sql/) y se aplican a mano en
  el editor SQL de Supabase (ver [`sql/README.md`](sql/README.md)).
- Tablas clave: `products` (stock dual), `product_transformations` (recetas),
  `orders` / `order_items`, `inventory_transactions` (auditoría),
  `channel_purchases`, `antonella_config`, `web_orders`.

---

## 🤝 Créditos

Desarrollado sobre [FinOpenPOS](https://github.com/JoaoHenriqueBarbosa/FinOpenPOS)
por **ABDev.click**, personalizado para **Centro de Distribución de Cárnicos Gustavo**.
