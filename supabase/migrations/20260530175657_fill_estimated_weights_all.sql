
-- Pesos estimados placeholder para TODOS los productos (se afinan después).
-- Derivados de las recetas: % de rendimiento x peso de referencia / piezas.

-- 1. Canales: peso de referencia de una media (~60 kg)
UPDATE products SET avg_weight_per_piece_kg = 60
WHERE category = 'Canales' AND avg_weight_per_piece_kg IS NULL;

-- 2. Hijos de canal AMERICANO (referencia cerdo completo ~120 kg)
UPDATE products p
SET avg_weight_per_piece_kg = GREATEST(0.05, ROUND(
  (t.yield_weight_ratio * 120) / GREATEST(1, t.yield_quantity_pieces), 2))
FROM product_transformations t
WHERE t.child_product_id = p.id
  AND t.transformation_type = 'AMERICANO'
  AND p.avg_weight_per_piece_kg IS NULL;

-- 3. Hijos de canal NACIONAL (referencia media ~60 kg)
UPDATE products p
SET avg_weight_per_piece_kg = GREATEST(0.05, ROUND(
  (t.yield_weight_ratio * 60) / GREATEST(1, t.yield_quantity_pieces), 2))
FROM product_transformations t
WHERE t.child_product_id = p.id
  AND t.transformation_type IN ('NACIONAL_LOMO','NACIONAL_ESPILOMO')
  AND p.avg_weight_per_piece_kg IS NULL;

-- 4. Hijos nivel 2 (BASE): % del peso del padre
UPDATE products p
SET avg_weight_per_piece_kg = GREATEST(0.05, ROUND(
  (t.yield_weight_ratio * parent.avg_weight_per_piece_kg) / GREATEST(1, t.yield_quantity_pieces), 2))
FROM product_transformations t
JOIN products parent ON parent.id = t.parent_product_id
WHERE t.child_product_id = p.id
  AND t.transformation_type = 'BASE'
  AND p.avg_weight_per_piece_kg IS NULL
  AND parent.avg_weight_per_piece_kg IS NOT NULL;

-- 5. Resto sin receta (piezas finales / compra): default 1.5 kg
UPDATE products SET avg_weight_per_piece_kg = 1.5 WHERE avg_weight_per_piece_kg IS NULL;

SELECT count(*) FILTER (WHERE avg_weight_per_piece_kg IS NOT NULL) as con_peso,
       count(*) FILTER (WHERE avg_weight_per_piece_kg IS NULL) as sin_peso
FROM products;
