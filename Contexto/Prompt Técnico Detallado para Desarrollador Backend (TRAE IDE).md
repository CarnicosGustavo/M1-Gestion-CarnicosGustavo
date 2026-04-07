# Prompt Técnico Detallado para Desarrollador Backend (TRAE IDE)

## Proyecto: Cárnicos Gustavo - Integración de Despiece y Pesaje

**Objetivo:** Implementar la lógica de negocio para la gestión de despiece porcino, inventario dual (piezas y kilogramos) y el flujo de ventas con pesaje automatizado, integrando el módulo de pedidos de WhatsApp existente con el sistema FinOpenPOS y la estación de pesaje Arduino.

--- 

## 1. Estado Actual del Backend (Supabase)

Se han ejecutado las migraciones SQL necesarias en la base de datos de Supabase (`uajezdrnqujmutjokwfo`). El esquema actual de `public` incluye:

### 1.1. Tablas Modificadas

*   **`public.products`:**
    *   `id` (PK, INTEGER)
    *   `name` (VARCHAR)
    *   `description` (TEXT)
    *   `price_per_kg` (NUMERIC)
    *   `unit` (VARCHAR)
    *   `active` (BOOLEAN)
    *   `sort_order` (INTEGER)
    *   `createdAt` (TIMESTAMP)
    *   `updatedAt` (TIMESTAMP)
    *   **Nuevas Columnas:**
        *   `stock_pieces` (INTEGER, DEFAULT 0, NOT NULL): Cantidad en stock en piezas.
        *   `stock_kg` (NUMERIC, DEFAULT 0.0, NOT NULL): Cantidad en stock en kilogramos.
        *   `is_parent_product` (BOOLEAN, DEFAULT FALSE, NOT NULL): Indica si el producto puede ser despiezado (ej. CANAL, CABEZA).
        *   `is_sellable_by_unit` (BOOLEAN, DEFAULT TRUE, NOT NULL): Indica si el producto se puede vender por unidad.
        *   `is_sellable_by_weight` (BOOLEAN, DEFAULT TRUE, NOT NULL): Indica si el producto se puede vender por peso.
        *   `default_sale_unit` (VARCHAR(10), DEFAULT 'KG', NOT NULL): Unidad de medida por defecto para la venta (PZA o KG).
        *   `price_per_piece` (NUMERIC, NULLABLE): Precio por pieza del producto (si aplica).

*   **`public.order_items`:**
    *   `id` (PK, INTEGER)
    *   `order_id` (FK a `orders`, INTEGER)
    *   `product_id` (FK a `products`, INTEGER)
    *   `product_name` (VARCHAR)
    *   `quantity_kg` (NUMERIC)
    *   `unit_price` (NUMERIC)
    *   `subtotal` (NUMERIC)
    *   `createdAt` (TIMESTAMP)
    *   **Nuevas Columnas:**
        *   `quantity_pieces` (INTEGER, NULLABLE): Cantidad de piezas solicitadas/entregadas.
        *   `status` (VARCHAR(50), DEFAULT 'PENDING', NOT NULL): Estado del ítem (ej. 'PENDIENTE_PESAJE', 'PESADO', 'COMPLETADO').

*   **`public.orders`:**
    *   `id` (PK, INTEGER)
    *   `customer_id` (FK a `customers`, INTEGER)
    *   `status` (USER-DEFINED/VARCHAR): Estado de la orden (ej. 'PENDIENTE_PESAJE', 'LISTA_PARA_COBRO', 'COMPLETADA').
    *   `total_amount` (NUMERIC)
    *   `notes` (TEXT)
    *   `delivery_address` (TEXT)
    *   `whatsapp_message_id` (VARCHAR)
    *   `createdAt` (TIMESTAMP)
    *   `updatedAt` (TIMESTAMP)
    *   **Nueva Columna:**
        *   `requires_weighing` (BOOLEAN, DEFAULT FALSE, NOT NULL): Indica si algún ítem de la orden requiere pesaje.

### 1.2. Nuevas Tablas Creadas

*   **`public.product_transformations`:**
    *   `id` (PK, SERIAL)
    *   `parent_product_id` (FK a `products`, INTEGER, NOT NULL)
    *   `child_product_id` (FK a `products`, INTEGER, NOT NULL)
    *   `yield_quantity_pieces` (NUMERIC, NOT NULL): Cantidad de piezas del hijo por cada unidad del padre.
    *   `yield_weight_ratio` (NUMERIC, NOT NULL): Porcentaje de peso del padre que representa el hijo.
    *   `transformation_type` (VARCHAR(50), NOT NULL): Estilo de despiece (ej. 'DESPIECE_NACIONAL', 'DESPIECE_AMERICANO', 'DESPIECE_PIERNA', 'DESPIECE_CABEZA').
    *   `is_active` (BOOLEAN, DEFAULT TRUE, NOT NULL)
    *   `created_at` (TIMESTAMP WITH TIME ZONE)
    *   `updated_at` (TIMESTAMP WITH TIME ZONE)

*   **`public.inventory_transactions`:**
    *   `id` (PK, SERIAL)
    *   `product_id` (FK a `products`, INTEGER, NOT NULL)
    *   `quantity_change_pieces` (INTEGER, NULLABLE)
    *   `quantity_change_kg` (NUMERIC, NULLABLE)
    *   `transaction_type` (VARCHAR(50), NOT NULL): Tipo de movimiento (ej. 'ENTRADA_CANAL', 'DESPIECE', 'VENTA', 'AJUSTE').
    *   `reference_id` (INTEGER, NULLABLE): ID de la orden o despiece asociado.
    *   `notes` (TEXT, NULLABLE)
    *   `created_at` (TIMESTAMP WITH TIME ZONE)

### 1.3. Productos Insertados (Ejemplos)

Se han insertado productos clave como 'CANAL', 'ESPILOMO', 'ESPALDILLA', 'LOMO AMERICANO', 'HUESO AMERICANO', 'JAMON', 'CODILLO', 'MITAD DE CUERO', 'CUERO CON PANZA', 'BARRIGA SIN CUERO', 'MASCARA COMPLETA', 'CACHETE', 'LENGUA', 'OREJAS'. Es crucial que el desarrollador verifique que todos los productos necesarios para las recetas de despiece existan en `public.products`.

### 1.4. Recetas de Desensamble Insertadas (Ejemplos)

Se han insertado recetas de despiece para 'CANAL' (Nacional, Americano, Polinesio), 'PIERNA', 'CABEZA', 'MITAD DE CUERO', 'ESPALDILLA' y 'COSTILLAR' en `public.product_transformations`. Estas son las bases para la lógica de despiece.

--- 

## 2. Implementación de Lógica de Negocio (tRPC)

El desarrollador debe modificar y añadir procedimientos en el router de tRPC (`packages/api/src/routers/`) para manejar la nueva lógica.

### 2.1. Router de Productos (`productsRouter`)

*   **Modificar `processDisassembly` (Mutación):**
    *   **Entrada:** `parentProductId: number`, `quantityToProcess: number`, `transformationType: 'DESPIECE_NACIONAL' | 'DESPIECE_AMERICANO' | 'DESPIECE_POLINESIO' | 'DESPIECE_PIERNA' | 'DESPIECE_CABEZA' | 'DESPIECE_CUERO' | 'DESPIECE_ESPALDILLA' | 'DESPIECE_COSTILLAR'`.
    *   **Lógica:**
        1.  **Transacción:** Toda la operación debe ejecutarse dentro de una transacción de base de datos para garantizar la atomicidad.
        2.  **Validar Stock Padre:** Obtener el producto padre de `public.products`. Verificar que `parent.stock_pieces >= quantityToProcess`.
        3.  **Calcular Peso Promedio Padre:** `parent_average_weight_per_piece = parent.stock_kg / parent.stock_pieces` (antes de descontar).
        4.  **Descontar Padre:** Restar `quantityToProcess` de `parent.stock_pieces` y `(quantityToProcess * parent_average_weight_per_piece)` de `parent.stock_kg`.
        5.  **Registrar Transacción Padre:** Insertar en `public.inventory_transactions` el movimiento de salida del padre (`transaction_type = 'DESPIECE'`).
        6.  **Obtener Recetas:** Consultar `public.product_transformations` filtrando por `parent_product_id` y `transformation_type`.
        7.  **Incrementar Hijos:** Para cada receta encontrada:
            *   Obtener el producto hijo de `public.products`.
            *   `child_pieces_to_add = quantityToProcess * recipe.yield_quantity_pieces`.
            *   `child_kg_to_add = quantityToProcess * recipe.yield_weight_ratio * parent_average_weight_per_piece`.
            *   Sumar `child_pieces_to_add` a `child.stock_pieces` y `child_kg_to_add` a `child.stock_kg`.
            *   Registrar Transacción Hijo: Insertar en `public.inventory_transactions` el movimiento de entrada del hijo (`transaction_type = 'DESPIECE'`).
        8.  **Actualizar Productos:** Guardar los cambios en `public.products` para el padre y todos los hijos.
    *   **Errores:** Manejar casos de stock insuficiente, `transformationType` inválido o recetas no encontradas.

### 2.2. Router de Órdenes/Ventas (`ordersRouter`)

*   **Modificar `createOrder` (Mutación):**
    *   **Entrada:** `items: Array<{ productId: number, quantityPieces?: number, quantityKg?: number, unitPrice: number }>`, `customerId: number`, `notes?: string`, `deliveryAddress?: string`, `whatsappMessageId?: string`.
    *   **Lógica:**
        1.  **Crear Orden:** Insertar en `public.orders`.
        2.  **Procesar Ítems:** Para cada ítem en `items`:
            *   Obtener `product` de `public.products`.
            *   Si `product.is_sellable_by_weight = TRUE` y `quantityKg` no se proporciona (o es 0):
                *   Insertar `order_item` con `quantity_kg = NULL` y `status = 'PENDIENTE_PESAJE'`.
                *   Marcar `order.requires_weighing = TRUE`.
            *   Si `product.is_sellable_by_weight = FALSE` o `quantityKg` se proporciona:
                *   Insertar `order_item` con `quantity_kg` y `status = 'COMPLETADO'`.
            *   `quantity_pieces` se insertará si se proporciona.
        3.  **Calcular `total_amount`:** Sumar los `subtotal` de los ítems (considerando `quantity_kg` si está presente, o `quantity_pieces * price_per_piece` si `is_sellable_by_unit` y `price_per_piece` existen).
        4.  **Actualizar `order.status`:** Si `order.requires_weighing = TRUE`, establecer `order.status = 'PENDIENTE_PESAJE'`. De lo contrario, `order.status = 'LISTA_PARA_COBRO'`.

*   **Añadir `getPendingWeighingOrders` (Consulta):**
    *   **Propósito:** Obtener órdenes con ítems pendientes de pesaje para la estación Arduino/POS.
    *   **Salida:** Lista de órdenes con `orders.requires_weighing = TRUE` o `order_items.status = 'PENDIENTE_PESAJE'`, incluyendo detalles de `customer` y `order_items`.

*   **Añadir `updateOrderItemWeight` (Mutación):**
    *   **Entrada:** `orderItemId: number`, `actualWeightKg: number`.
    *   **Lógica:**
        1.  **Transacción:** Ejecutar dentro de una transacción.
        2.  **Actualizar `order_item`:** Obtener `order_item` y su `product`. Actualizar `order_item.quantity_kg = actualWeightKg`, `order_item.subtotal = actualWeightKg * order_item.unit_price`, y `order_item.status = 'PESADO'`.
        3.  **Recalcular `order.total_amount`:** Sumar los subtotales de todos los ítems de la orden.
        4.  **Actualizar `order.status`:** Verificar si todos los `order_items` de la orden están `PESADO`. Si es así, actualizar `order.status = 'LISTA_PARA_COBRO'`.

*   **Modificar `completeOrderPayment` (Mutación):**
    *   **Propósito:** Finalizar la venta y descontar el inventario dual.
    *   **Lógica:**
        1.  **Transacción:** Ejecutar dentro de una transacción.
        2.  **Validar Estado:** Asegurar que `order.status = 'LISTA_PARA_COBRO'`.
        3.  **Descontar Inventario:** Para cada `order_item` de la orden:
            *   Obtener `product` de `public.products`.
            *   Si `order_item.quantity_pieces` es NOT NULL, restar de `product.stock_pieces`.
            *   Restar `order_item.quantity_kg` de `product.stock_kg`.
            *   Registrar movimiento en `public.inventory_transactions` (`transaction_type = 'VENTA'`).
        4.  **Actualizar `order.status`:** Establecer `order.status = 'COMPLETADA'`.
        5.  **Registrar Pago:** (Si aplica) Registrar el pago en la tabla de transacciones financieras.

--- 

## 3. Integración con Webhooks de WhatsApp

Los webhooks que actualmente alimentan las tablas `public.orders` y `public.order_items` desde WhatsApp deben ser ajustados para invocar el procedimiento `createOrder` de tRPC con la nueva lógica.

*   **Mapeo de Productos:** Asegurar que los nombres de productos de WhatsApp se correspondan con los `product_id` de la tabla `public.products`. Esto podría requerir una tabla de mapeo o lógica de búsqueda robusta.
*   **Inicialización de `order_items`:** Al crear un `order_item` desde WhatsApp, el webhook debe:
    *   Consultar `public.products` para el `product_id`.
    *   Si `product.is_sellable_by_weight = TRUE`, enviar `quantityKg = NULL` y esperar que `createOrder` establezca `order_items.status = 'PENDIENTE_PESAJE'`.
    *   Si el cliente especifica una cantidad en piezas, enviar `quantityPieces`.
*   **Manejo de `order_status`:** El webhook debe ser consciente de los nuevos estados de orden y asegurarse de que la información enviada permita al `createOrder` de tRPC establecer el estado inicial correcto.

--- 

## 4. Consideraciones Adicionales

*   **Row Level Security (RLS):** Es **IMPRESCINDIBLE** configurar políticas de RLS en Supabase para todas las tablas sensibles (`products`, `orders`, `order_items`, `product_transformations`, `inventory_transactions`) para asegurar que solo los roles autorizados (ej. servicio tRPC, Arduino con clave específica) puedan realizar las operaciones necesarias.
*   **Validación de Datos:** Implementar validaciones robustas en tRPC para todas las entradas (ej. `quantityToProcess` > 0, `actualWeightKg` > 0).
*   **Errores:** Asegurar un manejo de errores consistente y descriptivo en todos los procedimientos de tRPC.
*   **Tipado:** Utilizar TypeScript para definir los tipos de entrada y salida de todos los procedimientos de tRPC, garantizando la seguridad de tipos en todo el stack.

--- 

Este prompt proporciona una guía completa para la implementación del backend. El desarrollador debe referirse a los scripts SQL de migración y al mapa de despiece para detalles específicos de los datos y las relaciones. ¡Éxito en la implementación!
