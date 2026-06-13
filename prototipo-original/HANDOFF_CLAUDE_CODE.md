# 🎨 → 💻 Handoff: Diseño a Código

**De:** Claude Design (prototipo navegable + especificación)  
**Para:** Claude Code (implementación en repo real)  
**Fecha:** 12 de junio, 2026

---

## 📦 Qué tienes aquí

### 1. Prototipo navegable (HTML + React/JSX)
- **`Carnicos Gustavo - Sistema + iAntonella.html`** — app completa interactiva
  - Rail con 11 módulos operativos + 7 de configuración
  - TopBar con logo, nombre, control de tema, usuario
  - 20+ pantallas con lógica de estado funcional
  - iAntonella embebido (chat, launcher, sugerencias)
  
- **`Sistema de Diseño.html`** — catálogo visual de componentes
  - Botones (5 tipos × 4 tamaños)
  - Campos, selectores, fechas, switches
  - Estados, badges, tablas, diálogos
  - Kit iAntonella (AiField, AiSuggestBar, AiConfirmCard, AiLearned)

### 2. Especificación funcional (GUIA_UI_UX_PLATAFORMA.md)
- Propósito de cada pantalla
- Datos que usa (qué endpoint tRPC)
- Cada botón y a dónde conecta
- Estados visuales (colores semánticos, badges)
- **Nota:** los nombres de endpoints + campos son los que ve hoy en el código real

### 3. Componentes fuente (JSX)
- `cg-data.jsx` — datos de ejemplo + configuración de marca (paletas, tipografía)
- `cg-ui.jsx` — componentes base reutilizables (Card, Btn, Badge, SearchFilter, Stat, etc.)
- `cg-ai-kit.jsx` — **kit de iAntonella** (AiField, AiSuggestBar, AiConfirmCard, AiLearned)
- `cg-recetas.jsx` — **Recetas/Configurador** (la pantalla más compleja)
- `cg-screens-a.jsx`, `cg-screens-b.jsx` — todos los módulos

### 4. Tokens de marca
En `cg-data.jsx`:
```javascript
CG.color = { /* 4 temas (warm-light, warm-dark, neutral-light, neutral-dark) */ }
CG.font = { ui: 'Archivo', display: 'Anton', mono: 'JetBrains Mono' }
CG.palettes = [ { id: 'warm', name: 'Cálida', swatch: [...] }, ... ]
```

---

## 🎯 Cómo implementar (orden recomendado)

### Paso 1: Infraestructura (4-6 horas)
**Archivo:** `apps/web/src/app/globals.css` + `layout.tsx`

1. Injectar tokens de marca como CSS variables (4 temas con `[data-theme]`)
2. Crear componente **Rail** (sidebar con iconos)
3. Crear componente **TopBar** (logo, nombre, control de tema, usuario)
4. Crear **Layout shell** que envuelva todas las rutas `/admin/*`
5. Persistencia de tema en localStorage (`cg_palette`, `cg_mode`)

**Resultado:** navegación funcional + tema dinámico

### Paso 2: Módulos operativos (en orden de ROI)

#### A. POS (`/admin/pos`) — 6-8 horas
- Combobox cliente, método, lista de precios
- Búsqueda de productos
- Carrito con piezas/kg
- Clasificación: En stock / Por despiece / Faltante
- Botón "Crear pedido"
- **Datos:** `products.list`, `customers.list`, `paymentMethods.list`, `inventory.priceListsList`
- **Acción:** `orders.create`

#### B. Báscula (`/admin/weighing-station`) — 8-10 horas
- 3 columnas: órdenes, captura de peso, progreso
- Input de peso gigante (UI de kiosco)
- Selector de recipiente (tara predefinida)
- Registra peso con `orders.updateOrderItemWeight`
- Botón flotante "Cobrar"
- **Atajos teclado:** Enter=registrar, ←/→=navegar

#### C. Despiece (`/admin/despiece`) — 10-12 horas
- Grid de canales (tarjetas + demanda)
- Expandir canal → ver piezas (PieceCards)
- Stepper de cantidad de canales
- Botón "Despiezar N"
- Sub-despiece y variantes
- **Datos:** `yields.despiecePanel`, `products.list`, `products.getTransformations`

#### D. Pedidos (`/admin/orders` + `/admin/orders/[id]`) — 8-10 horas
- Lista con búsqueda + filtro estado + tabla exportable
- Estados con badges (Pagada=verde, Por pesar=amarillo, Cancelada=rojo, etc.)
- Modal de nuevo pedido (cliente, items, total)
- Detalle: resumen, artículos, OrderDisassemblyManager, botones (liquidar, crédito, eliminar)
- **Datos:** `orders.list`, `orders.get`, `customers.list`
- **Acciones:** `orders.create`, `orders.replaceItems`, `orders.priceAndCharge`

#### E. Recetas (`/admin/inventory/recipes`) — 12-16 horas
- **Ya está el flujo completo en el prototipo:**
  - Tablero con tarjetas de estilo
  - Paleta de productos (drag-drop, con badges de uso)
  - **ProductSelector** (Combobox) para agregar piezas
  - Fila editable (nombre, piezas, kg, %)
  - Sub-despiece (nivel 2 y más)
  - Card de editar producto (agregar a canal, ramificar)
  - RefW (peso del canal) con botón "Promedio"
  - iAntonella: AiSuggestBar (estimar pesos), AiLearned (aplicado)
- **Datos:** `products.list`, `inventory.recipesList`
- **Acciones:** `inventory.recipesUpsert`, `inventory.setRefWeight`, `inventory.classifyOrphan`

El resto (Cobranza, Clientes, Rendimiento, Caja, etc.) siguen el mismo patrón.

---

## 🤖 iAntonella: integración paso a paso

### El contrato de UI
Siempre: **iA propone → usuario confirma → se aplica → aprende**

### Componentes (en `cg-ai-kit.jsx`)
1. **AiField** — campo numérico que iA pre-rellena
   - `<AiField suggestion={106.4} unit="kg" value={weight} onCommit={(val, source)=>{...}} />`
   - El usuario ve el valor fantasma y hace clic para aceptar

2. **AiSuggestBar** — banner de acción propuesta
   - `<AiSuggestBar tone="sugerencia" title="Estimar pesos" text="..." primary="Aplicar" onPrimary={()=>{...}} />`
   - Usado en Recetas para proponer estimar pesos desde %

3. **AiConfirmCard** — confirmación de acción protegida (antes de despiezar, convertir, borrar)
   - `<AiConfirmCard title="¡Acción protegida!" rows={[["Acción", "Despiezar"], ...]} onConfirm={()=>{...}} />`

4. **AiLearned** — píldora de aprendizaje
   - `<AiLearned onUndo={()=>{...}}>estimé los pesos del CANAL AMERICANO...</AiLearned>`

### Dónde integrar (mínimo viable)
- **Recetas:** AiSuggestBar (estimar pesos) + AiField (peso del canal)
- **Pesaje:** AiField (peso real estimado desde receta)
- **Rendimiento:** AiField (rendimiento medido vs estimado)
- **Despiece:** AiConfirmCard (antes de despiezar) + AiLearned (hizo caso)

### API key (CRÍTICO)
**NO la pongas en el cliente.** Va en:
```bash
# packages/api/.env
ANTHROPIC_API_KEY=sk-...
```

El backend la lee via `process.env.ANTHROPIC_API_KEY` y responde con sugerencias vía tRPC.

---

## 📋 Mapa de carpetas (repo real)

```
M1-Gestion-CarnicosGustavo/
├── apps/web/src/
│   ├── app/
│   │   ├── globals.css          ← tokens de marca aquí
│   │   ├── layout.tsx           ← Rail + TopBar
│   │   └── admin/
│   │       ├── page.tsx         (Panel)
│   │       ├── pos/page.tsx     ← EMPEZAR AQUÍ
│   │       ├── weighing-station/
│   │       ├── despiece/
│   │       ├── orders/
│   │       ├── orders/[id]/
│   │       ├── inventory/recipes/
│   │       └── ...
│   ├── components/
│   │   ├── admin-layout.tsx     (shell actual, a adaptar)
│   │   └── ... (shadcn/ui)
│   └── lib/
│       └── trpc.ts
├── packages/api/
│   ├── .env                     ← ANTHROPIC_API_KEY aquí
│   └── trpc/router/...          (endpoints reales)
└── packages/db/
    └── schema.prisma            (modelos)
```

---

## ✅ Checklist de implementación

- [ ] **Infraestructura**
  - [ ] Tokens de marca en globals.css (4 temas)
  - [ ] Rail + TopBar + Layout
  - [ ] Control de tema + localStorage
  
- [ ] **POS** (alta prioridad, táctil)
  - [ ] Combobox cliente/método/lista
  - [ ] Búsqueda productos
  - [ ] Carrito con clasificación
  
- [ ] **Báscula** (diferencial)
  - [ ] Input peso gigante
  - [ ] Selector recipiente
  - [ ] Atajos teclado
  
- [ ] **Despiece**
  - [ ] Grid canales
  - [ ] PieceCards expandibles
  - [ ] Sub-despiece
  
- [ ] **Pedidos (lista + detalle)**
  - [ ] Tabla con filtros
  - [ ] Modal nuevo pedido
  - [ ] Detalle completo
  
- [ ] **Recetas** (lo más complejo, pero ya está el flujo)
  - [ ] Tablero + Paleta
  - [ ] ProductSelector funcionando
  - [ ] Ramificación desde Card
  - [ ] iAntonella (AiSuggestBar + AiField)

- [ ] **iAntonella**
  - [ ] API key en packages/api/.env
  - [ ] AiField en Recetas
  - [ ] AiConfirmCard en Despiece
  - [ ] Flujo propuesta → confirmación → aprende

---

## 🔗 Referencias en el prototipo

**Ubicaciones clave en el código JSX:**

| Módulo | Archivo | Línea |
|--------|---------|-------|
| POS | `cg-screens-a.jsx` | ~200 |
| Báscula | `cg-screens-a.jsx` | ~400 |
| Despiece | `cg-screens-a.jsx` | ~600 |
| Pedidos | `cg-screens-b.jsx` | ~100 |
| Recetas | `cg-recetas.jsx` | ~1 (todo el archivo) |
| ProductSelector | `cg-recetas.jsx` | ~120 |
| Card ramificación | `cg-recetas.jsx` | ~425 |
| iAntonella kit | `cg-ai-kit.jsx` | ~1 |
| Datos + Paletas | `cg-data.jsx` | ~1 |

---

## 💬 Consultas frecuentes

**P: ¿Debo copiar-pegar el JSX del prototipo?**  
R: No — úsalo como referencia visual y de flujo. Adapta a **shadcn/ui** real (Button, Input, Select, etc.) y usa los **datos reales de tRPC**.

**P: ¿Puedo cambiar el layout?**  
R: Sí, pero respeta la **rail lateral de iconos** + topbar — es la navegación del negocio.

**P: ¿Qué pasa si iAntonella propone algo mal?**  
R: El usuario NO confirma (rechaza). No hay acción sin confirmación.

**P: ¿Cuánto toma implementar todo?**  
R: ~4 semanas si uno se dedica full-time. Priorizar POS + Báscula + Despiece primero.

---

**Última verificación:** ProductSelector, Card ramificación, 20+ pantallas, Sistema de Diseño, iAntonella kit  
**Estado:** ✅ Listo para implementar
