# Scripts SQL — Cárnicos Gustavo

Scripts que se ejecutan **manualmente** en el editor SQL de Supabase
(`https://supabase.com/dashboard/project/uajezdrnqujmutjokwfo/sql`).
No forman parte de las migraciones de Drizzle; son operaciones puntuales o
triggers que viven en la base de datos.

## Vigentes

| Archivo | Qué hace | Cuándo se corre |
|---------|----------|-----------------|
| `01_sync_web_orders_trigger.sql` | Trigger que sincroniza `web_orders` → `orders` cuando llega un pedido del sitio web / app de pedidos. Vincula `web_order_id`, busca `product_id` por nombre, calcula `requires_weighing`. | Una vez (ya aplicado). Re-ejecutar solo si se modifica el trigger. |
| `02_fix_trigger_pedidos_app.sql` | Parche al trigger anterior: acepta también `source='pedidos-app'` (pedidos.carnicosgustavo.com), no solo `'website'`. | Una vez (ya aplicado, 30 may 2026). |

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
> El esquema vivo se gestiona con Drizzle (`packages/db/src/schema.ts`); estos
> scripts son complementarios (triggers y datos semilla).
