# Estación de pesaje en una sola pantalla

Nueva vista de la estación de pesaje (Báscula) pensada para el operador junto
al indicador: **todo cabe en una pantalla, sin desplazamiento de página**.
Los paneles se desplazan por dentro si hace falta.

- **Ruta nueva:** `/admin/weighing-station/v2` (la pantalla actual
  `/admin/weighing-station` se mantiene sin cambios de flujo).
- **Rama:** `feat/pesaje-una-pantalla`.
- **No se despliega a producción** hasta que se apruebe el merge. `main`
  despliega solo por Coolify; esta rama no se empuja a `main`.

En desarrollo local existe además `/dev/pesaje-preview` (solo `NODE_ENV=development`)
para revisar el diseño con datos de ejemplo, sin sesión ni base de datos.

## Diseño (v4: instrumento I-QY, según el dibujo de Alberto)

Toda la estación vive dentro de una **carcasa de equipo** oscura. No debe
parecer una página web sino un instrumento de medición. Las proporciones son
orientativas («nada es fijo») y se compactan en pantallas bajas (≤ 860 px de
alto, p. ej. 1366×768).

```
┌───────────────────────── carcasa ─────────────────────────┐
│ 1 Pedidos │ 2 Pedido        │ 3 Pendientes   │ 5 Venta /   │
│ (≈20 %)   ├─────────────────┴────────────────┤   ticket    │
│           │ 4 Báscula I-QY (LCD + botones)   │  (≈16 %)    │
├───────────┴──────────────────────────────────┴─────────────┤
│ [5 botones] │ 7 Pantalla de funciones (menús) │ [5 botones] │
│ [fila inferior de teclas de función, anchas y cuadradas]   │
└────────────────────────────────────────────────────────────┘
```

| # | Módulo | Qué hace |
|---|---|---|
| 1 | Pedidos | Se selecciona el pedido (J/K + Enter). |
| 2 | Pedido | Detalles: pedido, cliente, producto en báscula, piezas, neto acumulado (suma de capturas), total. |
| 3 | Pendientes de pesar | Renglones `PENDIENTE_PESAJE`; el seleccionado va a la báscula. |
| 4 | Báscula I-QY (protagonista) | Carcasa plata de esquinas muy redondeadas y frente negro brillante. Placa centrada con «Cárnicos Gustavo» en dorado (sustituye el logo Rhino). LCD celeste retroiluminado, dígitos de 7 segmentos negros con «8» fantasma, unidades pcs/lb/kg con ▶, icono de batería, marcas en el borde inferior del LCD y etiquetas blancas debajo (CERO, TARA, ESTABLE, HOLD, PICO, M+, HML, BATERÍA). «I-QY» a la izquierda bajo las etiquetas. Botones de membrana con borde blanco: ON/OFF, →0←/▲, →T←/▼ (rojos), M+/◀, HOLD/▶ (amarillos), f/↵ (azul). Línea discreta B/T/N dentro del LCD. |
| 5 | Venta / ticket | Lo ya pesado pasa aquí con el **precio del cliente** (editable), subtotal y total. «Cobrar e imprimir» abre el cobro existente (`/admin/checkout?order=N`), que imprime el ticket. |
| 7 | Pantalla de funciones | LCD verde con menús: Inicio (capturas, deshacer), Tara (recipientes), Serial (conexión Web Serial y ajustes), Tramas (diagnóstico), Tema, Teclado (peso manual y lecturas de báscula), Atajos. |

### Tara (corrección v4)

El display 4 muestra **la lectura en vivo**: bruto en vivo, tara del
recipiente elegido y neto = bruto − tara (si la báscula envía neto, la tara
es 0). Lo **acumulado** (suma de capturas) va en 2 y en 7 · Inicio. Antes el
display mezclaba la tara acumulada de 2 capturas (2 × 2.500 = 5.000) con el
bruto en vivo, por eso marcaba 5.000 con Tambo Azul (2.500).

### Precios por cliente (módulo 5)

Ya existe en M1 y se reutiliza sin migraciones:

1. **Último** — `customer_prices` (cliente × producto). `orders.priceAndCharge`
   lo sobrescribe al cobrar («guarda en lista del cliente»), así que es el
   último precio cobrado a ese cliente.
2. **Lista** — la lista de precios asignada al cliente
   (`customers.price_list_id` → `price_list_items`).
3. **Pedido** — `order_items.unit_price`.
4. **Base** — `products.price_per_kg`.

Se lee con `customerPrices.getByCustomer` (el mismo que usan POS y Precios) y
se resuelve en `weighing-station-v2/pricing.ts` (con pruebas). Pendiente:

- No hay **historial** de precios (solo el último por cliente/producto). Un
  historial requeriría una tabla nueva (migración aditiva, no hecha).
- Los precios editados en 5 **no viajan** todavía al cobro: el cobro vuelve
  a proponer el precio guardado del cliente. Falta pasar los precios (o
  llamar `priceAndCharge` desde aquí con método de pago).
- **Envío al cliente**: el ticket ya se puede mandar por WhatsApp desde
  `ticket-modal`; el botón «Envío» de 5 queda deshabilitado hasta definir el
  flujo de reparto.

### iAntonella

El lanzador flotante tapaba la esquina inferior derecha (teclas de 7). En
esta vista se oculta (`[data-antonella-launcher]` + `:has([data-pesaje-station])`)
y se abre con **Súper+I** o la tecla «iAntonella» de la fila inferior.

## Teclado (prioridad teclado, también ratón)

Súper (Meta) es el modificador; **Alt** es el respaldo. Ctrl nunca se usa. Se
lee la tecla física (`event.code`) para que Alt+letra funcione en macOS.
Al escribir en un campo, las letras y el espacio no se interceptan.

| Tecla | Acción |
|---|---|
| Súper+1…5, Súper+7 | Enfocar módulo |
| Súper+J / K, flechas ↑/↓ | Mover selección (1 pedido, 2/3 renglón, 5 línea de venta, 4 recipiente, 7·Tema tema) |
| ← / → | Cambiar renglón |
| Enter (f ↵) | 1→3, 2/3→4, 4/7 registrar peso, 5 cobrar |
| Espacio (M+) | Capturar peso estable |
| Súper+0 (→0←) | Cero: limpiar peso manual |
| Súper+R (→T←) | Tomar el peso actual como tara («Otro») |
| Súper+L (HOLD) | Congelar / soltar display |
| Súper+Shift+B (ON/OFF) | Conectar / desconectar báscula |
| Súper+Z | Deshacer última captura |
| Súper+H / C / B / X / M / N / / | 7 · Inicio / Tara / Serial / Tramas / Tema / Teclado / Atajos |
| Súper+T | Tickets (superposición casi a pantalla completa) |
| Súper+O | Cola de pedidos |
| Súper+P | Pesaje de producción |
| Súper+G | Cobro e impresión de ticket |
| Súper+I | iAntonella |
| Súper+V | Versión clásica |
| Súper+Shift+T | Ciclar tema |
| Esc | Cerrar superposición / volver a 7 · Inicio |

## Temas

Se aplican solo al área de la estación (y a sus superposiciones), no a la
cabecera ni al rail, mediante `data-pesaje-theme` y variables CSS. Se
persisten en `localStorage` (`cg.pesajeTheme`).

| Id | Descripción |
|---|---|
| `m1` (predeterminado) | Paleta actual de M1 (crema/rojo). Respeta el modo claro/oscuro global. |
| `tokyo-night` | Oscuro, inspirado en Tokyo Night. |
| `gruvbox` | Oscuro, inspirado en Gruvbox. |

## Funcionalidad que se conserva

Toda la lógica de la estación actual:

- Panel Web Serial (`useScaleSerial`, cola de capturas, `scaleReadingId`).
- Selección de pedido y renglón; registro de peso
  (`orders.updateOrderItemWeight` en gramos).
- Tara por pesada: neto = bruto − tara del recipiente (Tambo, Tara,
  Cubeta, Otro, Sin recipiente).
- Lectura neta de la báscula: no se resta el recipiente otra vez.
- Pesaje de producción / envío a cola.
- Oferta de pasar a cobro al terminar un pedido (no en producción).
- Resguardos recientes: no se pesan pedidos cancelados o cerrados (viven
  en el router; esta vista no los relaja).
- Teclado numérico en pantalla, Capturar tara y TARE.

La ingesta HTTP de la T-RSS3 sigue apagada hasta que se indique lo contrario
(`SCALE_INGEST_ENABLED`). Esta vista no la enciende.

## Accesibilidad e idioma

Foco visible, etiquetas `aria` en teselas y superposiciones, operable con
ratón y teclado. Textos de la interfaz en **español con tildes**.

## Cómo probar

```
bun install
bun run dev --filter=web          # http://localhost:3001
# Con sesión: /admin/weighing-station/v2
# Sin sesión (solo desarrollo): /dev/pesaje-preview
bunx tsc --noEmit -p .            # en apps/web
bunx biome check --no-errors-on-unmatched <archivos cambiados>
bun run test                      # en apps/web
```
