
ALTER TABLE products ADD COLUMN IF NOT EXISTS avg_weight_per_piece_kg numeric(10,3);

DELETE FROM transactions;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM inventory_transactions;
DELETE FROM product_transformations;
DELETE FROM price_list_items;
DELETE FROM products;

ALTER SEQUENCE products_id_seq RESTART WITH 1;
