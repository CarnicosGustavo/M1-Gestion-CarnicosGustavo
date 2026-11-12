# Báscula en M1: contexto y handoff

Índice del módulo de báscula del lado de M1 (12 nov 2026). El detalle técnico del endpoint y de Web Serial está en [`docs/scale-ingest.md`](../scale-ingest.md); este documento explica cómo encaja todo y qué falta.

> El hardware (placa LILYGO T-RSS3, firmware, control remoto y simulación) vive en el repo **privado** `abalderasdev/T-RSS3`. Su handoff completo está en [`docs/handoff/README.md`](https://github.com/abalderasdev/T-RSS3/blob/main/docs/handoff/README.md), con la cronología, el hardware, los accesos (sin valores) y los pendientes. Este repo es **público**: aquí no van secretos, IPs ni datos internos.

## Las dos formas de leer la báscula

| | **A. Gateway T-RSS3** (opción B de hardware) | **B. PC con Web Serial** |
|---|---|---|
| Cómo llega el peso | Rhino I-QY → RS-232 → LILYGO T-RSS3 (ESP32-S3) → Wi-Fi/HTTPS → `POST /api/scale/ingest` | Rhino I-QY → RS-232 / USB-serial → Chrome o Edge en la PC → pantalla **Báscula** |
| Autenticación | Token por dispositivo (`Authorization: Bearer`, el servidor guarda solo el sha256) | Sesión del usuario (tRPC `scaleSerial.capture`) |
| Tabla | `scale_readings` | `scale_readings` con `source='pc-webserial'` |
| Estado | Endpoint en `main` (#20), **apagado** | En `main` (#24) |
| PRs | #18, #19, #20, #21 | #24 (migración 0004) |

Las dos usan la misma regla de captura: **una pesada por colocación**, estable y ≥ 100 g, que se rearma cuando el peso vuelve a ±50 g del cero.

## Flujo de pesadas

1. El operador elige el **pedido** y la **línea** en la pantalla Báscula (`/admin/weighing-station`). En el futuro también podrá hacerlo desde el control remoto (ver más abajo).
2. Coloca la pieza. Cuando el peso es estable, se captura una lectura.
3. Las lecturas del gateway llegan **sin asignar**. `order_id`, `order_line_id` y `piece_count` del firmware son solo pistas; la pantalla ofrece la última lectura estable del dispositivo elegido y la operadora la usa en la línea.
4. Al registrar, `orders.updateOrderItemWeight` guarda el peso del renglón (solo renglones `PENDIENTE_PESAJE`, con gramos explícitos, #18) y marca la lectura como consumida (`scaleReadingId`, #21).

## Tara por pesada

- Las piezas se pesan **sueltas**, **en tara** o **en tambo**, y cada recipiente pesa distinto.
- Cada captura guarda su recipiente (`container_id`: ninguno, tara, tambo_azul, cubeta u otro) y su tara (`tare_g`).
- **Neto del renglón = Σ max(0, bruto_i − tara_i)**. Cambiar de recipiente solo afecta a las capturas siguientes.
- El indicador se configura para mandar **bruto** (`da=gros`) y **nadie usa su tecla TARA**, para no restar la tara dos veces. Si llega una trama neta (`NT`), la pantalla avisa.

## Endpoint de ingesta (apagado)

- `POST /api/scale/ingest`. El contrato está en [`docs/scale-ingest.md`](../scale-ingest.md#contrato-para-el-firmware).
- Apagador: **`SCALE_INGEST_ENABLED=false`**. Con cualquier valor distinto de `true`, responde **503** sin tocar la base y el firmware conserva su cola.
- Para encenderlo hace falta, en este orden y **solo con el OK de Alberto**:
  1. Que Alberto genere el token de cada placa (fuera del repo) y su sha256.
  2. `SCALE_DEVICE_TOKENS_SHA256=<device_id>:<sha256>,...` en las variables de la app.
  3. `SCALE_INGEST_ENABLED=true` y redeploy.
  4. Un dominio con HTTPS válido (el firmware rechaza `http://` y no sigue redirecciones).
- Las migraciones **0003** (`scale_readings`) y **0004** (Web Serial) ya están aplicadas en la base `carnicos` del Supabase del VPS (31 oct 2026).

## Contrato `/api/remote/*` (PENDIENTE)

El control remoto de la opción B (Raspberry Pi 5 con pantalla 800x480 estilo Rhino I-QY, joystick y botones) necesita estas rutas en M1. **Todavía no existen**; por ahora solo están en el mock de `abalderasdev/T-RSS3` (`sim/mock-m1/server.py`):

```
GET  /api/remote/orders              pedidos pendientes
GET  /api/remote/orders/<id>         líneas de un pedido
GET  /api/remote/active-line         línea activa de la báscula
POST /api/remote/active-line         fijar la línea activa
GET  /api/remote/last-weighing       última pesada recibida
```

Es una propuesta. Hay que confirmarla, diseñar su autenticación e implementarla (la programaría Minimax, como PR sin merge).

## Relación con la T-RSS3

- Firmware: `projects/centro-distribucion-carnicos` v0.3.0 (release `carnicos-v0.3.0`). Usa una cola en flash de 2040 eventos, `event_id` idempotente y `seq` que sobrevive reinicios.
- Simulación: Wokwi (T-RSS3 + Rhino virtual), mock de M1 y control remoto en contenedor, con CI en `abalderasdev/T-RSS3`.
- **Nada se ha probado con hardware real todavía.**

## Pendientes del lado de M1

- [ ] Capturar la **trama real del I-QY** (el panel Diagnóstico de la pantalla Báscula sirve) y ajustar el parser.
- [ ] Dominio de producción con HTTPS apuntando a M1 en el VPS (estado por confirmar).
- [ ] Implementar `/api/remote/*`.
- [ ] Activar la ingesta (pasos de arriba, con el OK de Alberto).
- [ ] Definir cuántas básculas y tablets hay y cómo se asocia cada una a su `device_id`.

## Reglas

- Los merges a `main` pueden disparar un redeploy: necesitan el OK de Alberto.
- No activar `/api/scale/ingest` sin su OK.
- No usar tokens reales en pruebas ni pegar secretos en issues, PRs o docs (este repo es público).

## Documentación general

La documentación completa de todos los proyectos (repositorios, interfaces, accesos sin valores, bóvedas y migración de cuenta) vive en el repo **privado** de la placa: [abalderasdev/T-RSS3 → docs/documentacion](https://github.com/abalderasdev/T-RSS3/blob/main/docs/documentacion/README.md). Hace falta acceso a ese repo. Por ser este repo público, aquí no se copia ese contenido.
