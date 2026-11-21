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

## Diseño

Se conserva el sistema de diseño de M1: paleta crema/rojo, tipografía
(Archivo, Anton, JetBrains Mono), componentes de `@finopenpos/ui`, barra
lateral y cabecera. La inspiración de **Omarchy / Hyprland** se aplica al
contenido: teselas con bordes finos, huecos constantes, acento en la tesela
enfocada y atajos de teclado con la tecla Súper.

### Teselas (layout fijo a la altura del área de contenido)

1. **Pedidos pendientes** — lista de la cola (`getPendingWeighingOrders`,
   refresco cada 8 s). Los pedidos nuevos parpadean en verde 3 s.
2. **Pedido seleccionado y renglones** — cliente, total, enlace a editar,
   líneas con la activa resaltada, piezas y neto acumulado.
3. **Display de peso en vivo** — grande, estilo indicador I-QY: STABLE /
   moviendo, bruto / tara / neto, selector de recipiente. El neto de una
   pesada es **bruto − tara del recipiente** (tara por pesada, no global).
4. **Capturas del renglón activo** — lista de capturas (bruto, tara,
   recipiente, neto, hora), con deshacer la última.
5. **Franja compacta de iAntonella / estado** — aviso de pendientes,
   estado de la báscula por cable y pista de atajos. No usa el slot alto
   de la versión actual.

Disposición de referencia (escritorio):

```
[======= 5. Franja de estado (alto fijo) =======]
[ 1. Pedidos ] [ 2. Pedido y renglones ] [ 4. Capturas ]
[ 3. Display de peso I-QY (ancho completo)             ]
```

Hueco entre teselas: 8 px. Radio heredado de M1. La tesela enfocada lleva
borde de color `primary` (2 px). El área de contenido no hace scroll;
si una lista no cabe, solo ella tiene `overflow-y: auto`.

## Teclado (prioridad teclado, también ratón)

Los atajos usan la tecla **Súper (Meta)**. Los navegadores y el sistema
suelen tragarse Meta, así que **Alt es el respaldo documentado y siempre
activo**. No se usan combinaciones solo con teclas F (el navegador no las
garantiza). Se evitan combos reservados del navegador (Ctrl/Cmd+T, W, R,
N, etc.).

| Atajo | Respaldo | Acción |
|---|---|---|
| Súper+1…5 | Alt+1…5 | Enfocar tesela 1 a 5 |
| Súper+J / K | Alt+J / K, o flechas ↑/↓ | Mover la selección en la tesela activa |
| Flechas ←/→ | | En tesela 2, cambiar de renglón |
| Enter | | Seleccionar / confirmar |
| Espacio | | Capturar peso estable (si no se escribe en un input) |
| Súper+T | Alt+T | Superposición de Tickets |
| Súper+O | Alt+O | Superposición de Pedidos |
| Súper+B | Alt+B | Superposición de ajustes / diagnóstico de báscula |
| Súper+P | Alt+P | Abrir diálogo de pesaje de producción |
| Súper+Shift+T | Alt+Shift+T | Ciclar tema |
| Esc | | Cerrar superposición |
| Súper+/ o `?` | Alt+/ | Hoja de atajos |

Dentro de un campo de texto, las letras sueltas y Espacio no se interceptan;
sí se interceptan las combinaciones con Súper o Alt y Esc.

## Superposiciones

Se abren casi a pantalla completa (**92 vw × 90 vh**) sobre el layout, con
fondo atenuado, trampa de foco y cierre con Esc o clic en el fondo.

- **Tickets (Súper+T):** detalle de pesadas del pedido seleccionado. Lista
  de capturas por renglón (bruto, tara, recipiente, neto, hora) y totales
  por línea. Si el pedido ya tiene renglones pesados, se consultan con
  `orders.get` (no solo los pendientes de la cola).
- **Pedidos (Súper+O):** cola completa con más contexto (notas, WhatsApp,
  artículos pendientes).
- **Báscula (Súper+B):** conexión Web Serial, ajustes y diagnóstico de
  tramas (la misma lógica que el panel actual).
- **Atajos (Súper+/):** esta tabla.

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
