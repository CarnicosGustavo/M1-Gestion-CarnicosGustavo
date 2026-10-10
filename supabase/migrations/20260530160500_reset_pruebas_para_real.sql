
DO $$
DECLARE
  sfx text := to_char(now(), 'YYYYMMDDHH24MISS');
  t   text;
BEGIN
  -- 1. Respaldo automático a tablas con fecha/hora
  FOREACH t IN ARRAY ARRAY[
    'customers','orders','order_items','web_orders','transactions',
    'credit_charges','credit_payments','customer_prices',
    'inventory_transactions','channel_purchases','yield_sheets','yield_sheet_items'
  ] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS bkp_%s_%s AS TABLE %I', t, sfx, t);
  END LOOP;

  -- 2. Limpieza (respeta dependencias)
  DELETE FROM transactions;
  DELETE FROM credit_payments;
  DELETE FROM credit_charges;
  DELETE FROM customer_prices;
  DELETE FROM order_items;
  DELETE FROM orders;
  DELETE FROM web_orders;
  DELETE FROM customers;
  DELETE FROM yield_sheet_items;
  DELETE FROM yield_sheets;
  DELETE FROM channel_purchases;
  DELETE FROM inventory_transactions;

  -- 3. Inventario a cero (catálogo y recetas se conservan)
  UPDATE products SET
    stock_pieces = 0,
    weighed_pieces = 0,
    stock_kg = 0,
    stock_kg_frozen = 0,
    stock_pieces_frozen = 0,
    updated_at = now();

  RAISE NOTICE 'Reset completo. Respaldo con sufijo %', sfx;
END $$;
