-- Migration: 05_insert_product_transformations.sql

-- Asumiendo que los IDs de los productos ya existen en la tabla 'products'.
-- Los 'yield_quantity_pieces' y 'yield_weight_ratio' son valores de ejemplo y deben ser ajustados con datos reales del cliente.

-- Función auxiliar para obtener el ID de un producto por su nombre
-- Esto es un placeholder. En un entorno real, se usarían IDs directos o una función de búsqueda más robusta.
-- Para este script, asumiremos que los IDs se obtendrán previamente o se insertarán en orden.

-- Ejemplo de inserción de productos (si no existen ya)
-- INSERT INTO public.products (name, price_per_kg, unit, active, sort_order, createdAt, updatedAt, is_parent_product, is_sellable_by_unit, is_sellable_by_weight, default_sale_unit)
-- VALUES
-- (
--     'CANAL', 0.0, 'KG', TRUE, 1, NOW(), NOW(), TRUE, FALSE, TRUE, 'KG'
-- ),
-- (
--     'PIERNA', 0.0, 'KG', TRUE, 2, NOW(), NOW(), FALSE, TRUE, TRUE, 'KG'
-- );

-- Se recomienda obtener los IDs de los productos de la tabla 'products' antes de ejecutar estas inserciones.
-- Por simplicidad en este script, usaremos placeholders para los IDs de productos.
-- Reemplazar 'ID_PRODUCTO_X' con el ID real de la tabla 'products'.

-- Recetas de Despiece para CANAL (Estilo Nacional)
INSERT INTO public.product_transformations (parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
VALUES
    -- Asumiendo que 1 Canal produce 2 Piernas, 2 Lomo Nacional, 2 Espaldillas, 1 Cabeza, 2 Mitad de Cuero, etc.
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'PIERNA'), 2, 0.15, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'ESPILOMO'), 2, 0.10, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'ESPALDILLA'), 2, 0.12, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'CABEZA'), 1, 0.05, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'MITAD DE CUERO'), 2, 0.08, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'PATAS'), 4, 0.02, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'MANOS'), 2, 0.01, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'COSTILLAR'), 2, 0.10, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'FILETE'), 1, 0.01, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'GRASA'), 1, 0.05, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'RETAZO'), 1, 0.03, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'RIÑON'), 2, 0.001, 'DESPIECE_NACIONAL', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'DESGRASE'), 1, 0.02, 'DESPIECE_NACIONAL', TRUE);

-- Recetas de Despiece para CANAL (Estilo Americano)
INSERT INTO public.product_transformations (parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
VALUES
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'PIERNA'), 2, 0.15, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'LOMO AMERICANO'), 2, 0.10, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'HUESO AMERICANO'), 2, 0.03, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'ESPALDILLA'), 2, 0.12, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'CABEZA'), 1, 0.05, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'MITAD DE CUERO'), 2, 0.08, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'PATAS'), 4, 0.02, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'MANOS'), 2, 0.01, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'COSTILLAR'), 2, 0.10, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'FILETE'), 1, 0.01, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'GRASA'), 1, 0.05, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'RETAZO'), 1, 0.03, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'RIÑON'), 2, 0.001, 'DESPIECE_AMERICANO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'DESGRASE'), 1, 0.02, 'DESPIECE_AMERICANO', TRUE);

-- Recetas de Despiece para CANAL (Estilo Polinesio)
INSERT INTO public.product_transformations (parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
VALUES
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'PIERNA'), 2, 0.15, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'ESPILOMO'), 2, 0.10, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'CABEZA DE LOMO'), 2, 0.05, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'CORBATA'), 2, 0.02, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'CAÑA'), 2, 0.03, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'ESPALDILLA'), 2, 0.12, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'CABEZA'), 1, 0.05, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'MITAD DE CUERO'), 2, 0.08, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'PATAS'), 4, 0.02, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'MANOS'), 2, 0.01, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'COSTILLAR'), 2, 0.10, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'FILETE'), 1, 0.01, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'GRASA'), 1, 0.05, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'RETAZO'), 1, 0.03, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'RIÑON'), 2, 0.001, 'DESPIECE_POLINESIO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CANAL'), (SELECT id FROM public.products WHERE name = 'DESGRASE'), 1, 0.02, 'DESPIECE_POLINESIO', TRUE);

-- Recetas de Despiece para PIERNA
INSERT INTO public.product_transformations (parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
VALUES
    ((SELECT id FROM public.products WHERE name = 'PIERNA'), (SELECT id FROM public.products WHERE name = 'JAMON'), 1, 0.80, 'DESPIECE_PIERNA', TRUE),
    ((SELECT id FROM public.products WHERE name = 'PIERNA'), (SELECT id FROM public.products WHERE name = 'CODILLO'), 1, 0.10, 'DESPIECE_PIERNA', TRUE);

-- Recetas de Despiece para CABEZA
INSERT INTO public.product_transformations (parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
VALUES
    ((SELECT id FROM public.products WHERE name = 'CABEZA'), (SELECT id FROM public.products WHERE name = 'MASCARA COMPLETA'), 1, 0.40, 'DESPIECE_CABEZA', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CABEZA'), (SELECT id FROM public.products WHERE name = 'PAPADA CORTA'), 1, 0.20, 'DESPIECE_CABEZA', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CABEZA'), (SELECT id FROM public.products WHERE name = 'CACHETE'), 2, 0.10, 'DESPIECE_CABEZA', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CABEZA'), (SELECT id FROM public.products WHERE name = 'LENGUA'), 1, 0.05, 'DESPIECE_CABEZA', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CABEZA'), (SELECT id FROM public.products WHERE name = 'OREJAS'), 2, 0.02, 'DESPIECE_CABEZA', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CABEZA'), (SELECT id FROM public.products WHERE name = 'TROMPA'), 1, 0.01, 'DESPIECE_CABEZA', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CABEZA'), (SELECT id FROM public.products WHERE name = 'SESOS'), 1, 0.01, 'DESPIECE_CABEZA', TRUE),
    ((SELECT id FROM public.products WHERE name = 'CABEZA'), (SELECT id FROM public.products WHERE name = 'RECORTE DE MASCARA'), 1, 0.05, 'DESPIECE_CABEZA', TRUE);

-- Recetas de Despiece para CUERO (Mitad de Cuero)
INSERT INTO public.product_transformations (parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
VALUES
    ((SELECT id FROM public.products WHERE name = 'MITAD DE CUERO'), (SELECT id FROM public.products WHERE name = 'CUERO CON PANZA'), 1, 0.50, 'DESPIECE_CUERO', TRUE),
    ((SELECT id FROM public.products WHERE name = 'MITAD DE CUERO'), (SELECT id FROM public.products WHERE name = 'BARRIGA SIN CUERO'), 1, 0.40, 'DESPIECE_CUERO', TRUE);

-- Recetas de Despiece para ESPALDILLA
INSERT INTO public.product_transformations (parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
VALUES
    ((SELECT id FROM public.products WHERE name = 'ESPALDILLA'), (SELECT id FROM public.products WHERE name = 'PULPA DE ESPALDILLA'), 1, 0.80, 'DESPIECE_ESPALDILLA', TRUE),
    ((SELECT id FROM public.products WHERE name = 'ESPALDILLA'), (SELECT id FROM public.products WHERE name = 'ESPALDILLA CON GRASA Y PAPADA'), 1, 0.90, 'DESPIECE_ESPALDILLA', TRUE);

-- Recetas de Despiece para COSTILLAR
INSERT INTO public.product_transformations (parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
VALUES
    ((SELECT id FROM public.products WHERE name = 'COSTILLAR'), (SELECT id FROM public.products WHERE name = 'PECHO'), 1, 0.50, 'DESPIECE_COSTILLAR', TRUE),
    ((SELECT id FROM public.products WHERE name = 'COSTILLAR'), (SELECT id FROM public.products WHERE name = 'LOMO'), 1, 0.40, 'DESPIECE_COSTILLAR', TRUE);

-- Productos de procesamiento/valor agregado que no son despiece directo de una pieza mayor en este contexto inicial
-- Estos productos podrían tener sus propias recetas de transformación o ser creados directamente.
-- Por ejemplo, la MANTECA podría ser un subproducto de GRASA.
-- INSERT INTO public.product_transformations (parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
-- VALUES
--     ((SELECT id FROM public.products WHERE name = 'GRASA'), (SELECT id FROM public.products WHERE name = 'MANTECA'), 1, 0.90, 'PROCESADO', TRUE);

-- Nota: Los IDs de los productos ('CANAL', 'PIERNA', etc.) deben existir en la tabla 'public.products' antes de ejecutar este script.
-- Se asume que los 'yield_quantity_pieces' y 'yield_weight_ratio' serán validados y ajustados por el cliente. 
-- El 'yield_weight_ratio' es un porcentaje del peso del padre que se convierte en el hijo. 
-- Para un cálculo preciso, se necesitaría el peso promedio del producto padre. 
-- Por ahora, se usan valores de ejemplo que deberán ser ajustados. 
