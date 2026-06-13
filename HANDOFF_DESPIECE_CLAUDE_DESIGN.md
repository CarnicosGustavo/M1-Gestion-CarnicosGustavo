# Handoff Claude Design — Módulo Despiece + Compra del día

> **Para:** diseñar el front en Claude Design. El **backend ya está listo** (tRPC + Supabase).
> Aquí están todos los endpoints, sus inputs/outputs exactos, las reglas de negocio y las
> pantallas a construir. El front debe consumir estos endpoints tal cual.

---

## 0. Cómo conectar (stack real)

- **API:** tRPC. En el cliente: `const trpc = useTRPC()` + `useQuery(trpc.X.queryOptions(input))` para lecturas y `useMutation(trpc.X.mutationOptions())` para escrituras (TanStack Query).
- **UI:** componentes `@finopenpos/ui` (shadcn) + lucide-react + tokens de marca (ver Sistema de Diseño).
- **iAntonella:** cada pantalla lleva su `<AntonellaSlot data={{tone, titulo, texto, acciones}} />` arriba.
- Todo es por usuario (el backend filtra por `user_uid` solo, no se pasa).

---

## 1. CONCEPTOS DEL NEGOCIO (leer primero)

- **Canal** = medio cerdo / cerdo entero. Tipos: **AMERICANO** (105 kg, cerdo completo),
  **NACIONAL_LOMO** (52.5 kg), **NACIONAL_ESPILOMO** (52.5 kg), **POLINESIO** (105 kg).
- **Despiece** = de un canal salen piezas. Una **receta** define cuántas piezas y qué % del peso.
- **Regla clave:** un despiece SIEMPRE da **≥2 productos** (ej. JAMÓN → JAMÓN S/H + HUESO PELÓN).
- **1 pieza puede salir de varias recetas** (ej. PIERNA sale de Americano y de Nacional).
- **Niveles:** nivel-1 = canal→pieza; nivel-2 = pieza→sub-pieza (BASE). Recursivo.
- **Despiece vs Variante:** *Despiece* SUMA al peso del padre (cortes reales); *Variante* es una
  presentación alternativa que NO suma (ej. JAMÓN vs JAMÓN S/H).
- **Productos de proveedor** (`category="Compra"`): NO salen de un canal, se compran directo
  (manteca, chicharrón, lomo ahumado…). Entran a inventario por compra.
- **Inventario dual:** todo se mide en **piezas (pz)** y **kilos (kg)** a la vez.
- **Autoguardado:** el configurador de recetas guarda en vivo (no lleva botón Guardar).

---

## 2. PANTALLAS A DISEÑAR

### A) Despiece operativo — ruta `/admin/despiece`
Donde el operador elige un canal y lo despieza según la demanda. **Ya existe**, se puede pulir.

### B) Compra del día — ruta `/admin/purchase` (AGREGAR 2ª CARD)
Hoy tiene 1 card (compra de canales en pie). **Falta la 2ª card: compra de productos de proveedor.**

### C) Configurador de recetas — `/admin/inventory/recipes` + `/admin/configurador`
El tablero. **Ya existe** y funciona; referencia visual en el prototipo del configurador.

---

## 3. ENDPOINTS DEL BACKEND (todos listos)

### 3.1 Panel de despiece — `trpc.yields.despiecePanel` (query, sin input)
Devuelve todo para la pantalla de Despiece:
```ts
{
  canales: { canalProductId:number, name:string, type:string, stockPieces:number, avgWeight:number }[]
  recipes: { parentId, childId, childName, pieces, ratio, type, isVariant,
             childAvgWeight, childStockPieces, childStockKg }[]   // nivel-1 (padre=canal)
  subRecipes: same shape                                          // nivel-2 (padre=pieza)
  demandByProduct: Record<productId, { pieces:number, kg:number }> // demanda viva de pedidos
}
```

### 3.2 Plan de despiece sugerido — `trpc.yields.suggestDespiecePlan` (query, sin input)
iAntonella calcula qué despiezar para cubrir los pedidos abiertos:
```ts
{
  hasDemand: boolean
  totalCanals: number
  plan: { canalProductId, canalName, type, quantity,
          generates: { name, pieces, kg }[] }[]
}
```

### 3.3 Ejecutar despiece — `trpc.products.processDisassembly` (mutation)
```ts
input:  { parentProductId:number, quantityToProcess:number(>0 int),
          transformationType:string, entryMode?:boolean }
output: { success:boolean }
// Descuenta el padre (canal o pieza) y suma las piezas hijas al inventario.
```

### 3.4 Convertir a variante — `trpc.products.convertToVariant` (mutation)
```ts
input:  { baseProductId:number, variantProductId:number, pieces:number(>0 int) }
output: { success:boolean }
// Convierte N piezas base a una variante (ej. JAMÓN → JAMÓN S/H, ratio 90%).
```

### 3.5 Recetas (configurador) — router `trpc.inventory.*`
- `recipesList({ parentProductId?, transformationType?, includeInactive? })` → lista de recetas con `parentProduct{id,name,avg_weight}`, `childProduct{id,name,category,avg_weight}`, `transformation_type`, `yield_quantity_pieces`, `yield_weight_ratio`, `is_variant`, `is_active`.
- `recipesUpsert(...)` → crea/actualiza una receta.
- `recipesQuickUpdate({ id, isVariant?, yieldQuantityPieces?, yieldWeightRatio? })` → edición inline (autoguardado).
- `recipesSetActive({ id, active })` → activar/desactivar.
- `recipesImport(...)` / export es client-side.
- `setRefWeight({ productId, kg })` → peso de referencia (canal o pieza).
- `products.classifyOrphan({ productId, action:"purchased"|"duplicate" })` → marcar como proveedor / duplicado.
- `products.delete({ id })` → eliminar producto (⚠️ doble confirmación si es canal/usado).
- `products.create({ name, category, is_parent_product, ... })` → crear producto.

### 3.6 Compra de canales (en pie) — `trpc.yields.*`
- `purchasesByDate({ date })` → renglones del día: `{ id, supplier, canales, kg, precio, americano, nacional, verifCanales, verifKg }[]`
- `savePurchases({ date, rows })` → guarda (reemplaza) la compra del día. Alimenta el stock de canales.
- `purchaseDates()` → fechas con compra.

### 3.7 ⭐ Productos de proveedor — `trpc.yields.*` (NUEVO, para la 2ª card)
- **`supplierProducts()`** (query, sin input) →
  ```ts
  { id, name, stockPieces, stockKg, sellableByWeight, sellableByUnit }[]
  ```
  Lista los productos marcados como proveedor (`category="Compra"`) con su stock.
- **`recordSupplierPurchase({ date, supplier?, items })`** (mutation) →
  ```ts
  items: { productId:number, pieces?:number, kg?:number, pricePerKg?:number }[]
  output: { success:boolean, count:number }
  // Suma al inventario (piezas y/o kg) y registra una transacción COMPRA por item.
  ```
- **`supplierPurchaseHistory({ date })`** (query) →
  ```ts
  { id, name, pieces, kg, notes, createdAt }[]   // compras del día (auditoría)
  ```

### 3.8 CEDIS / Lote / Cierre (contexto, ya tienen pantalla)
- `cedisDay({date})`, `saveCedis({rows})`, `addCedisSupplier({date,supplier})` → verificación canal×canal.
- `cierre({date})` → entró/salió/quedó por producto.
- `calibrateFromDay({date})` → "volcar % a recetas" (recalcula ratios con pesos reales).

---

## 4. DISEÑO DE LA 2ª CARD: Compra de productos de proveedor (lo nuevo)

**Dónde:** en `/admin/purchase`, como una segunda Card debajo de "Compra de canales".

**Título:** "Compra de productos de proveedor"
**Subtítulo:** "Productos que no salen de un canal: se compran directo (manteca, chicharrón, lomo ahumado…)."

**Layout sugerido (tabla editable):**
| Producto | Piezas | Kg | $/kg | Proveedor |
|----------|--------|----|----|-----------|
| (combobox de `supplierProducts`) | input nº (si `sellableByUnit`) | input kg (si `sellableByWeight`) | input $ | input texto |

- **Combobox de producto:** items de `supplierProducts()` (muestra nombre + stock actual "X pz · Y kg").
- **Piezas / Kg:** habilita según `sellableByUnit` / `sellableByWeight` del producto.
- **+ Agregar renglón** y eliminar renglón.
- Selector de **Día** (fecha) arriba; un solo **Proveedor** por captura (o por renglón, a tu criterio).
- **Botón "Registrar compra"** → `recordSupplierPurchase({ date, supplier, items })`. Toast de éxito.
- Debajo (opcional): **historial del día** con `supplierPurchaseHistory({date})` (lista de lo ya comprado hoy).
- **Slot iAntonella** arriba: tono "sugerencia", ej. *"Registra lo que compras directo a proveedores; lo sumo al inventario al instante."*

**Reglas UX:**
- Si un producto no es vendible por unidad, oculta/deshabilita "Piezas"; ídem para "Kg".
- Validar que cada renglón tenga piezas>0 o kg>0 antes de registrar.
- Mostrar stock resultante tras registrar (refetch de `supplierProducts`).

> Para tener productos en la lista, antes hay que marcarlos como proveedor en el Configurador de
> recetas (menú ⋮ del producto → "Marcar como proveedor"), o con `classifyOrphan(purchased)`.

---

## 5. PALETA DE COLORES / TOKENS (usar los de marca)

Acentos por tipo de canal:
`AMERICANO #e11d48` · `NACIONAL_LOMO #16a34a` · `NACIONAL_ESPILOMO #0d9488` · `POLINESIO #ea580c`.
Estado: verde=ok · ámbar=aviso/merma · rojo=alerta · azul=info.
Tipografía: Anton (display/números KPI), Archivo (UI), JetBrains Mono (cifras).

---

## 6. CHECKLIST PARA CLAUDE DESIGN

- [ ] 2ª card "Compra de productos de proveedor" en `/admin/purchase` (sección 4).
- [ ] (Opcional) pulir la pantalla de Despiece `/admin/despiece` con el lenguaje visual nuevo.
- [ ] Mantener el slot de iAntonella arriba de cada pantalla.
- [ ] No cambiar la lógica: solo consumir los endpoints de la sección 3.
- [ ] Inventario dual (pz + kg) visible en todos lados.

> Backend 100% listo y desplegado. Cualquier endpoint extra que necesites, pídelo y lo agrego.
