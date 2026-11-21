"""Genera docs/pantalla-unica-menu.excalidraw: flujo de atención en una sola
pantalla + menú inferior → pantalla 7 → ventana sobrepuesta.

Uso: python3 -I scripts/gen-pantalla-unica-excalidraw.py
"""

import json
import random
from pathlib import Path

random.seed(21)
els = []
_n = [0]

INK = "#1e1e1e"
QUIET = "#868e96"
RED = "#c92a2a"
RED_BG = "#ffe3e3"
ORANGE_BG = "#fff4e6"
GREEN_BG = "#ebfbee"
BLUE_BG = "#e7f5ff"
GRAY_BG = "#f1f3f5"


def nid(prefix):
    _n[0] += 1
    return f"{prefix}{_n[0]}"


def base(kind, x, y, w, h, **kw):
    e = {
        "id": nid(kind[:2]),
        "type": kind,
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "angle": 0,
        "strokeColor": kw.get("stroke", INK),
        "backgroundColor": kw.get("bg", "transparent"),
        "fillStyle": "solid",
        "strokeWidth": kw.get("sw", 2),
        "strokeStyle": kw.get("style", "solid"),
        "roughness": 1,
        "opacity": kw.get("opacity", 100),
        "groupIds": [],
        "frameId": None,
        "roundness": {"type": 3} if kind == "rectangle" else None,
        "seed": random.randint(1, 2**31),
        "version": 1,
        "versionNonce": random.randint(1, 2**31),
        "isDeleted": False,
        "boundElements": [],
        "updated": 1795200000000,
        "link": None,
        "locked": False,
    }
    els.append(e)
    return e


def text(x, y, s, size=20, color=INK, container=None, align="left", w=None):
    lines = s.split("\n")
    width = w or max(len(line) for line in lines) * size * 0.55
    height = len(lines) * size * 1.25
    t = base("text", x, y, width, height, stroke=color)
    t.update(
        {
            "text": s,
            "originalText": s,
            "fontSize": size,
            "fontFamily": 5,
            "textAlign": align,
            "verticalAlign": "middle" if container else "top",
            "containerId": container["id"] if container else None,
            "lineHeight": 1.25,
            "autoResize": True,
        }
    )
    if container:
        container["boundElements"].append({"type": "text", "id": t["id"]})
        t["x"] = container["x"] + 8
        t["width"] = container["width"] - 16
        t["y"] = container["y"] + (container["height"] - height) / 2
    return t


def box(x, y, w, h, label, bg="transparent", stroke=INK, size=18, style="solid", kind="rectangle"):
    r = base(kind, x, y, w, h, bg=bg, stroke=stroke, style=style)
    text(0, 0, label, size=size, container=r, align="center")
    return r


def edge_point(b, side):
    cx, cy = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    return {
        "r": (b["x"] + b["width"], cy),
        "l": (b["x"], cy),
        "t": (cx, b["y"]),
        "b": (cx, b["y"] + b["height"]),
    }[side]


def arrow(a, b, sa="r", sb="l", label=None, via=None, style="solid", color=INK):
    x1, y1 = edge_point(a, sa)
    x2, y2 = edge_point(b, sb)
    pts = [(0, 0)]
    for px, py in via or []:
        pts.append((px - x1, py - y1))
    pts.append((x2 - x1, y2 - y1))
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    ar = base("arrow", x1, y1, max(xs) - min(xs), max(ys) - min(ys), style=style, stroke=color)
    ar.update(
        {
            "points": [list(p) for p in pts],
            "lastCommittedPoint": None,
            "startBinding": {"elementId": a["id"], "focus": 0, "gap": 4},
            "endBinding": {"elementId": b["id"], "focus": 0, "gap": 4},
            "startArrowhead": None,
            "endArrowhead": "arrow",
            "elbowed": False,
            "roundness": {"type": 2},
        }
    )
    a["boundElements"].append({"type": "arrow", "id": ar["id"]})
    b["boundElements"].append({"type": "arrow", "id": ar["id"]})
    if label:
        mx = x1 + (pts[len(pts) // 2][0] + pts[len(pts) // 2 - 1][0]) / 2
        my = y1 + (pts[len(pts) // 2][1] + pts[len(pts) // 2 - 1][1]) / 2
        text(mx - len(label) * 4.5, my - 26, label, size=16, color=QUIET)
    return ar


# ── Título ──────────────────────────────────────────────────────────────
text(0, -120, "Pantalla única — Cárnicos Gustavo (M1 · Báscula I-QY)", size=36)
text(
    0,
    -70,
    "Todo se opera desde una pantalla. Los menús de abajo muestran opciones en la pantalla 7;\n"
    "el detalle se abre en una ventana sobrepuesta (casi toda la pantalla, semitransparente) y Esc regresa.",
    size=18,
    color=QUIET,
)

# ── A. Flujo de atención ────────────────────────────────────────────────
text(0, 0, "A · Atender un pedido (sin cambiar de página)", size=26, color=RED)
W, H, GAP, Y = 210, 90, 60, 60
a1 = box(0, Y, W, H, "1 · Pedidos\nelige con J/K + Enter", bg=GRAY_BG)
a2 = box(W + GAP, Y, W, H, "3 · Pendientes\nrenglón a la báscula", bg=GRAY_BG)
a3 = box(2 * (W + GAP), Y, W, H, "4 · Báscula I-QY\nEspacio captura", bg=RED_BG, stroke=RED)
a4 = box(3 * (W + GAP), Y, W, H, "Registrar peso\nneto = bruto − tara", bg=GRAY_BG)
dq = box(4 * (W + GAP), Y - 5, 170, 100, "¿Quedan\nrenglones?", kind="diamond")
a5 = box(4 * (W + GAP) - 20, Y + 200, W, H, "5 · Venta / ticket\nprecio del cliente", bg=ORANGE_BG)
a6 = box(3 * (W + GAP), Y + 200, W, H, "Cobrar AQUÍ\ncontado o crédito", bg=GREEN_BG)
a7 = box(2 * (W + GAP), Y + 200, W, H, "Ticket impreso\no por WhatsApp", bg=GREEN_BG)
arrow(a1, a2)
arrow(a2, a3)
arrow(a3, a4)
arrow(a4, dq)
arrow(dq, a2, "t", "t", label="sí: siguiente", via=[(dq["x"] + 85, Y - 50), (a2["x"] + W / 2, Y - 50)])
arrow(dq, a5, "b", "t", label="no")
arrow(a5, a6, "l", "r")
arrow(a6, a7, "l", "r")
text(
    0,
    Y + 210,
    "Camino inverso: si el peso ya está en la báscula\n(p. ej. 20 piernas), primero se asigna a un pedido\ny luego se elige el producto.",
    size=16,
    color=QUIET,
)
text(
    2 * (W + GAP),
    Y + 310,
    "Hoy el cobro salta a /admin/checkout. Objetivo: cobrar dentro del módulo 5\n"
    "y que el precio editado ahí sea el que se cobra.",
    size=16,
    color=RED,
)

# ── B. Menú inferior → pantalla 7 → ventana sobrepuesta ─────────────────
YB = 520
text(0, YB, "B · Menú inferior → opciones en la pantalla 7 → ventana sobrepuesta", size=26, color=RED)
keys = [
    "Pedidos",
    "Compra\nCEDIS",
    "Despiece",
    "Recetas",
    "Inv. frío",
    "Precios",
    "Clientes",
    "Cobranza",
    "Cierre",
    "Config",
]
KW, KH, KG = 112, 64, 12
key_els = []
for i, k in enumerate(keys):
    key_els.append(box(i * (KW + KG), YB + 60, KW, KH, k, bg=GRAY_BG, size=16))
text(0, YB + 132, "Teclas de función (fila inferior de la carcasa). Atajo: Súper/Alt + letra.", size=14, color=QUIET)

d7 = box(
    0,
    YB + 200,
    560,
    170,
    "7 · Pantalla de funciones (LCD verde)\n"
    "muestra las opciones rápidas del menú elegido.\n"
    "Ej. Recetas: ver receta del canal · ajustar % · activar/desactivar\n"
    "Enter = acción rápida · → = más detalle",
    bg=GREEN_BG,
    size=16,
)
ov = box(
    700,
    YB + 200,
    540,
    170,
    "Ventana sobrepuesta (~90 % de la pantalla)\n"
    "semitransparente: se ve la báscula detrás.\n"
    "Configuración completa del menú (tablas, formularios).\n"
    "Esc o Guardar = regresa sin perder el pedido.",
    bg=BLUE_BG,
    size=16,
    style="dashed",
)
arrow(key_els[3], d7, "b", "t", label="pulsar menú")
arrow(d7, ov, "r", "l", label="más detalle")
arrow(ov, d7, "b", "b", label="Esc", via=[(970, YB + 420), (280, YB + 420)], style="dashed", color=QUIET)

# ── C. Qué muestra cada menú ────────────────────────────────────────────
YC = YB + 480
text(0, YC, "C · Qué muestra cada menú", size=26, color=RED)
rows = [
    ("Menú", "Pantalla 7 (opciones rápidas)", "Ventana sobrepuesta (detalle / config)"),
    ("Pedidos", "nuevo pedido · buscar · cancelar", "captura completa (POS) y edición"),
    ("Compra / CEDIS", "registrar llegada · kg real vs comprado", "compra por proveedor + verificación"),
    ("Despiece", "canales disponibles · despiezar 1 canal", "plan por demanda viva y recetas"),
    ("Recetas", "receta activa · % por pieza", "configurador canal → piezas → variantes"),
    ("Inv. frío", "pasar a congelado / descongelar", "historial de transferencias"),
    ("Precios", "precio del cliente para el renglón", "lista de precios por cliente"),
    ("Clientes", "saldo · crédito disponible", "ficha 360° del cliente"),
    ("Cobranza", "por cobrar hoy · registrar abono", "cuentas por cobrar completas"),
    ("Cierre", "entradas vs salidas del día", "rendimiento vs receta y KPIs"),
    ("Config", "báscula · tara · tema · atajos", "productos, métodos de pago, usuarios"),
]
cw = [200, 440, 480]
for r, row in enumerate(rows):
    x = 0
    for c, cell in enumerate(row):
        bgc = RED_BG if r == 0 else ("transparent" if r % 2 else GRAY_BG)
        box(x, YC + 50 + r * 40, cw[c], 40, cell, bg=bgc, size=15, stroke=QUIET)
        x += cw[c]

doc = {
    "type": "excalidraw",
    "version": 2,
    "source": "https://excalidraw.com",
    "elements": els,
    "appState": {"viewBackgroundColor": "#ffffff", "gridSize": None},
    "files": {},
}
out = Path(__file__).resolve().parent.parent / "docs" / "pantalla-unica-menu.excalidraw"
out.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
print(out, len(els), "elementos")
