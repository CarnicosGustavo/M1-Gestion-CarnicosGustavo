-- ============================================================
-- REBUILD 03: Recetas de despiece (product_transformations)
-- Pesos/ratios PROVISIONALES (se afinan al pesar un cerdo real).
-- Conteos de piezas según spec del cliente.
-- Tipos: AMERICANO, NACIONAL_LOMO, NACIONAL_ESPILOMO (nivel 1), BASE (nivel 2)
-- ============================================================
WITH p AS (
  SELECT id, name FROM products
  WHERE user_uid = 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT'
),
recipe(parent, child, pieces, ratio, ttype) AS (
  VALUES
  -- ── NIVEL 1: CANAL AMERICANO (cerdo completo) ──
  ('CANAL AMERICANO','PIERNA',          2, 0.130, 'AMERICANO'),
  ('CANAL AMERICANO','LOMO AMERICANO',  2, 0.100, 'AMERICANO'),
  ('CANAL AMERICANO','HUESO AMERICANO', 2, 0.070, 'AMERICANO'),
  ('CANAL AMERICANO','ESPALDILLA',      2, 0.110, 'AMERICANO'),
  ('CANAL AMERICANO','CABEZA',          1, 0.050, 'AMERICANO'),
  ('CANAL AMERICANO','MITAD DE CUERO',  2, 0.060, 'AMERICANO'),
  ('CANAL AMERICANO','PATAS',           2, 0.015, 'AMERICANO'),
  ('CANAL AMERICANO','MANOS',           2, 0.015, 'AMERICANO'),
  ('CANAL AMERICANO','COSTILLAR',       2, 0.080, 'AMERICANO'),
  ('CANAL AMERICANO','FILETE',          1, 0.004, 'AMERICANO'),
  ('CANAL AMERICANO','GRASA',           1, 0.080, 'AMERICANO'),
  ('CANAL AMERICANO','RETAZO',          1, 0.040, 'AMERICANO'),
  ('CANAL AMERICANO','RINON',           2, 0.012, 'AMERICANO'),
  ('CANAL AMERICANO','DESGRASE',        1, 0.050, 'AMERICANO'),

  -- ── NIVEL 1: CANAL NACIONAL LADO LOMO ──
  ('CANAL NACIONAL LADO LOMO','PIERNA',         1, 0.130, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','LOMO NACIONAL',  1, 0.150, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','ESPALDILLA',     1, 0.110, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','CABEZA',         1, 0.090, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','MITAD DE CUERO', 1, 0.070, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','PATAS',          1, 0.015, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','MANOS',          1, 0.015, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','COSTILLAR',      1, 0.080, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','FILETE',         1, 0.008, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','GRASA',          1, 0.080, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','RETAZO',         1, 0.040, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','RINON',          2, 0.012, 'NACIONAL_LOMO'),
  ('CANAL NACIONAL LADO LOMO','DESGRASE',       1, 0.050, 'NACIONAL_LOMO'),

  -- ── NIVEL 1: CANAL NACIONAL LADO ESPILOMO ──
  ('CANAL NACIONAL LADO ESPILOMO','PIERNA',         1, 0.130, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','ESPILOMO',       1, 0.150, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','ESPALDILLA',     1, 0.110, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','CABEZA',         1, 0.090, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','MITAD DE CUERO', 1, 0.070, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','PATAS',          1, 0.015, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','MANOS',          1, 0.015, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','COSTILLAR',      1, 0.080, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','FILETE',         1, 0.008, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','GRASA',          1, 0.080, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','RETAZO',         1, 0.040, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','RINON',          2, 0.012, 'NACIONAL_ESPILOMO'),
  ('CANAL NACIONAL LADO ESPILOMO','DESGRASE',       1, 0.050, 'NACIONAL_ESPILOMO'),

  -- ── NIVEL 2: despiece de intermedios ──
  ('PIERNA','JAMON',                 1, 0.800, 'BASE'),
  ('PIERNA','CODILLO',               1, 0.100, 'BASE'),
  ('CABEZA','MASCARA COMPLETA',      1, 0.250, 'BASE'),
  ('CABEZA','PAPADA CORTA',          1, 0.150, 'BASE'),
  ('CABEZA','CACHETE',               2, 0.100, 'BASE'),
  ('CABEZA','LENGUA',                1, 0.030, 'BASE'),
  ('CABEZA','OREJAS',                2, 0.030, 'BASE'),
  ('CABEZA','TROMPA',                1, 0.030, 'BASE'),
  ('CABEZA','SESOS',                 1, 0.020, 'BASE'),
  ('CABEZA','RECORTE DE MASCARA',    1, 0.100, 'BASE'),
  ('MITAD DE CUERO','CUERO CON PANZA',   1, 0.500, 'BASE'),
  ('MITAD DE CUERO','BARRIGA SIN CUERO', 1, 0.400, 'BASE'),
  ('ESPALDILLA','PULPA DE ESPALDILLA',   1, 0.800, 'BASE'),
  ('COSTILLAR','PECHO',              1, 0.500, 'BASE'),
  ('COSTILLAR','LOMO',               1, 0.400, 'BASE')
)
INSERT INTO product_transformations
  (parent_product_id, child_product_id, yield_quantity_pieces, yield_weight_ratio, transformation_type, is_active)
SELECT pp.id, pc.id, r.pieces, r.ratio, r.ttype, true
FROM recipe r
JOIN p pp ON pp.name = r.parent
JOIN p pc ON pc.name = r.child;
