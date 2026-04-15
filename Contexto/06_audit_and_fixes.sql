-- ====================================================================
-- AUDITORÍA Y FIXES - Duplicados, Recetas Faltantes, Integridad
-- ====================================================================
-- Ejecutar en: Supabase SQL Editor
-- Fecha: 14 Abril 2026
-- Objetivo: Limpiar datos, eliminar duplicados, crear recetas faltantes

-- ====================================================================
-- PARTE 1: AUDITORÍA - Ver el estado actual
-- ====================================================================

-- 1.1 Productos duplicados
SELECT
  name,
  COUNT(*) as cantidad,
  array_agg(id ORDER BY id) as ids
FROM products
WHERE is_parent_product = true
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;

-- 1.2 Todos los productos PIERNA
SELECT
  id,
  name,
  is_parent_product,
  parent_product_id,
  stock_pieces,
  stock_kg
FROM products
WHERE name ILIKE '%PIERNA%'
ORDER BY id;

-- 1.3 Recuento de transformaciones por padre
SELECT
  p.id,
  p.name,
  COUNT(DISTINCT pt.id) as num_transformaciones,
  COUNT(DISTINCT pt.transformation_type) as num_estilos,
  array_agg(DISTINCT pt.transformation_type ORDER BY pt.transformation_type) as estilos
FROM products p
LEFT JOIN product_transformations pt ON pt.parent_product_id = p.id AND pt.is_active = true
WHERE p.is_parent_product = true
GROUP BY p.id, p.name
ORDER BY p.name;

-- 1.4 Detalle de transformaciones de CANAL
SELECT
  pt.transformation_type,
  COUNT(*) as cantidad_hijos,
  array_agg(DISTINCT pc.name ORDER BY pc.name) as productos_hijos
FROM product_transformations pt
JOIN products p ON p.id = pt.parent_product_id AND p.name ILIKE '%CANAL%'
JOIN products pc ON pc.id = pt.child_product_id
WHERE pt.is_active = true
GROUP BY pt.transformation_type
ORDER BY pt.transformation_type;

-- 1.5 Detalle de transformaciones de PIERNA
SELECT
  pt.transformation_type,
  COUNT(*) as cantidad_hijos,
  array_agg(DISTINCT pc.name ORDER BY pc.name) as productos_hijos
FROM product_transformations pt
JOIN products p ON p.id = pt.parent_product_id AND p.name ILIKE '%PIERNA%'
JOIN products pc ON pc.id = pt.child_product_id
WHERE pt.is_active = true
GROUP BY pt.transformation_type
ORDER BY pt.transformation_type;

-- 1.6 Piezas padre que FALTAN recetas
SELECT
  p.id,
  p.name,
  COALESCE(COUNT(DISTINCT pt.id), 0) as num_recetas
FROM products p
LEFT JOIN product_transformations pt ON pt.parent_product_id = p.id AND pt.is_active = true
WHERE p.is_parent_product = true
AND p.parent_product_id IS NOT NULL -- Solo piezas secundarias
GROUP BY p.id, p.name
HAVING COALESCE(COUNT(DISTINCT pt.id), 0) = 0
ORDER BY p.name;

-- ====================================================================
-- PARTE 2: CONSOLIDACIÓN DE DUPLICADOS
-- ====================================================================
-- IMPORTANTE: Si PIERNA está duplicada, consolidar manteniedo el ID más bajo

-- 2.1 Si hay duplicados, actualizar referencias (ejemplo PIERNA):
-- Primero, identificar cuál mantener:
-- SELECT id FROM products WHERE name = 'PIERNA' ORDER BY id LIMIT 1;
-- Luego, actualizar todas las referencias al viejo ID al nuevo ID:
/*
BEGIN TRANSACTION;
UPDATE product_transformations
SET child_product_id = (SELECT MIN(id) FROM products WHERE name = 'PIERNA')
WHERE child_product_id IN (
  SELECT id FROM products WHERE name = 'PIERNA'
);
UPDATE product_transformations
SET parent_product_id = (SELECT MIN(id) FROM products WHERE name = 'PIERNA')
WHERE parent_product_id IN (
  SELECT id FROM products WHERE name = 'PIERNA'
);
-- Luego eliminar duplicados (mantener MIN(id))
DELETE FROM products
WHERE name = 'PIERNA' AND id NOT IN (
  SELECT MIN(id) FROM products WHERE name = 'PIERNA' GROUP BY name
);
COMMIT;
*/

-- ====================================================================
-- PARTE 3: CREAR RECETAS FALTANTES
-- ====================================================================

-- 3.1 Crear recetas para ESPALDILLA (si no existen)
INSERT INTO public.product_transformations
(parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
SELECT
  (SELECT id FROM public.products WHERE name = 'ESPALDILLA' AND is_parent_product = true LIMIT 1) as parent_id,
  pc.id as child_id,
  pc.yield_qty,
  pc.yield_ratio,
  'DESPIECE_ESPALDILLA' as transformation_type,
  TRUE as is_active
FROM (
  VALUES
    ('PULPA DE ESPALDILLA', 1, 0.80),
    ('ESPALDILLA CON GRASA Y PAPADA', 1, 0.15)
) AS pc(name, yield_qty, yield_ratio)
JOIN public.products p ON p.name = pc.name
WHERE
  (SELECT id FROM public.products WHERE name = 'ESPALDILLA' AND is_parent_product = true LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.product_transformations pt
    WHERE pt.parent_product_id = (SELECT id FROM public.products WHERE name = 'ESPALDILLA' AND is_parent_product = true LIMIT 1)
    AND pt.child_product_id = p.id
    AND pt.transformation_type = 'DESPIECE_ESPALDILLA'
  )
ON CONFLICT DO NOTHING;

-- 3.2 Crear recetas para LOMO (si no existen - Estilo Nacional)
INSERT INTO public.product_transformations
(parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
SELECT
  (SELECT id FROM public.products WHERE name = 'LOMO' AND is_parent_product = true LIMIT 1) as parent_id,
  pc.id as child_id,
  pc.yield_qty,
  pc.yield_ratio,
  'DESPIECE_LOMO' as transformation_type,
  TRUE as is_active
FROM (
  VALUES
    ('LOMO SIN CABEZA', 1, 0.60),
    ('CABEZA DE LOMO', 1, 0.30),
    ('CORBATA', 1, 0.10)
) AS pc(name, yield_qty, yield_ratio)
JOIN public.products p ON p.name = pc.name
WHERE
  (SELECT id FROM public.products WHERE name = 'LOMO' AND is_parent_product = true LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.product_transformations pt
    WHERE pt.parent_product_id = (SELECT id FROM public.products WHERE name = 'LOMO' AND is_parent_product = true LIMIT 1)
    AND pt.child_product_id = p.id
    AND pt.transformation_type = 'DESPIECE_LOMO'
  )
ON CONFLICT DO NOTHING;

-- ====================================================================
-- PARTE 4: VALIDACIÓN POST-FIXES
-- ====================================================================

-- 4.1 Verificar que no hay más duplicados
SELECT
  name,
  COUNT(*) as cantidad
FROM products
WHERE is_parent_product = true
GROUP BY name
HAVING COUNT(*) > 1;

-- 4.2 Verificar que piezas padre tienden a tener recetas
SELECT
  p.id,
  p.name,
  COALESCE(COUNT(DISTINCT pt.id), 0) as num_recetas
FROM products p
LEFT JOIN product_transformations pt ON pt.parent_product_id = p.id AND pt.is_active = true
WHERE p.is_parent_product = true
GROUP BY p.id, p.name
ORDER BY p.name;

-- 4.3 Verificar integridad: child_product_id debe existir
SELECT
  COUNT(*) as broken_references
FROM product_transformations pt
WHERE pt.is_active = true
AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pt.child_product_id)
   OR NOT EXISTS (SELECT 1 FROM products p WHERE p.id = pt.parent_product_id);

-- ====================================================================
-- PART 5: RESET DATOS DE PRUEBA (opcional)
-- ====================================================================
-- Descomentar si necesitas resetear stock para pruebas nuevas:
/*
UPDATE products
SET stock_pieces = 0, stock_kg = '0.000'
WHERE is_parent_product = true;
*/

-- ====================================================================
