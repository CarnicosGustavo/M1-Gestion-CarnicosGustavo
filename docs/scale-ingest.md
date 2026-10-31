# Báscula física → app (`/api/scale/ingest`)

Módulo que conecta las básculas físicas con la estación de **Báscula**
(`/admin/weighing-station`).

## Arquitectura

```
Indicador Rhino I-QY ──RS-232 (DB9)──► LILYGO T-RSS3 (ESP32-S3, firmware T-RSS3)
                                            │  Wi-Fi, HTTPS POST (token por dispositivo)
                                            ▼
                        Vercel: POST /api/scale/ingest ──► tabla scale_readings
                                                                  ▲
           Tablet (Báscula) ── consulta cada ~1 s (tRPC scale.latest) ┘
           la operadora toca "Usar" → Registrar → orders.updateOrderItemWeight
                                                 (marca la lectura como consumida)
```

- El navegador **no** habla con la báscula (no hay Web Serial). Junto a la
  báscula no hay PC/RPi/tablet. El "agente local" es el firmware del ESP32
  (repo privado `abalderasdev/T-RSS3`).
- Las lecturas llegan **sin asignar** (opción b). La pantalla de Báscula muestra
  la última lectura estable del dispositivo elegido y la operadora decide en qué
  renglón usarla. `order_id`, `order_line_id` y `piece_count` que mande el
  dispositivo solo se guardan como pista.
- Solo se envían **pesajes estables** (y opcionalmente un *heartbeat*); el peso
  en vivo ya se ve en el indicador. Por eso basta con polling (~1 s, solo con la
  pantalla visible). SSE en Vercel se cortaría por la duración máxima de las
  funciones, y Supabase Realtime implicaría supabase-js + llave anon y RLS que no
  encaja con Better-Auth.
- Hora: si `captured_at` llega `null` (sin NTP), el servidor usa `received_at`.
  El orden de lecturas es por `id` (orden de llegada); `seq` sirve para detectar
  huecos o reinicios.

## Tabla `scale_readings`

Declarada en `packages/db/src/schema.ts`; migración
`apps/web/drizzle/0003_scale_readings.sql` (**pendiente, no aplicada**). RLS
activado y sin acceso para `anon`/`authenticated` (la app se conecta como
`postgres`). Índice único por `event_id` (idempotencia) e índice
`(device_id, id)` para "última lectura".

## Configuración (Vercel, variables *sensitive*)

| Variable | Valor |
|---|---|
| `SCALE_INGEST_ENABLED` | `true` para activar. Cualquier otro valor o ausente → el endpoint responde **503** sin tocar la BD (apagador). |
| `SCALE_DEVICE_TOKENS_SHA256` | Lista `deviceId:sha256hex` separada por comas, p. ej. `rss3-01:9f86d0…`. Solo el **hash** del token, nunca el token. |

Generar un token y su hash (en tu máquina, no en el repo):

```bash
TOKEN=$(openssl rand -hex 32)            # va al firmware (SCALE_INGEST_TOKEN)
printf %s "$TOKEN" | sha256sum           # el hash va a Vercel
```

`SCALE_DEVICE_ID` y `SCALE_INGEST_TOKEN` (texto claro) viven **solo en el
firmware**. El servidor no los lee.

### Orden para activar en producción

1. Aplicar `0003_scale_readings.sql` (Alberto, a mano; ver `apps/web/drizzle/README.md`)
   y actualizar `supabase/schema/app_tables.sql`.
2. Crear `SCALE_DEVICE_TOKENS_SHA256` en Vercel.
3. Poner `SCALE_INGEST_ENABLED=true` y redeploy.

Mientras no se haga, el endpoint responde 503 y el firmware conserva su cola.

## Contrato para el firmware

```
POST https://dashboard.carnicosgustavo.com/api/scale/ingest
Headers:
  Content-Type: application/json
  Authorization: Bearer <SCALE_INGEST_TOKEN>    (por dispositivo; el servidor solo guarda su sha256)
  X-Device-Id: <SCALE_DEVICE_ID>                (debe ser igual a body.device_id)
```

Body (JSON, máximo 2 KB):

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `event_id` | string UUID | sí | Idempotencia: el MISMO valor en cada reintento del mismo evento. |
| `device_id` | string | sí | `^[a-z0-9-]{1,64}$`, igual a `X-Device-Id`. |
| `seq` | entero ≥ 0 | sí | Creciente por dispositivo (debe sobrevivir reinicios). |
| `weight` | número | sí | Tal como lo da el indicador. |
| `unit` | `"kg"` \| `"g"` \| `"lb"` | sí | |
| `weight_g` | entero | sí | Gramos. Debe coincidir con `weight`+`unit` (±2 g). Rango −50 000 … 2 000 000. |
| `stable` | boolean | sí | Enviar eventos estables; los no estables se guardan pero la app no los ofrece. |
| `net` | boolean | no (false) | `true` si el indicador ya restó la tara. |
| `raw` | string ≤ 128 | no | Trama original, para depurar. |
| `captured_at` | ISO 8601 con zona \| null | no | `null` si no hay NTP → se usa la hora de recepción. |
| `order_id`, `order_line_id`, `piece_count` | entero \| null | no | Solo pista; no asigna. |

Ejemplo:

```json
{
  "event_id": "1b4e28ba-2fa1-41d2-883f-0016d3cca427",
  "device_id": "rss3-01",
  "seq": 1234,
  "weight": 12.345,
  "unit": "kg",
  "weight_g": 12345,
  "stable": true,
  "net": false,
  "raw": "ST,GS,+012.345kg",
  "captured_at": null,
  "order_id": null,
  "order_line_id": null,
  "piece_count": null
}
```

Respuestas (JSON):

| Código | Cuerpo | Qué hace el firmware |
|---|---|---|
| 201 | `{"status":"stored","id":N}` | Entregado; quitar de la cola. |
| 200 | `{"status":"duplicate","id":N}` | `event_id` ya existía → entregado. |
| 400 | `{"error":"invalid_body", ...}` | No reintentar; registrar y descartar. |
| 401 | `{"error":"unauthorized"}` | Falta el token o es inválido para ese `X-Device-Id`. No reintentar en bucle; alertar. |
| 403 | `{"error":"forbidden"}` | Dispositivo desconocido o `X-Device-Id` ≠ `device_id`. Alertar. |
| 409 | `{"error":"event_id_conflict"}` | El `event_id` ya existe para OTRO dispositivo. Descartar. |
| 413 | `{"error":"payload_too_large"}` | Descartar. |
| 415 | `{"error":"unsupported_media_type"}` | Corregir `Content-Type`. |
| 503 | `{"error":"ingest_disabled"}` | Ingesta apagada → conservar en cola y reintentar con backoff. |
| 429 / 5xx / timeout | — | Reintentar con backoff exponencial (respetar `Retry-After` si viene) conservando la cola. |

- HTTPS obligatorio, validando el certificado (bundle de CAs del ESP-IDF;
  nunca modo inseguro).
- No seguir redirecciones: un 3xx es un error de configuración (URL equivocada).
- No hay staging: `dashboard.carnicosgustavo.com` es producción. Los previews de
  Vercel pueden tener protección de despliegue (ver preguntas abiertas).

## Lectura directa desde la PC (Web Serial)

> Esta sección actualiza la nota de *Arquitectura*: además del gateway T-RSS3, ahora el navegador sí puede hablar con la báscula cuando hay una PC junto a ella.

Como alternativa al gateway ESP32 T-RSS3, la báscula **Rhino I-QY** puede conectarse directamente a la PC mediante RS-232 o un adaptador USB-serial. La pantalla **Báscula** (`/admin/weighing-station`) utiliza la Web Serial API para leerla.

### Compatibilidad y conexión

- Solo funciona en **Chrome o Edge de escritorio**.
- Requiere una página servida por **HTTPS** o `localhost`.
- No se necesita instalar controladores ni software adicional.
- La primera vez, el operador presiona **Conectar báscula** y selecciona el puerto.
- Las conexiones posteriores se recuperan mediante `getPorts`.
- Si se desconecta el cable, la conexión se reintenta con un intervalo progresivo de **1 s a 10 s**.

### Ajustes

Los ajustes se guardan en el navegador, en `localStorage`, con la clave `cg.scale.webserial.v1`:

- **9600 8N1** por defecto.
- Baudios disponibles: **1200–9600**.
- Modos:
  - **Continuo (`ot-cont`)**: solo lee.
  - **Por petición (`ot-req`)**: envía `P` cada 300–500 ms, con terminador ninguno, CR o CRLF.
- Unidad predeterminada para tramas que no la incluyen.
- Resolución en gramos para mejorar la estabilidad por software.
- Simulador con un puerto falso.

### Parser y diagnóstico

El parser es tolerante, ya que el formato real aún no está confirmado:

- Separa líneas por CR, LF o CRLF.
- Toma el primer número con signo; una sola coma sin punto se interpreta como decimal.
- Reconoce las unidades `kg`, `g`, `lb` y `lbs`.
- Interpreta las banderas:
  - `ST` / `S`: estable.
  - `US` / `U` / `M`: inestable.
  - `GS` / `G`: bruto.
  - `NT` / `N`: neto.
  - `OL` / `OVER`: sobrecarga.
- Si no hay bandera, considera estable una lectura cuando los valores permanecen dentro de ± la resolución durante al menos **800 ms**.

El panel **Diagnóstico** muestra las últimas **30 tramas** en texto y hex, con un botón **Copiar** para capturar el formato real y ajustar el parser.

### Captura

La captura aplica la misma lógica que el firmware T-RSS3:

- Se realiza una sola captura automática por colocación cuando el peso está estable y es mayor o igual a **100 g**.
- Se rearma cuando el peso vuelve a estar dentro de ±50 g del cero.
- El botón **Capturar** permite una captura manual y también exige volver a cero para habilitar la siguiente captura automática.
- **Deshacer última** realiza el borrado lógico de la captura.

### Asignación, recipiente y peso neto

El operador elige el pedido y el renglón antes de pesar. Cada captura se guarda ligada al renglón, con su número de piezas y con el recipiente seleccionado en ese momento (`container_id`: ninguno, tara, tambo_azul, cubeta u otro) y su tara en gramos (`tare_g`). La tara puede ser la tomada con **Capturar tara** o la tara manual al seleccionar **Otro**.

Cambiar de recipiente solo afecta las capturas siguientes; no modifica las capturas ya registradas.

La lista muestra, por captura, el peso bruto, el recipiente, la tara y el peso neto. Al final se muestran los totales.

El neto del renglón se calcula como:

`neto del renglón = Σ max(0, bruto_i − tara_i)`

Si el renglón tiene capturas, la página registra directamente ese neto. No se resta una tara global adicional ni se cambia el recipiente seleccionado, que continúa aplicándose a las siguientes capturas.

Si el operador teclea un peso —ya sea mediante un campo de entrada o el teclado en pantalla—, el renglón pasa a **peso manual** y se aplica el flujo habitual:

`neto = bruto − tara del recipiente`

El botón **Usar peso manual** / **Usar neto de capturas** alterna entre ambos modos. Al llegar una captura nueva o cambiar de renglón, el modo vuelve a **neto de capturas**.

### Guardado

Las capturas se guardan mediante la mutación tRPC `scaleSerial.capture`, usando la sesión del usuario y no un token de dispositivo. Se almacenan en la misma tabla `scale_readings` con:

- `source = 'pc-webserial'`
- `device_id = 'pc-webserial'`
- `net = false`, por tratarse de peso bruto
- `captured_by` = usuario
- `container_id` y `tare_g` = recipiente y tara de esa captura

Cada captura incluye un `event_id` UUID generado en el navegador para hacer idempotente el guardado.

Si no hay conexión de red, la captura se encola en IndexedDB, en la base `cg-scale-webserial`. La cola se procesa en orden FIFO y se reintenta con un backoff de **2 s a 60 s**. También se reintenta al recuperar la conexión mediante el evento `online`.

La mutación `scaleSerial.void` anula una captura (`voided_at`, idempotente; no se puede anular una lectura ya consumida) y la consulta `scaleSerial.lineCaptures` lista las capturas no anuladas de un renglón.

### Requisito de migraciones

Esta función requiere las migraciones **0003** y **0004**, que están pendientes. Mientras no se apliquen, el guardado falla y las capturas permanecen en la cola del navegador; el peso en vivo sigue funcionando.

### Preguntas abiertas

- Confirmar el formato real de la trama del I-QY mediante el panel de diagnóstico.
- Determinar si el indicador ya resta la tara (trama con `NT`). Si llega una trama neta, la pantalla muestra un aviso para no restarla dos veces.

## Preguntas abiertas (hardware)

1. **Rhino I-QY:** modo `ot-cont` (continuo) u `ot-req` (responde a `P`), baudios
   reales (1200–9600, ¿8N1?) y **formato de trama** (capturar de la báscula real:
   ASCII/binario, signo, decimales, unidad, bandera de estable, bruto/neto,
   terminador CR/LF, qué manda en sobrecarga o con peso negativo).
2. **Tara:** ¿se hace en el indicador (lectura neta, `net=true`) o en la app con
   los recipientes? Si es en el indicador, la app no debe restar el recipiente
   otra vez.
3. **Cuántas básculas y tablets**, y cómo se asocia cada tablet a su `device_id`
   (propuesta: se elige en la pantalla y se guarda en el navegador).
4. **URL de pruebas:** no hay staging. ¿Probar contra un preview con bypass de
   protección o directo en producción con el apagador?
5. **Wi-Fi** junto a la báscula: estabilidad, tamaño de la cola offline del
   ESP32, disponibilidad de NTP.
6. **Capacidad y resolución** de la báscula (para ajustar el rango validado).
