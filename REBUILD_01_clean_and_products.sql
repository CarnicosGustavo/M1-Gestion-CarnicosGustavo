-- ============================================================
-- REBUILD 01: Limpieza total + catálogo canónico de productos
-- Cuenta admin única: test@carnicosgustavo.com
--   user_uid = YtQlCieutj4iryBDnWf2xjkJkr39nsZT
-- Backup previo: backups/backup_products_recipes_2026-05-29.json
-- ============================================================

-- 0) Columna nueva: peso promedio por pieza (para estimar kg antes de pesar)
ALTER TABLE products ADD COLUMN IF NOT EXISTS avg_weight_per_piece_kg numeric(10,3);

-- 1) LIMPIEZA: borrar datos transaccionales de prueba + productos + recetas
--    Se conservan: customers, web_orders, price_lists, payment_methods, user
DELETE FROM transactions;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM inventory_transactions;
DELETE FROM product_transformations;
DELETE FROM price_list_items;
DELETE FROM products;

-- Reiniciar el contador de IDs de productos para un catálogo limpio
ALTER SEQUENCE products_id_seq RESTART WITH 1;

-- 2) CATÁLOGO CANÓNICO (todo bajo la cuenta admin única)
--    Columnas: name, category, is_parent_product, is_sellable_by_weight,
--              is_sellable_by_unit, avg_weight_per_piece_kg
--    Pesos promedio: derivados del PDF de rastro (aprox., se afinan al pesar).
INSERT INTO products
  (name, category, is_parent_product, is_sellable_by_weight, is_sellable_by_unit,
   avg_weight_per_piece_kg, default_sale_unit, price_per_kg, user_uid, status, active)
VALUES
-- ── CANALES (padres nivel 1) ──
('CANAL AMERICANO',               'Canales', true,  true,  true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CANAL NACIONAL LADO LOMO',      'Canales', true,  true,  true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CANAL NACIONAL LADO ESPILOMO',  'Canales', true,  true,  true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),

-- ── INTERMEDIOS (padres nivel 2, también vendibles) ──
('PIERNA',                'Jamones', true,  true,  true,  7.250, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CABEZA',                'Otros',   true,  true,  true,  5.220, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('MITAD DE CUERO',        'Cueros',  true,  true,  true,  7.500, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('ESPALDILLA',            'Otros',   true,  true,  true,  6.290, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('COSTILLAR',             'Huesos',  true,  true,  true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),

-- ── LOMOS ──
('LOMO',                  'Lomos', false, true,  true,  8.420, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('LOMO AMERICANO',        'Lomos', false, true,  true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('LOMO NACIONAL',         'Lomos', false, true,  true,  8.420, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('LOMO COMPLETO AMERICANO','Lomos',false, true,  true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('LOMO COMPLETO N/P',     'Lomos', false, true,  true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('LOMO USA',              'Lomos', false, true,  true,  3.400, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('LOMO S/CABEZA',         'Lomos', false, true,  true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('LOMO PINTO',            'Lomos', false, true,  true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('C/LOMO',                'Lomos', false, true,  true, 10.950, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('C/LOMO C/H',            'Lomos', false, true,  true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('ESPILOMO',              'Lomos', false, true,  true, 10.620, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('FILETE',                'Lomos', false, true,  true,  0.450, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CABEZA DE LOMO',        'Lomos', false, true,  true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),

-- ── JAMONES ──
('JAMON',                 'Jamones', false, true, true, 11.040, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('JAMON C/G',             'Jamones', false, true, true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('JAMON PINTO',           'Jamones', false, true, true,  NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('JAMON S/H',             'Jamones', false, true, true,  9.500, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),

-- ── CUEROS ──
('CUERO',                 'Cueros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CUERO RECORTE',         'Cueros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CUERO CUADRADO',        'Cueros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CUERO CON PANZA',       'Cueros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CUEROS C/PANZA',        'Cueros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CUEROS S/PANZA',        'Cueros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),

-- ── PULPAS ──
('PULPA',                 'Pulpas', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('PULPA C/G',             'Pulpas', false, true, true, 6.410, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('PULPA DE ESPALDILLA',   'Pulpas', false, true, true, 5.530, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('PULPA DE JAMON',        'Pulpas', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('RETAZO',                'Pulpas', false, true, true, 9.500, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),

-- ── VISCERAS / MENUDENCIAS ──
('BUCHE',                 'Visceras', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('LENGUA',                'Visceras', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('NANA',                  'Visceras', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('RINON',                 'Visceras', false, true, true, 1.400, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('SESOS',                 'Visceras', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('TRIPAS',                'Visceras', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),

-- ── HUESOS / EXTREMIDADES ──
('HUESO AMERICANO',       'Huesos', false, true, true, 3.890, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('HUESO PELON',           'Huesos', false, true, true, 8.760, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('ESPINAZO',              'Huesos', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CODILLO',               'Huesos', false, true, true, 5.200, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CANA',                  'Huesos', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('MANOS',                 'Huesos', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('PATAS',                 'Huesos', false, true, true, 7.530, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),

-- ── OTROS / VARIOS ──
('CANAL',                 'Canales', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('AHUMADA',               'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('BARRIGA',               'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('BARRIGA C/C',           'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('BARRIGA SIN CUERO',     'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CACHETE',               'Otros', false, true, true, 7.670, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CAPOTE',                'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('CORBATA',               'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('DESGRASE',              'Otros', false, true, true, 6.760, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('GRASA',                 'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('LARDO',                 'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('MANTECA',               'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('MASCARA',               'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('MASCARA COMPLETA',      'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('RECORTE DE MASCARA',    'Otros', false, true, true, 6.780, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('PAPADA',                'Otros', false, true, true, 5.110, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('PAPADA CORTA',          'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('OREJAS',                'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('TROMPA',                'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('PECHO',                 'Otros', false, true, true, 7.440, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('PECHO C/CUERO',         'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('ESPALDILLA CON GRASA Y PAPADA','Otros', false, true, true, NULL, 'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('PRENSA MOLIDA',         'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('PRENSA NATURAL',        'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('RABOS CARNUDOS',        'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('RABOS PELONES',         'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('SANCOCHO',              'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('TOCINO',                'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true),
('TOCINO AZUL',           'Otros', false, true, true, NULL,  'KG', 0, 'YtQlCieutj4iryBDnWf2xjkJkr39nsZT', 'active', true);
