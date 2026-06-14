# 📊 Resumen ejecutivo — Cárnicos Gustavo v2

**Estado:** 🟢 **DISEÑO COMPLETADO** — Listo para implementación

---

## ¿Qué está hecho?

### ✅ **Prototipo navegable** (100%)
- **App shell:** rail de 18 módulos, topbar con logo, control de tema dinámico
- **20+ pantallas funcionales** con lógica de estado (20 KB de datos de ejemplo)
- **iAntonella embebido:** chat, launcher, sugerencias contextuales
- **Sistema de Diseño:** catálogo completo de componentes (botones, campos, selectores, estados)

### ✅ **Especificación funcional** (100%)
- **GUIA_UI_UX_PLATAFORMA.md:** cada pantalla, propósito, datos (qué endpoint tRPC), cada botón y acción
- **Recetas (Configurador):** flujo completo con **ProductSelector, ramificación, sub-despiece, variantes**
- **Paleta semántica:** qué color significa qué (verde=OK, rojo=saldo/cancelado, amarillo=pendiente, etc.)

### ✅ **Componentes de iAntonella** (100%)
- **AiField** — campo que iA pre-rellena (pesos estimados desde %)
- **AiSuggestBar** — banner de acción propuesta (ej: "estimar pesos")
- **AiConfirmCard** — confirmación de acciones protegidas (antes de despiezar, borrar)
- **AiLearned** — píldora de aprendizaje (mostrar qué aprendió)

### ✅ **Verificado**
- ProductSelector (Combobox) en 3 lugares (despiece, estilo, card)
- Card de editar producto con ramificación
- Recetas: 0 nombres truncados, paleta con badges de uso
- 20+ pantallas sin errores de consola
- Tema claro/oscuro + 2 paletas funcionando

---

## ¿Qué falta? (para prod)

| Área | Qué | Tiempo | Dependencia |
|------|-----|--------|-------------|
| **Backend** | tRPC real (13 routers) | 8-12 semanas | Base de datos |
| **Autenticación** | NextAuth + Supabase | 1-2 semanas | Creds de proveedor |
| **iAntonella vivo** | Claude API + stream | 2-3 semanas | ANTHROPIC_API_KEY |
| **Pesaje en tiempo real** | Websocket a báscula física | 2-4 semanas | Dispositivo |
| **Facturas NFC-e** | Integración fiscal | 3-4 semanas | Proveedor fiscal |
| **PDF/Tickets** | Generación e impresión | 1-2 semanas | puppeteer/reportlab |

**La UI (lo que hice) = ~15% de la implementación total.**

---

## 🎯 Roadmap recomendado

### **Sprint 1: Infraestructura (semanas 1-2)**
- [ ] Tokens de marca en globals.css (4 temas)
- [ ] Rail + TopBar + Layout shell
- [ ] Persistencia de tema
- [ ] **Resultado:** navegación funcional

### **Sprint 2-3: Núcleo operativo (semanas 3-6)**
- [ ] **POS** (pantalla táctil, 60% de la actividad diaria)
- [ ] **Báscula** (diferencial del negocio)
- [ ] **Despiece** (donde se crean piezas)
- [ ] **Pedidos** (lista + detalle)

### **Sprint 4: Complejidad media (semanas 7-9)**
- [ ] **Recetas** (ProductSelector ya está, solo adaptar a shadcn/ui real)
- [ ] **Cobranza** (gestión de crédito)
- [ ] **Clientes** (CRUD)

### **Sprint 5: iAntonella + Cierre (semanas 10-12)**
- [ ] Integración Claude API
- [ ] AiField + AiSuggestBar en módulos clave
- [ ] Validación end-to-end

---

## 📁 Dónde empieza Claude Code

**Archivo:** `prototipo/HANDOFF_CLAUDE_CODE.md`

**El resumen:**
1. Lee **GUIA_UI_UX_PLATAFORMA.md** (mapa de cada pantalla)
2. Abre **Carnicos Gustavo - Sistema + iAntonella.html** en navegador (entiende el flujo)
3. Empieza por **POS** (alta ROI, UI simple)
4. Copia el patrón (componentes, estado, callbacks) pero usa **shadcn/ui + tRPC reales**
5. Para **Recetas**, adapta `cg-recetas.jsx` (ProductSelector + ramificación ya están)
6. Para **iAntonella**, integra `cg-ai-kit.jsx` + API key en `packages/api/.env`

---

## 💡 Decisiones de diseño (confirmadas)

✅ **Rail lateral sticky** (iconos, no texto) — permite labels en tooltips, escalable a móvil  
✅ **Tema dinámico** (4 variantes) — cálido/neutro × claro/oscuro  
✅ **iAntonella siempre "con OK del usuario"** — nunca hace nada sin confirmación  
✅ **ProductSelector (Combobox)** — para agregar piezas sin escribir nombres  
✅ **Ramificación desde Card** — crear sub-piezas sin salir del modal  
✅ **Paleta semántica de colores** — consistente en toda la app (13 colores base)  

---

## 🚀 Próximos pasos (del usuario)

1. **Comparte el handoff** con Claude Code
2. **Define el stack backend** (Supabase, AWS RDS, etc.)
3. **Obtén ANTHROPIC_API_KEY** si quieres iAntonella en vivo
4. **Arrange un dev** para 8-12 semanas a tiempo completo

---

## 📞 Preguntas frecuentes

**P: ¿Puedo cambiar los colores/fuentes?**  
R: Sí. Están en `cg-data.jsx` (CG.color, CG.font, CG.palettes) y se inyectan en CSS.

**P: ¿El prototipo puede convertirse en prod?**  
R: No — es referencia visual. Necesita:
- Datos reales desde tRPC (no hardcoded)
- Autenticación (NextAuth)
- Base de datos (Supabase/RDS)
- Manejo de errores robusto
- Tests

**P: ¿Puedo usar Figma en lugar de esto?**  
R: Este es **mejor que Figma**: navegable, interactivo, copy-paste ready, con datos y estado.

**P: ¿Cuánto cuesta mantener iAntonella?**  
R: Claude API = ~$0.01 por query promedio. A 100 queries/día = ~$30/mes.

---

**Preparado por:** Claude Design  
**Verificado:** ProductSelector, Card ramificación, 20+ pantallas, Sistema de Diseño  
**Formato:** HTML + React/JSX (ready para adaptación a Next.js real)  
**Siguiente:** Handoff a Claude Code o dev team
