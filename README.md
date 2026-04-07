# Cárnicos Gustavo - Gestión de Inventario Dual y Despiece

Este es el sistema de gestión de Punto de Venta (POS) e inventario personalizado para **Cárnicos Gustavo**, basado en el núcleo de FinOpenPOS.

## Características Principales para Cárnicos Gustavo

### 🥩 Módulo de Despiece (Disassembly)
- **Transformación de Productos**: Procesa el despiece de productos padres (ej. Canal de Cerdo) en múltiples productos hijos (Pierna, Chuleta, Costilla, etc.).
- **12 Estilos de Corte**: Implementación de despieces específicos (Nacional, Americano, Polinesio, etc.).
- **Rendimiento Dinámico**: Calcula automáticamente las piezas y kilogramos esperados basados en el peso promedio del producto padre.

### ⚖️ Inventario Dual y Estación de Pesaje
- **Control por Piezas y KG**: Seguimiento preciso de existencias tanto en unidades físicas como en peso decimal.
- **Estación de Báscula**: Interfaz dedicada para operarios de báscula donde se registra el peso real de cada ítem de un pedido.
- **Flujo de Pesaje Obligatorio**: Los pedidos creados en el POS que contienen productos pesables son marcados automáticamente para pesaje antes de permitir el cobro.

### 🛒 Punto de Venta (POS) Mejorado
- **Soporte Dual**: El carrito de compras permite agregar productos por piezas y muestra el estado del pesaje en tiempo real.
- **Validación de Stock**: Verifica existencias tanto en piezas como en kilogramos antes de permitir la venta.

---

## Estructura del Proyecto

- `apps/web`: Aplicación principal Next.js 16 con los módulos de administración y POS.
- `packages/db`: Esquema de base de datos sincronizado con Supabase para soporte `numeric`.
- `packages/api`: Routers de tRPC con la lógica de negocio para despiece y pesaje.

---

## Configuración de Despliegue

### Variables de Entorno (.env)
Asegúrate de configurar las siguientes variables en Vercel o tu entorno local:

```env
DATABASE_URL=postgres://... (URL de Supabase con soporte numeric)
BETTER_AUTH_SECRET=tu_secreto_aqui
BETTER_AUTH_URL=https://tu-app.vercel.app
NEXT_PUBLIC_LOCALE=es
```

### Nota sobre la Landing Page
Por defecto, la aplicación redirige a la landing page de FinOpenPOS si la variable `BASE_URL` está configurada. Para ir directamente al dashboard de Cárnicos Gustavo, accede a `/admin` o asegúrate de que `BASE_URL` no esté definida para que la raíz redirija a `/login`.

---

## Créditos
Desarrollado sobre la base de [FinOpenPOS](https://github.com/JoaoHenriqueBarbosa/FinOpenPOS).
Personalizado para **Cárnicos Gustavo**.
