# Mapa de Despiece Porcino para Cárnicos Gustavo

Este documento detalla la jerarquía de productos porcinos y los diferentes estilos de despiece (Nacional, Americano, Polinesio) que se aplicarán en el sistema de inventario de Cárnicos Gustavo. Esta información es fundamental para configurar las "Recetas de Desensamble" en la tabla `product_transformations` y la lógica de `processDisassembly`.

## 1. Insumo Principal: La Canal

El punto de partida es la **Canal** (cerdo completo) o **Media Canal** (medio cerdo). A partir de aquí, se aplican los estilos de corte.

## 2. Estilos de Despiece

Los estilos de despiece determinan la forma en que se obtienen los cortes primarios y, en particular, cómo se maneja el espinazo.

### 2.1. Estilo Nacional

*   **Característica Principal:** Se respeta el **Espinazo completo**. Este estilo es versátil y puede servir como base para el corte Polinesio.

### 2.2. Estilo Americano

*   **Característica Principal:** El **Espinazo se corta en 2 partes a la mitad**.

### 2.3. Estilo Polinesio

*   **Característica Principal:** Similar al Nacional en algunos aspectos, pero con especificaciones propias para ciertos cortes.

## 3. Jerarquía de Productos y Derivados por Estilo de Corte

A continuación, se detalla la derivación de productos, organizados por cortes primarios y sus subproductos. Se indica la relación padre-hijo y las consideraciones específicas para cada estilo.

### 3.1. Pierna (Corte Primario)

*   **Padre:** Canal / Media Canal
*   **Hijos / Derivados:**
    *   **Pierna** (completa)
    *   **Jamón:** Pierna sin hueso y sin codillo (chamorro).
        *   **Variantes de Jamón:** Jamón sin hueso, Jamón con grasa, Jamón con hueso y sin grasa.
    *   **Codillo (Chamorro):** Parte inferior de la pierna.

### 3.2. Cuero (Corte Primario)

*   **Padre:** Canal / Media Canal
*   **Consideraciones:** De un cerdo salen dos mitades de cuero.
*   **Hijos / Derivados:**
    *   **Mitad de Cuero**
    *   **Cuero con Panza** (conocido como **Huarache**)
    *   **Barriga sin Cuero**
    *   **Barriga con Cuero**
    *   **Cuero sin Panza**
    *   **Cuero Recortado**
    *   **Recorte de Cuadro**

### 3.3. Lomo (Corte Primario)

La derivación del lomo varía significativamente según el estilo de corte.

#### 3.3.1. Lomo Estilo Nacional

*   **Padre:** Canal / Media Canal
*   **Hijos / Derivados:**
    *   **Espilomo**
    *   **Lomo sin Cabeza**
    *   **Cabeza de Lomo**
    *   **Corbata**
    *   **Caña de Lomo**
    *   **Espinazo** (completo)

#### 3.3.2. Lomo Estilo Americano

*   **Padre:** Canal / Media Canal
*   **Hijos / Derivados:**
    *   **Lomo Americano**
    *   **Cabeza de Lomo con Hueso**
    *   **Cabeza de Lomo**
    *   **Hueso Americano** (resultado del corte del espinazo en dos)

#### 3.3.3. Lomo Estilo Polinesio

*   **Padre:** Canal / Media Canal
*   **Hijos / Derivados:**
    *   **Espilomo**
    *   **Cabeza de Lomo**
    *   **Corbata**
    *   **Caña**

### 3.4. Espaldilla (Corte Primario)

*   **Padre:** Canal / Media Canal
*   **Hijos / Derivados:**
    *   **Espaldilla** (completa)
    *   **Pulpa de Espaldilla**
    *   **Espaldilla con Grasa y Papada**
    *   **Pulpa de Espaldilla con Grasa**

### 3.5. Costillas (Corte Primario)

*   **Padre:** Canal / Media Canal
*   **Hijos / Derivados:**
    *   **Pecho**
    *   **Lomo** (parte de las costillas)

### 3.6. Cabeza (Corte Primario)

*   **Padre:** Canal / Media Canal
*   **Hijos / Derivados:**
    *   **Máscara Rebajada**
    *   **Máscara Completa**
    *   **Papada Corta** (o Papada de Cabeza)
    *   **Cachete**
    *   **Lengua**
    *   **Orejas**
    *   **Trompa**
    *   **Sesos**
    *   **Recorte de Máscara**

### 3.7. Piezas Sueltas o Independientes (Subproductos / Derivados)

Estas piezas pueden ser subproductos de varios cortes o se consideran por separado.

*   **Papada** (adicional a la de la cabeza)
*   **Filete**
*   **Patas**
*   **Manos**
*   **Retazo**
*   **Desgrase**
*   **Grasa**
*   **Codillo (Chamorro)** (adicional al de la pierna)
*   **Hueso Americano** (específico del corte Americano)
*   **Rabo Carnudo**
*   **Riñón**

## 4. Productos de Procesamiento / Valor Agregado

Estos productos son el resultado de procesos adicionales o recortes.

*   **Ahumada**
*   **Buche**
*   **Corbatas**
*   **Manteca**
*   **Nana**
*   **Prensa Molida**
*   **Prensa Natural**
*   **Rabos Pelones**
*   **Sancocho**
*   **Tripas**
*   **Trompas** (adicional a la de la cabeza)
*   **Tocino**
*   **Tocino Azul**

## 5. Próximos Pasos

Con este mapa detallado, el siguiente paso es:

1.  **Asignar IDs de Productos:** Mapear cada uno de estos nombres a un `product_id` único en la tabla `public.products`.
2.  **Definir Rendimientos:** Trabajar con el cliente para establecer los `yield_quantity_pieces` y `yield_weight_ratio` para cada transformación.
3.  **Crear Scripts SQL:** Generar los `INSERT` statements para la tabla `public.product_transformations` que reflejen estas recetas de desensamble, incluyendo el `transformation_type` para cada estilo de corte.
4.  **Ajustar Lógica de `processDisassembly`:** Modificar el procedimiento tRPC para que acepte el `transformation_type` (estilo de corte) como parámetro y aplique la receta correspondiente.
