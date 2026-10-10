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
| 401 | `{"error":"unauthorized"}` | Token inválido. No reintentar en bucle; alertar. |
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
