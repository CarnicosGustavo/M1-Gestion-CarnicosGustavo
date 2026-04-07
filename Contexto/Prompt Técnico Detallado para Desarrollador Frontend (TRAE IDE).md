# Prompt Técnico Detallado para Desarrollador Frontend (TRAE IDE)

## Proyecto: Cárnicos Gustavo - Interfaz de Despiece, Pesaje y POS Dual

**Objetivo:** Implementar las interfaces de usuario (UI/UX) en el repositorio de **FinOpenPOS** para la gestión de despiece porcino, la estación de pesaje digital y la venta dual (piezas/kilogramos), integrando los nuevos procedimientos de tRPC y el esquema de Supabase.

---

## 1. Contexto del Repositorio

*   **Tecnologías:** Next.js (App Router), Tailwind CSS, Lucide React (iconos), tRPC (Hooks de React), Zod (validaciones).
*   **Estado del Backend:** Los routers `productsRouter` y `ordersRouter` ya tienen los procedimientos `processDisassembly`, `getPendingWeighingOrders`, `updateOrderItemWeight` y `completeOrderPayment` implementados y sincronizados con Drizzle ORM.

---

## 2. Tareas de Implementación (Frontend)

### 2.1. Nueva Página: Módulo de Despiece (`/admin/disassembly`)

**Ubicación:** `apps/web/src/app/admin/disassembly/page.tsx`

**Funcionalidad:**
1.  **Selector de Producto Padre:** Un dropdown que filtre productos con `is_parent_product = true` (ej. CANAL, PIERNA). Debe mostrar el `stock_pieces` actual.
2.  **Selector de Estilo de Corte:** Un grupo de botones o dropdown con las opciones: `DESPIECE_NACIONAL`, `DESPIECE_AMERICANO`, `DESPIECE_POLINESIO`.
3.  **Input de Cantidad:** Número de unidades del padre a despiezar.
4.  **Vista Previa Dinámica:** Al seleccionar el padre y el estilo, debe mostrar una tabla con los productos hijos que se generarán (basado en `product_transformations`).
    *   *Cálculo sugerido:* `Cantidad Hijo = Cantidad Padre * yield_quantity_pieces`.
5.  **Botón "Ejecutar Despiece":** Llama a la mutación `processDisassembly`. Al finalizar, debe mostrar un mensaje de éxito y limpiar el formulario.

### 2.2. Nueva Página: Estación de Pesaje Digital (`/weighing-station`)

**Ubicación:** `apps/web/src/app/weighing-station/page.tsx`

**Funcionalidad:**
1.  **Lista de Órdenes Pendientes:** Llama a `getPendingWeighingOrders`. Debe mostrar órdenes con estado `PENDIENTE_PESAJE`, resaltando las de WhatsApp (`whatsapp_message_id` presente).
2.  **Selección de Orden:** Al seleccionar una orden, muestra sus `order_items` que tengan `status = 'PENDIENTE_PESAJE'`.
3.  **Interfaz de Captura de Peso:**
    *   Muestra el nombre del producto y la cantidad de piezas (ej. "8 Piernas").
    *   **Input de Peso Real (kg):** Un campo numérico grande para ingresar los kg reales pesados en la báscula.
    *   **Botón "Registrar Peso":** Llama a `updateOrderItemWeight`.
4.  **Flujo Continuo:** Al registrar un peso, debe pasar automáticamente al siguiente ítem pendiente de la misma orden.
5.  **Estado de la Orden:** Cuando todos los ítems se pesan, la orden debe desaparecer de la lista de pendientes (ya que su estado cambia a `LISTA_PARA_COBRO`).

### 2.3. Actualización del Punto de Venta (POS) (`/pos`)

**Ubicación:** `apps/web/src/app/pos/page.tsx` (y componentes relacionados del carrito).

**Funcionalidad:**
1.  **Visualización Dual en el Carrito:**
    *   Para productos de peso variable, mostrar la cantidad de piezas y un indicador de "Peso Pendiente".
    *   Si el peso ya fue registrado (vía estación de pesaje), mostrar los kg y el subtotal calculado.
2.  **Lógica de Cobro:**
    *   El botón "Pagar" solo debe habilitarse si todos los ítems de la orden tienen peso registrado (`status = 'PESADO'` o `status = 'COMPLETADO'`).
    *   Si hay ítems pendientes, mostrar un aviso: "Faltan productos por pesar en la estación de báscula".
3.  **Integración de WhatsApp:** Los pedidos que entran por WhatsApp deben aparecer en el historial de órdenes del POS con el estado `PENDIENTE_PESAJE` para que el cajero sepa que el cliente ya pidió y solo falta pesar y cobrar.

---

## 3. Requerimientos de Diseño (UI/UX)

*   **Consistencia:** Usar los componentes de UI existentes en el proyecto (botones, inputs, tablas).
*   **Responsividad:** La Estación de Pesaje debe ser 100% funcional en tablets (mínimo 1024px de ancho).
*   **Feedback Visual:** Usar estados de carga (skeletons) y notificaciones de éxito/error (toasts) para todas las mutaciones de tRPC.
*   **Iconografía:** Usar `Scale` (báscula), `Scissors` (despiece), `CheckCircle` (completado) de Lucide React.

---

## 4. Instrucciones de Implementación

1.  **Revisa los tipos:** Asegúrate de usar los tipos generados por Drizzle y tRPC para los nuevos campos (`stock_pieces`, `quantity_kg`, etc.).
2.  **Manejo de Números:** Recuerda que los campos `numeric` de la DB llegan como strings. Usa `parseFloat()` o `Number()` antes de realizar cálculos en el frontend.
3.  **Optimización:** Usa `trpc.useContext().invalidate()` para refrescar el inventario y las listas de órdenes después de cada mutación exitosa.

---

Este prompt completa la visión de **Cárnicos Gustavo**. Por favor, procede con la creación de los componentes y páginas necesarios. ¡Éxito!
