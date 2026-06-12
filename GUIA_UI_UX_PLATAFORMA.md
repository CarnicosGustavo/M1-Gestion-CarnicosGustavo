# Guía completa de la interfaz — Dashboard Cárnicos Gustavo

> **Para:** equipo de rediseño UI/UX (Claude Design)
> **Qué es:** documento de referencia exhaustivo, página por página, de TODA la plataforma actual: propósito, datos, secciones, **cada botón y a dónde conecta**, estados y notas de diseño. El objetivo es que el rediseño no olvide ninguna sección ni acción.

---

## 0. Contexto del negocio

**Cárnicos Gustavo** es una distribuidora de carne de cerdo (CEDIS / centro de distribución). El sistema cubre el ciclo operativo completo del día:

```
Compra del día (cerdos en pie) → Despiece (canales → piezas) → Pedidos →
Pesaje (peso real por pieza) → Cobro (precio/kg → total) → Cobranza (crédito)
```

**Conceptos clave del dominio:**
- **Canal** = medio cerdo o cerdo entero ya sacrificado. Tipos: **Americano** (canal completo ≈105 kg), **Nacional Lado Lomo** (≈52.5 kg), **Nacional Lado Espilomo** (≈52.5 kg), **Polinesio** (nuevo, ≈105 kg).
- **Despiece** = cortar un canal en piezas (PIERNA, LOMO, CUERO…) según una **receta** que define cuántas piezas y qué % del peso sale de cada corte.
- **Receta de 2º nivel / variante** = una pieza se corta a su vez (PIERNA → JAMÓN) y el jamón tiene **variantes** (JAMÓN S/H, C/G, PINTO).
- **Inventario dual**: el stock se mide en **piezas (pz)** y **kilos (kg)** simultáneamente.
- **Demanda viva** = piezas pedidas en órdenes abiertas (no canceladas/completadas).

**Stack y sistema de diseño:**
- Next.js (App Router) + tRPC + Drizzle/Supabase.
- Componentes de `@finopenpos/ui` (shadcn/ui): `Card`, `Button`, `Input`, `Select`, `Dialog`, `Table`, `DataTable`, `Badge`, `Skeleton`, `Combobox`, `SearchFilter`.
- Iconos: **lucide-react**. Toasts: **sonner**. Idioma: **español** (algunos módulos con `next-intl`).

**Paleta semántica usada hoy (referencia, no obligatoria para el rediseño):**
| Color | Significado |
|-------|-------------|
| Verde | Pagado/OK, abonos, peso neto válido, contado |
| Amarillo | Pendiente, por pesar |
| Naranja | Crédito, parcial, merma, "a fresco" |
| Rojo | Cancelado, saldo, eliminar, pendiente de compra |
| Azul | En proceso, estimado, info, inventario frío |
| Morado | Producción |
| Rosa | Americanos | 
| Esmeralda/Teal | Nacionales (Lomo / Espilomo) |

---

## 1. Estructura de navegación (shell común)

**Archivo:** `components/admin-layout.tsx`. Es el marco de todas las páginas `/admin`.

### Header (sticky, alto ~56px, 3 columnas)
- **Izquierda:** botón hamburguesa `MenuIcon` (solo móvil) que abre el drawer + **título de la página actual** (truncado).
- **Centro:** nombre del cliente "Cárnicos Gustavo" como logo textual → enlaza a `/admin`. *(No hay logo gráfico hoy.)*
- **Derecha:** menú de usuario (avatar circular `/placeholder-user.jpg`). Al abrir el dropdown:
  - "Mi cuenta" (label) · "Configuración" → `/admin/settings` · "Soporte" → `/api/docs` · "Cerrar sesión" → server action `logout()`.

### Sidebar de escritorio (columna de iconos con tooltips) + Drawer móvil (con etiquetas)
Dos grupos. **Operación del día** (siempre visible como iconos) y **Configuración** (agrupado en un dropdown / sección del drawer).

**Operación del día (`opNav`):**
| # | Etiqueta | Icono lucide | Ruta |
|---|----------|--------------|------|
| 1 | Panel | `LayoutDashboardIcon` | `/admin` |
| 2 | Compra del día | `PiggyBankIcon` | `/admin/purchase` |
| 3 | Pedidos | `ShoppingBagIcon` | `/admin/orders` |
| 4 | Despiece | `ScissorsIcon` | `/admin/despiece` |
| 5 | Báscula | `ScaleIcon` | `/admin/weighing-station` |
| 6 | Cobro | `BanknoteIcon` | `/admin/checkout` |
| 7 | Rendimiento | `ClipboardListIcon` | `/admin/yield` |
| 8 | Cobranza | `HandCoinsIcon` | `/admin/collections` |
| 9 | Clientes | `UsersIcon` | `/admin/customers` |
| 10 | Punto de venta | `ShoppingCartIcon` | `/admin/pos` |
| 11 | Antonella | `BotIcon` | `/admin/antonella` |

**Configuración (`cfgNav`, dentro del dropdown `SettingsIcon`):**
| # | Etiqueta | Icono | Ruta |
|---|----------|-------|------|
| 1 | Productos | `PackageIcon` | `/admin/products` |
| 2 | Recetas | `BookOpenIcon` | `/admin/inventory/recipes` |
| 3 | Precios | `TagIcon` | `/admin/prices` |
| 4 | Inventario Frío | `SnowflakeIcon` | `/admin/cold-inventory` |
| 5 | Caja | `DollarSignIcon` | `/admin/cashier` |
| 6 | Métodos de pago | `CreditCardIcon` | `/admin/payment-methods` |
| 7 | Configuración | `SettingsIcon` | `/admin/settings` |

**Caso especial:** la ruta `/admin/configurador` se renderiza **a pantalla completa SIN header ni sidebar**.

**Nota de diseño:** la distinción Operación (flujo diario frecuente, siempre a la vista) vs Configuración (catálogo/ajustes, menos frecuente, agrupado) es deliberada y conviene mantenerla.

---

# OPERACIÓN DEL DÍA

## 2. Panel / Dashboard (`/admin`)
**Propósito:** vista financiera global (ingresos, gastos, utilidad) con gráficas.
**Datos:** `trpc.dashboard.stats` → `totalRevenue`, `totalExpenses`, `totalProfit`, `revenueByCategory`, `expensesByCategory`, `profitMargin[]`, `cashFlow[]`.
**Secciones:**
- Barra superior con botón de privacidad.
- **3 KPI cards:** Ingresos totales (`DollarSign`), Gastos totales (`Wallet`), Utilidad neta (`TrendingUp`/`TrendingDown`, verde si ≥0 / rojo si <0).
- **4 gráficas** (grid 1→2 col): Ingresos por categoría (donut), Gastos por categoría (donut), Margen de utilidad (barras verde/rojo por fecha), Flujo de caja (área con degradado).
**Botones y acciones:**
- **"Ocultar montos / Mostrar montos"** (`EyeOffIcon`/`EyeIcon`) → alterna `hideAmounts`, persiste en `localStorage` (`cg_hide_amounts`); reemplaza todos los montos por `$ • • • •`. Solo cliente, sin endpoint.
- **"Reintentar"** (solo en error) → `refetch()` de `dashboard.stats`.
- Sin navegación a otras rutas.
**Estados:** cargando (skeletons de 3 KPI + 4 gráficas), sin datos/error (card "Panel" + Reintentar), gráfica vacía (EmptyState 280px).

---

## 3. Compra del día (`/admin/purchase`)
**Propósito:** registrar la compra "en pie" de cerdos por proveedor (base del rendimiento y del stock de canales para Despiece) y verificar el peso real recibido en CEDIS.
**Datos:** `trpc.yields.purchaseDates` (fechas guardadas), `trpc.yields.purchasesByDate({date})` (renglones del día). Guarda con `trpc.yields.savePurchases`.
**Secciones:**
- **Card "Día de operación":** input `date` + Select "Días guardados" + botones "Hoy" y "Empezar de ceros".
- **5 KPIs:** 🐷 Americanos (rosa), 🐷 Nacionales (esmeralda), Canales total (=americanos+nacionales, derivado), Kg en pie, Kg/canal.
- **Card "Compra en pie por proveedor":** tabla editable — Proveedor, 🐷 Americanos, 🐷 Nacionales, Canales (calculado), Kg en pie, $/kg, Kg/canal (read-only), eliminar. Nota: 1 americano = 1 canal completo; 1 nacional = 1 lado Lomo + 1 lado Espilomo.
- **Card "Verificación en CEDIS":** Proveedor, Comprado (kg, read-only), Canales recibidos, Kg recibidos, Merma (naranja si pérdida / verde si ganancia).
**Botones y acciones:**
- **"Guardar compra del día"** (`SaveIcon`) → `trpc.yields.savePurchases.mutate({date, rows})`; en éxito invalida `purchaseDates`, `purchasesByDate`, `latestPurchase`. Toast.
- **Input fecha** → recarga renglones de ese día.
- **Select "Días guardados"** → carga un día anterior.
- **"Hoy"** → vuelve a la fecha actual.
- **"Empezar de ceros"** → confirma (`window.confirm`) y reinicia a 2 renglones vacíos ("La Barca"/"Valle").
- **"Agregar proveedor"** (`PlusIcon`) → añade renglón.
- **Eliminar renglón** (`TrashIcon`) → quita proveedor.
- **Inputs por celda** → estado local, NO persisten hasta Guardar.
**Estados:** sin días guardados (item deshabilitado), día sin datos (2 renglones predefinidos), confirmación antes de limpiar.

---

## 4. Pedidos — Lista (`/admin/orders`)
**Propósito:** listado central de pedidos. Buscar/filtrar, crear (con alta rápida de cliente), editar total/estado, imprimir tickets, navegar al detalle.
**Datos:** `trpc.orders.list`, `trpc.customers.list`, `trpc.products.list`, `trpc.paymentMethods.list`. Mutaciones: `orders.create/update/delete`, `customers.create`.
**Secciones:**
- **SearchFilter:** búsqueda + filtro de estado (Todos / Completado / Pendiente / Cancelado) + botón "Nuevo pedido".
- **DataTable:** ID, Cliente, Total, Estado (texto coloreado), Fecha (oculta en móvil), Acciones. Exporta CSV. Orden por defecto: `created_at desc`.
- **Mapa de estados:** COMPLETADA→"Pagada" (verde), LISTA_PARA_COBRO→"Lista para cobro" (azul), PROCESANDO_PAGO→"Procesando pago" (azul), PENDIENTE_PESAJE→"Por pesar" (amarillo), PARCIAL_DISPONIBLE→"Parcial" (naranja), cancelled→"Cancelada" (rojo), default→"Pendiente" (amarillo).
**Botones y acciones:**
- **"Nuevo pedido"** → abre diálogo de creación.
- Por fila: **Editar** (`FilePenIcon`) → diálogo edición rápida (total + estado); **Eliminar** (`TrashIcon`) → confirmación → `orders.delete`; **Imprimir Ticket** (`PrinterIcon`) → TicketModal; **Ver** (`EyeIcon`) → `/admin/orders/[id]`.
- **Diálogo "Editar pedido" (rápido):** Cliente (read-only), Total (validado zod), Estado (Select). "Cancelar" / "Actualizar pedido" → `orders.update({id, total_amount×100, status})`.
- **Diálogo "Nuevo pedido" (completo):** Combobox cliente + "+ Nuevo cliente"; Combobox método de pago; Notas; "Agregar producto" (combobox muestra "nombre — N pzas / N kg"); tabla de items (Producto, Piezas, Kg, Precio, Subtotal con estimado "Est: ~X kg" si por peso sin pesar, eliminar); Total. "Cancelar" / **"Crear pedido"** → `orders.create` y **navega al detalle del pedido creado**. *(No bloquea por stock; productos por peso van a pesaje.)*
- **Sub-diálogo "Nuevo cliente":** Nombre del negocio*, Responsable, WhatsApp, Dirección, Notas. **"Crear y usar"** → `customers.create`, deriva email sintético `@cedis.local`, autoselecciona el cliente.
**Estados:** cargando (skeletons), error (card rojo), vacío (`ShoppingCartIcon`), validaciones zod (total requerido, nombre requerido).

---

## 5. Pedido — Detalle (`/admin/orders/[id]`)
**Propósito:** vista completa de un pedido: resumen, artículos, despiece, edición, cobro/crédito, ticket, eliminar.
**Datos:** `trpc.orders.get({id})`, `products.list`, `customers.list`, `paymentMethods.list`. Mutaciones: `orders.replaceItems/delete/completeOrderPayment/completeOrderOnCredit/convertToCredit`.
**Secciones:**
- **Cabecera:** volver + "Detalles del pedido #ID" + barra de acciones.
- **Card "Resumen":** estado coloreado + badge "Por Pesar"; Cliente, Total, Total estimado (azul, si hay sin pesar), Creado, Items, Notas, Dirección, "⚠️ Pendiente de Compra" (rojo).
- **`OrderDisassemblyManager`:** gestor de despiece de canales del pedido.
- **Card "Artículos":** tabla Producto/Piezas/Kg/Precio Unit./Subtotal/Estado (badge por item) + 4 tarjetas consolidadas (Total Piezas, Total Kg, Items, Total).
**Botones y acciones (cabecera):**
- **Volver** (`ArrowLeftIcon`) → `/admin/orders`.
- **"Liquidar / Cobrar"** (verde, `BanknoteIcon`, solo si `LISTA_PARA_COBRO`) → diálogo de cobro.
- **"Pasar a crédito"** (naranja, solo si `COMPLETADA`) → `orders.convertToCredit` (directo, sin diálogo).
- **"Imprimir Ticket"** (`PrinterIcon`) → TicketModal.
- **"Editar"** (`FilePenIcon`) → diálogo edición completa.
- **"Eliminar"** (destructive `TrashIcon`) → confirmación → `orders.delete` → `/admin/orders`.
- **Diálogo "Editar pedido" (completo):** Cliente (Select), Estado (Select), editor de renglones (Producto Select que fija precio sugerido, Piezas, Kg, $/Kg, Subtotal, eliminar), "Agregar" renglón, Notas. **"Guardar pedido"** → `orders.replaceItems`.
- **Diálogo "Liquidar pedido":** Total grande; toggle **Contado** (verde) / **Crédito** (naranja); si contado: Select método de pago; **"Confirmar cobro"** → `completeOrderPayment` / **"Dejar a crédito"** → `completeOrderOnCredit`.
**Estados:** cargando, no encontrado, pedido de producción ("Producción → inventario", morado, sin cobro), total estimado, items pendientes de compra (rojo, excluidos del total).

---

## 6. Despiece (`/admin/despiece`)  ⭐ *(rediseñado recientemente)*
**Propósito:** despiezar canales según la demanda de pedidos. Elegir tipo de canal, ver qué piezas obtienes y qué se pidió, ejecutar.
**Datos:** `trpc.yields.despiecePanel` → `canales`, `recipes` (1er nivel), `subRecipes` (sub-despiece y variantes), `demandByProduct`. Pestaña árbol: `products.list` + `products.getTransformations`. Mutaciones: `products.processDisassembly`, `products.convertToVariant`.
**Secciones:**
- **Tabs:** "Despiezar" (`ScissorsIcon`) / "Recetas (árbol)" (`GitBranchIcon`).
- **Banner de demanda** (azul, si hay pedidos): "Pedidos pendientes: N piezas por producir".
- **Grid de cards de canales** (2/3/4 col): nombre corto ("Nacional · Lomo"), barra de color por tipo, badge "● N" si tiene pedidos, piezas disponibles grandes, peso/canal. Sin stock → opacidad; activo → ring.
- **Card detalle del canal:** grid de **PieceCards**. Compacta: nombre, "N pz/canal · X%", badge pedidas (verde/azul), "+N pz". **Expandida** (todo el ancho): 4 métricas (📋 En pedidos, 🧊 En stock, ✂️ Disponibles por despiece, ➕ Con N canales — verde si cubre, ámbar si falta), mensaje de cobertura, **Variantes directas** (cajas moradas "VAR") y **Sub-despiece** (lista con variantes anidadas).
**Botones y acciones:**
- **Tabs** → cambian vista.
- **Card de canal** → selecciona (sin backend).
- **"− / +"** (`MinusIcon`/`PlusIcon`) → ajusta cantidad de canales (clamp 1..stock).
- **"Despiezar N"** (`ScissorsIcon`) → `products.processDisassembly({parentProductId, quantityToProcess, transformationType, entryMode:false})`.
- **PieceCard** → expande/colapsa.
- **VariantRow** (input + "Producir") → `products.convertToVariant({baseProductId, variantProductId, pieces})`.
- **SubDespieceControl** (input "pz" + "Despiezar") → `products.processDisassembly` sobre la sub-pieza; con vista previa de lo que produce y aviso si falta stock.
- Enlaces a "Configurador" (`/admin/configurador`) y "Compra del día" (`/admin/purchase`).
- **EmptyCanales → "Registrar la compra del día"** → `/admin/purchase`.
**Estados:** sin canales (EmptyCanales), sin receta (enlace al configurador), sin stock del tipo (banner ámbar). Auto-selecciona canal con demanda/stock y propone cantidad sugerida.
**Colores por tipo:** AMERICANO `#e11d48`, NACIONAL_LOMO `#16a34a`, NACIONAL_ESPILOMO `#0d9488`, POLINESIO `#ea580c`, default `#2563eb`.

---

## 7. Estación de Pesaje (`/admin/weighing-station`)
**Propósito:** pesar físicamente pieza por pieza cada pedido pendiente, calculando neto = bruto − tara. Al terminar ofrece pasar a cobro. También pesa producción a granel.
**Datos:** `trpc.orders.getPendingWeighingOrders` (refresca cada 8s), `products.list`. Mutaciones: `orders.updateOrderItemWeight`, `inventory.recordWeighingBatch`, `orders.createProductionWeighing`.
**Secciones (layout 3 columnas):**
- **Sidebar órdenes:** "Weighing Station" + "N orders pending". Filas: "#ID – Cliente", badge verde "WhatsApp", "N artículo(s) pendiente(s)". Órdenes nuevas parpadean verde 3s.
- **Panel principal (captura):** cliente + "Pedido #ID" + "Editar pedido" + total; "Artículo X de N", producto grande; **selector de recipiente** (Sin recipiente / Tambo Azul 2.5kg / Tara 1.2kg / Cubeta 0.9kg / Otro); **input de peso bruto gigante** (autofocus); resumen bruto/tara/neto; botones; dots de progreso.
**Botones y acciones:**
- **"Agregar pesaje a producto"** (`ScaleIcon`) → diálogo de pesaje por lote.
- **Fila de orden** → selecciona.
- **"Editar pedido"** (`PencilIcon`) → `/admin/orders/[id]`.
- **Botones de recipiente** → fijan tara.
- **"Capturar"** → toma el peso como tara ("Otro"); **"TARE"** → cero.
- **"Anterior" / "Siguiente"** (`ChevronLeft/Right`) → navega artículos.
- **"Registrar N kg"** (`ScaleIcon`) → `orders.updateOrderItemWeight({orderItemId, actualWeightKg})`.
- **Atajos teclado** (en input): Enter=registrar, ←/→=navegar, ↑/↓=recipiente.
- **Botón flotante "Cobrar pedido #ID"** (verde, `CheckCircleIcon`, aparece 9s tras pesar el último) → `/admin/checkout?order=ID`.
- **Diálogo "Pesaje de producción":** Combobox producto, checkbox "A granel", Piezas, Peso total, Select "¿Ya se había pesado?". **"Enviar a cola de pesaje"** → `orders.createProductionWeighing`; **"Registrar pesaje"** → `inventory.recordWeighingBatch`.
**Estados:** cargando (skeleton 600px), sin órdenes, sin selección (placeholder), detección de pedido nuevo (toast + parpadeo), validación neto>0.
**UX:** diseño tipo kiosco/báscula (input enorme, botones h-16, `rounded-2xl`), pensado para táctil; pesos en `font-mono`.

---

## 8. Cobro / Checkout (`/admin/checkout`)
**Propósito:** cola de cobro. Tomar cada pedido pesado, fijar precio/kg, calcular total, cobrar (contado/crédito), abrir ticket.
**Datos:** `trpc.orders.getReadyToCharge` (refresca 10s), `paymentMethods.list`. Mutación: `orders.priceAndCharge`.
**Secciones (3 columnas):**
- **Sidebar "Cola de Cobro":** "#ID – Cliente", "N producto(s)".
- **Panel detalle:** tabla Producto / Kg (mono) / **Precio/Kg (input editable)** / Subtotal; caja de **Total** grande; footer con toggle Contado/Crédito, Select método (solo contado), botón de cobro.
**Botones y acciones:**
- **Fila de pedido** → selecciona.
- **Input "Precio/Kg"** → recalcula subtotal y total en vivo.
- **"Contado"** (verde) / **"Crédito"** (naranja) → fija tipo.
- **Select método de pago** (solo contado).
- **"Cobrar $X.XX"** (`ReceiptTextIcon`, verde) → `orders.priceAndCharge({orderId, paymentType, paymentMethodId, items[]})`; abre TicketModal, deselecciona, invalida cola.
**Estados:** cola vacía, sin selección (placeholder), precarga precio guardado del cliente, **pre-selección por URL `?order=N`** (desde pesaje). Nota: "Al cobrar se guardan estos precios para el próximo pedido del cliente."

---

## 9. Rendimiento de Despiece (`/admin/yield`)
**Propósito:** registrar canales despiezados, capturar peso real por pieza, comparar vs estimado para medir rendimiento (%) por proveedor; calibrar recetas con pesos reales del día.
**Datos:** `products.list`, `yields.list`, `yields.byProvider`, `yields.canales`, `yields.purchasesByDate({date})`, `yields.productionHistory`, `yields.projectFromCanales({canales})` (on-demand). Mutaciones: `yields.create`, `yields.calibrateFromDay`.
**Secciones:**
- **Card "Rendimiento por proveedor"** (si hay datos): % grande azul + canales/kg/hojas.
- **Card "Pesajes de producción (acumulado)":** tabla estilo Excel (Pieza, Pesaje 1..N, Total kg, Total pza).
- **Card "Proyectar piezas":** input por tipo de canal + "Proyectar piezas".
- **Card "Día de operación":** fecha + "Calibrar recetas con el día".
- **Card "Cabecera":** No. de medias canal, Kg comprado, Proveedor (toggle "La Barca"/"Valle"), Notas (auto-rellenados desde la compra).
- **Card "Piezas":** tabla editable (Concepto, Piezas, Peso est. azul, Peso real, Dif. verde/rojo, borrar) + fila de totales (piezas, estimado, real, diferencia, rendimiento). Filas pesadas en verde.
- **Card "Hojas recientes":** Fecha, Proveedor, Canales, Comprado, Real, Rendimiento.
**Botones y acciones:**
- **"Guardar hoja"** (`SaveIcon`) → `yields.create`.
- **"Proyectar piezas"** (`SparklesIcon`) → `yields.projectFromCanales` (fetchQuery), llena la tabla.
- **Selector de fecha** → recarga compra + autollena cabecera.
- **"Calibrar recetas con el día"** (`SparklesIcon`) → confirma → `yields.calibrateFromDay({date})`.
- **Toggle proveedor**, **"Agregar pieza"** (`PlusIcon`), **borrar fila** (`TrashIcon`), inputs por fila.

---

## 10. Cobranza (`/admin/collections`)
**Propósito:** cuentas por cobrar (pedidos a crédito + "tickets viejos" manuales). Registrar abonos, ver estado de cuenta, reimprimir recibos, recordatorios por WhatsApp.
**Datos:** `collections.listAccounts`, `customers.list`, `collections.getStatement({customerId})` (al abrir cliente). Mutaciones: `collections.addCharge/addPayment/updateCharge/updatePayment/deleteCharge/deletePayment`.
**Secciones:**
- **Card "Total por cobrar":** KPI rojo + "Clientes con saldo".
- **Card "Cuentas por cobrar":** tabla Cliente / Cargos / Abonos (verde) / Saldo (rojo) / Antigüedad (badge días: amarillo ≤30, naranja 31-60, rojo >60) / Acciones. Solo saldos >0.
**Botones y acciones:**
- **"Capturar ticket viejo"** (`PlusIcon`) → diálogo de cargo.
- Por fila: **"Abonar"** (`BanknoteIcon`, verde) → diálogo abono; **"Estado"** (`FileTextIcon`) → diálogo estado de cuenta; **"Recordar"** (`MessageCircleIcon`, verde WhatsApp) → abre `wa.me` con mensaje del saldo.
- **Diálogo cargo:** Select cliente, Monto, Concepto, Fecha. **"Guardar cargo"** → `addCharge` (source "ticket_viejo").
- **Diálogo abono:** Monto, Método. **"Registrar abono"** → `addPayment` → abre recibo (PaymentReceiptModal).
- **Diálogo estado de cuenta:** ledger (Fecha, Concepto, Cargo, Abono, Acciones). Por movimiento: **imprimir** (`PrinterIcon`, recibo o ticket), **corregir** (`PencilIcon`), **eliminar** (`Trash2Icon`, confirma). Totales: Cargos, Abonos, Saldo.
- **Diálogo corregir:** Monto, Concepto/Método, Fecha → `updateCharge`/`updatePayment`.

---

## 11. Clientes — Lista (`/admin/customers`)
**Propósito:** lista maestra de clientes (negocios/carnicerías). Buscar, filtrar, CRUD, ver saldo, entrar al detalle.
**Datos:** `customers.list` + `collections.listAccounts` (para columna Saldo).
**Secciones:** SearchFilter (búsqueda + estado Todos/Activo/Inactivo + "Agregar cliente"). DataTable: Nombre (link al detalle), Teléfono (oculto móvil), Saldo (rojo si >0), Estado (verde/gris), Acciones. Exporta CSV.
**Botones y acciones:**
- **"Agregar cliente"** (`PlusCircle`) → diálogo crear.
- **Link Nombre** → `/admin/customers/{id}`.
- Por fila: **Editar** (`FilePenIcon`), **Eliminar** (`TrashIcon`, danger) → `customers.delete`.
- **Diálogo cliente:** Nombre del negocio*, Responsable, WhatsApp, Correo (validado), Dirección, Notas, Estado. **"Agregar/Actualizar cliente"** → `customers.create/update`.
**Estados:** cargando, error, vacío (`UsersIcon`), validaciones zod.

---

## 12. Cliente — Detalle (`/admin/customers/[id]`)
**Propósito:** ficha 360°: contacto, métricas, saldo, historial de pedidos y cobranza.
**Datos:** `customers.getDetail({id})` (customer, orders, totalOrders, totalSpent, balance, customPriceCount), `collections.getStatement({customerId})`.
**Secciones:** cabecera (volver, nombre, teléfono/dirección, WhatsApp, Precios); 4 stats (Pedidos, Total comprado, Saldo por cobrar rojo, Precios propios); banner de saldo (si >0, link a Cobranza); Card Pedidos (link al detalle, Ticket); Card Movimientos de cobranza (Recibo).
**Botones y acciones:**
- **Volver** → `/admin/customers`.
- **"WhatsApp"** (verde, si hay teléfono) → `wa.me/{telefono}`.
- **"Precios"** (`TagIcon`) → `/admin/prices`.
- **Banner saldo** → `/admin/collections`.
- **Link "#id"** → `/admin/orders/{id}`. **Ticket** (`ReceiptTextIcon`) → TicketModal. **Recibo** (`PrinterIcon`) → recibo o ticket.

---

## 13. Punto de Venta — POS (`/admin/pos`)
**Propósito:** captura de pedidos. Cliente + método + lista de precios; agregar productos (pieza/kg); ajustar; crear pedido. Resuelve precio cliente > lista > base; clasifica cada pieza en stock / por despiece / faltante.
**Datos:** `products.list`, `customers.list`, `paymentMethods.list`, `inventory.priceListsList`, `products.availabilityMap`, `inventory.priceListItemsByList`, `customerPrices.getByCustomer`. Mutación: `orders.create`.
**Secciones:** Card "Detalles de la venta" (3 comboboxes: cliente, método, lista de precios); Card "Productos" (búsqueda + "Agregar producto" con precio resuelto y stock "X pzas / Y kg"); tabla carrito (Nombre, Precio editable, Piezas stepper, Peso kg, Total, borrar); pie de totales con avisos + checkbox "Factura" (NFC-e) + botón crear.
**Botones y acciones:**
- Comboboxes cliente/método/lista → recotizan el carrito.
- **"Agregar producto"** → al carrito (+1 si existe), valida stock dual.
- Por fila: input precio, stepper **−/+** piezas, input kg, **borrar** (`Trash2Icon`).
- **Checkbox "Factura"** (`ReceiptTextIcon`) → `emitNfce` *(hoy no se envía en el payload)*.
- **Botón crear:** etiqueta dinámica "Requiere pesaje" o "Crear pedido" → `orders.create`. Toasts informativos para por-despiece (🔪) y faltantes (⚠️).
**Estados:** cargando (skeletons), carrito vacío, validación stock, clasificación stock/despiece/faltante, recotización reactiva.

---

## 14. Antonella — Chat (`/admin/antonella`)
**Propósito:** asistente de IA (Claude) embebido. Consulta inventario, demanda, recetas, producción; ejecuta acciones (despiece, variantes) con confirmación.
**Datos:** historial vía `useAntonellaHistory` (persistencia local IndexedDB). Respuestas de `trpc.antonella.chat` (`answer`, `toolCalls`, `requiresConfirmation`, `confirmationData`). Acciones: `trpc.antonella.executeAction`.
**Secciones:**
- **Card de chat** (alto 600px): header "Antonella - Asistente de Inventario" + papelera (borrar historial); área de mensajes (avatar "A" primario / "Tú" accent, burbujas); **tarjeta de confirmación ámbar** ("🔒 ¡Acción Protegida!") con pares clave/valor y botones "✓ Confirmar" / "✕ Cancelar"; indicador "Pensando..." (`Loader2Icon`); barra input + enviar (`SendIcon`, Enter envía).
- **Card "Preguntas rápidas":** 6 botones ("¿Cuánto stock tengo?", "¿Qué se pidió esta semana?", "¿Cubre mi stock los pedidos?", "¿Cómo se despieza PIERNA?", "Forecast de demanda (7 días)", "¿Cuántos canales necesito comprar?").
**Botones y acciones:**
- **Enviar** → `antonella.chat`.
- **Papelera** → confirma → limpia historial.
- **"✓ Confirmar"** → `antonella.executeAction({actionName, actionInput})`.
- **"✕ Cancelar"** → quita la tarjeta.
- **Preguntas rápidas** → rellenan input y envían.
**Nota:** requiere `ANTHROPIC_API_KEY` en el servidor; sin ella muestra error claro.

---

# CONFIGURACIÓN

## 15. Catálogo de Productos (`/admin/products`)
**Propósito:** catálogo maestro (alta/edición/borrado), distinguiendo piezas padre vs hijos; ver precios de listas e importar listas desde CSV.
**Datos:** `products.list` (con filtros isParent/parentProductId/includeDescendants), `products.list({isParent:true})`, `inventory.priceListsList`, `inventory.priceListItemsByList`.
**Secciones:**
- **Chips de jerarquía:** "Todos" + dinámicos ("Canal de Cerdo", "Pierna de Cerdo", "Espilomo", "Paleta") + "Limpiar". Filtran la familia (padre + descendientes).
- **SearchFilter:** búsqueda + selects (Lista de precios, Tipo Todos/Padre/Hijo, Padre [solo vista hijos], Stock Todo/En stock/Sin stock).
- **DataTable:** Producto, Descripción (oculta móvil), Tipo (badge Padre azul / Hijo gris), % Rend. (azul), Precio (respeta lista), Stock, Acciones. Exporta CSV.
**Botones y acciones:**
- **Chips jerarquía** → filtran (estado local).
- **"Agregar producto"** (`PlusIcon`) → diálogo crear.
- **"Importar precios (CSV)"** (`UploadIcon`) → diálogo importación.
- Por fila: **Editar** (`FilePenIcon`), **Eliminar** (`TrashIcon`, danger).
- **Diálogo producto:** Nombre, Descripción, Precio, Stock, "¿Es Pieza Padre?" → `products.create/update`.
- **Diálogo importación:** Lista (Mayoreo contado/crédito, Menudeo), Nombre, Unidad (kg/pieza), archivo `.csv` + textarea → `inventory.priceListImportCsv`.

## 16. Recetas / Configurador de Despiece — Tablero (`/admin/inventory/recipes`)  ⭐⭐ *(la pantalla más compleja y crítica)*
**Propósito:** núcleo del sistema. Define cómo se despieza un canal y el % de peso de cada pieza. De aquí derivan despiece, proyección de pedidos, rendimiento y precio sugerido. 3 vistas (Tabla, Tablero, Mapa) con **autoguardado en vivo**, drag & drop, niveles de despiece y variantes.
**Datos:** `products.list`, `products.list({isParent:true})`, `inventory.recipesList(...)`. Mutaciones: `inventory.recipesUpsert`, `recipesQuickUpdate`, `recipesSetActive`, `recipesImport`, `setRefWeight`, `classifyOrphan`.
**Header (común):** `BookOpenIcon` + título + contador "N recetas"; aviso de duplicados (ámbar); **indicador autoguardado** ("Guardado"/"Guardando…"); botón **"¿Qué es esto?"** (`InfoIcon`, panel de ayuda, persiste `recipes_help_seen`); **selector de vista** Tabla/Tablero/Mapa; botón **"Configurador"** (`MaximizeIcon`, abre `/admin/configurador`); **"Importar"** (`UploadIcon`, JSON); **"Nueva receta"** (`PlusCircle`).

**Vista TABLA:** filtros (Buscar, Padre, Estilo [Todos/BASE/AMERICANO/NACIONAL_LOMO/NACIONAL_ESPILOMO/POLINESIO], Estado Activas/Todas). **Banner de huérfanos** (chips arrastrables + 2 zonas drop: "📦 Producto de proveedor" → `classifyOrphan({action:"purchased"})`, "🗑️ Repetido" → `classifyOrphan({action:"duplicate"})`). DataTable: Padre (drop target → hijo de ese padre), Hijo (drop target → despiece 2º nivel; badge "DUP xN"), Estilo, Piezas, % peso est. (azul), Precio Sug. (verde), Activa (`CheckCircleIcon`/`XCircleIcon`), Acciones (Editar + Activar/Desactivar).

**Vista TABLERO (la más rica):**
- **Paleta lateral** (oculta móvil, sticky): "Productos" + buscador; productos agrupados por categoría (Canales, Lomos, Jamones, Cueros, Pulpas, Visceras, Huesos, Otros…) con punto de color y contador. **PaletteChip** arrastrable con badges de uso (estilos, "⑂ padre", "proveedor", "sin ubicar").
- **Tarjetas de estilo** (1er nivel): barra de color de acento; nombre del padre + badge estilo + badge "🐷 Canal completo" / "½ Media canal" + contador piezas. Controles: **RefWeightControl "Peso del canal"** (`setRefWeight`), botón **"Pieza"** (`PlusCircle`), enfoque ⤢/✕.
- **recipeRow:** manija ⠿, expandir ▸/▾, punto de color, nombre (clic = editar), toggle **Despiece/Variante** (`quickUpdate isVariant`), stepper **piezas** (−/+), **input kg** (recalcula ratio = kg/refW), **% calculado** (azul despiece / ámbar variante).
- **Sub-despiece (2º nivel):** caja azul "Despiece de [pieza]" con su RefWeightControl, renglones recursivos, **SumBadge "Nivel 2"** (suma %, kg vs ref, "⚠ excede" si >100.5% / "merma X%"). Zona de drop.
- **Drops:** chip en tarjeta de estilo → `dropCreate(parentId, tipo)`; chip en sub-despiece → `dropCreate(childId, "BASE")`.

**Vista MAPA:** Select estilo + árbol jerárquico desde la raíz CANAL (padre → hijos con piezas y ~kg/pza).

**Diálogo de receta:** Padre (Select), Hijo (Select, autodetección por nombre), Nombre hijo, Estilo (libre), Piezas (step 0.5), % peso est. (→ ratio /100), Activa → `recipesUpsert`.
**Estados:** cargando, error, vacío, validaciones de drop (no auto-hijo, no ciclos), confirmación al importar, autoguardado con indicador.

## 17. Configurador — pantalla completa (`/admin/configurador`)
**Propósito:** versión a pantalla completa del Tablero de Recetas (para abrir en otra ventana). Renderiza `<RecipesPage configurator />` SIN header/sidebar. Fuerza vista "Tablero", título "Configurador de Despiece", oculta el selector de vistas y el botón Configurador. Mismos botones/acciones del Tablero.

## 18. Precios por Cliente (`/admin/prices`)
**Propósito:** lista de precios propia por cliente (precio/kg y /pieza por producto).
**Datos:** `customers.list`, `customerPrices.getByCustomer({customerId})`. Mutación: `customerPrices.bulkUpsert`.
**Secciones:** Card selección (Select cliente + Buscar producto). Card "Lista de precios" (Producto + categoría, Precio/Kg, Precio/Pieza; filas con precio propio resaltadas en verde).
**Botones y acciones:** Select cliente, Buscar, inputs precio (estado local), **"Guardar precios"** (`SaveIcon`) → `customerPrices.bulkUpsert({customerId, items})` (vacíos = null).

## 19. Inventario Frío (`/admin/cold-inventory`)
**Propósito:** inventario congelado. Solo el fresco se vende; transferir kg/pz entre fresco y congelado.
**Datos:** `coldInventory.list`. Mutaciones: `coldInventory.toFrozen/toFresh`.
**Secciones:** buscador; Card "Existencias" (Producto, Fresco kg/pz, Frío kg/pz [azul], Acciones).
**Botones y acciones:** **"A frío"** (`SnowflakeIcon` azul) / **"A fresco"** (`FlameIcon` naranja) → diálogo de transferencia (Kg, Piezas) → `coldInventory.toFrozen/toFresh({productId, kg, pieces})`.

## 20. Caja (`/admin/cashier`)
**Propósito:** transacciones de caja (ingresos/gastos).
**Datos:** `transactions.list`. Mutaciones: `transactions.create/update/delete`.
**Secciones:** DataTable (ID, Descripción, Categoría, Tipo [badge income/expense], Fecha, Importe, Estado [badge]) + **fila de alta inline** (Descripción, Categoría, Tipo, fecha actual, Importe con prefijo moneda, Estado, "Agregar").
**Botones y acciones:** **"Agregar"** (inline) → `transactions.create` (valida descripción + importe>0); menú por fila (`EllipsisVerticalIcon`): **Editar** (modal → `transactions.update`, importe×100), **Eliminar** → `transactions.delete`.

## 21. Métodos de pago (`/admin/payment-methods`)
**Propósito:** catálogo de métodos de pago (CRUD de un solo campo "nombre").
**Datos:** `paymentMethods.list`. Mutaciones: `create/update/delete`.
**Secciones:** contador (`CreditCardIcon`) + "Agregar método"; DataTable (Nombre, Acciones).
**Botones y acciones:** **"Agregar método"** (`PlusCircle`) → modal; por fila **Editar** (`FilePenIcon`) / **Eliminar** (`TrashIcon`); modal campo "Nombre" → `paymentMethods.create/update`.

## 22. Configuración general (`/admin/settings`)
**Propósito:** hub de configuración + 2 operaciones destructivas (resets).
**Secciones:**
- **Card "Configuración del Sistema":** 3 botones-enlace: "Recetas" → `/admin/inventory/recipes`, "Métodos de pago" → `/admin/payment-methods`, "🤖 Antonella (asistente IA)" → `/admin/settings/antonella`.
- **Card consejo** (azul).
- **Card "Reset de Inventario"** (rojo): Contraseña admin + Confirmación ("RESET") → diálogo → `inventory.resetAllStock`.
- **Card "Reset de Clientes y Pedidos"** (naranja): mismos campos → diálogo → `inventory.resetCustomersAndOrders` (respalda antes de borrar).
**Estados:** botones deshabilitados hasta contraseña + palabra "RESET"; modales de confirmación.

## 23. Configuración de Antonella IA (`/admin/settings/antonella`)  ⭐ *(nuevo)*
**Propósito:** panel de control del asistente: modelo, system prompt, herramientas, habilidades personalizadas.
**Datos:** `antonella.listTools` (tools con name/label/description/category/danger + defaultSystemPrompt), `antonella.getConfig`. Mutación: `antonella.saveConfig`.
**Secciones:**
- Header con "Abrir chat" (→ `/admin/antonella`) y "Guardar" (`SaveIcon`).
- **Card "¿Qué es Antonella?"** (acento primario).
- **Card "Modelo de IA":** 3 tarjetas (Opus 4.8 recomendado / Sonnet 4.6 / Haiku 4.5).
- **Card "Instrucción principal (system prompt)":** botón "Restaurar" (`RotateCcwIcon`) + textarea monoespaciado (14 filas) + contador.
- **Card "Herramientas integradas":** dos grupos — "📖 Lectura (sin riesgo)" y "⚡ Acciones (modifican inventario, badge ACCIÓN ámbar)". Cada `ToolRow` con label, descripción y **toggle switch** (estilo iOS).
- **Card "Enseñar algo nuevo":** lista de habilidades (nombre mono + descripción + papelera) + formulario (Nombre, "Qué hace / cuándo usarla") + **"Agregar habilidad"** (`PlusIcon`). Nota sobre conexiones reales.
**Botones y acciones:** "Abrir chat", "Guardar" → `antonella.saveConfig({systemPrompt, disabledTools, customTools, model})`, selección de modelo, "Restaurar" prompt, toggles de herramientas, "Agregar habilidad" (valida + normaliza snake_case), papelera por habilidad.

---

# AUTENTICACIÓN

## 24. Login (`/login`)
**Propósito:** inicio de sesión.
**Secciones:** layout centrado, Card con: banner de error (si `?error=`), Correo, Contraseña, "Iniciar sesión", "Rellenar credenciales demo", enlace "Crear cuenta".
**Botones:** **"Iniciar sesión"** (server action `login`), **"Rellenar credenciales demo"** (refs, no envía), enlace → `/signup`.

## 25. Registro (`/signup`)
**Propósito:** crear cuenta. Mismo layout que Login. Campos: Nombre, Correo, Contraseña (min 8). **"Crear cuenta"** (server action `signup`), enlace → `/login`.

---

# Apéndice A — Páginas legado / técnicas (NO rediseñar sin confirmar)

- **`/admin/disassembly`** — versión **antigua y monolítica (~2772 líneas)** del despiece. Mezcla ingreso de compra + despiece masivo + tablero, con heurísticas frágiles de nombres. **Ya reemplazada por `/admin/despiece`.** Confirmar con el cliente si sigue en uso antes de invertir en ella.
- **`/admin/inventory/settings`** — solo **redirige** a `/admin/settings` (sin UI). No requiere diseño.

# Apéndice B — Modales/componentes compartidos
- **TicketModal** — ticket de compra imprimible / envío WhatsApp (pedidos, cobranza, detalle cliente).
- **PaymentReceiptModal** — recibo de abono (cobranza, detalle cliente).
- **DeleteConfirmationDialog** — confirmación de borrado (pedidos, clientes, productos, métodos, caja).
- **DataTable / SearchFilter** — tabla con orden, exportación CSV, búsqueda y filtros (pedidos, clientes, productos, caja, métodos).
- **Combobox** — selector con búsqueda (cliente, producto, método, lista de precios).
- **OrderDisassemblyManager** — gestor de despiece embebido en el detalle del pedido.

# Apéndice C — Flujo operativo del día (para entender el journey)
1. **Compra del día** → registra cerdos comprados → genera stock de canales.
2. **Despiece** → corta canales en piezas según demanda de pedidos.
3. **Pedidos / POS** → captura lo que pide cada cliente.
4. **Pesaje** → pesa cada pieza (peso real) → marca el pedido listo para cobro.
5. **Cobro** → fija precio/kg → cobra (contado/crédito) → ticket.
6. **Cobranza** → gestiona el crédito y abonos.
7. **Rendimiento** → mide cuánto rindió el despiece vs lo estimado; calibra recetas.
8. **Antonella** → asistente transversal que consulta y opera todo lo anterior.

> Las **Recetas/Configurador** (#16) son el dato central del que dependen Despiece, Pedidos, Rendimiento y Precios — es la pantalla que más se beneficia de trabajo de UX.
