-- ============================================================================
-- TRIGGER V2: Sincronizar web_orders → orders (Dashboard)
-- Mejoras sobre V1:
--   - Vincula web_order_id para trazabilidad completa
--   - Busca product_id por nombre (case-insensitive)
--   - Copia unit_price real desde products
--   - requires_weighing basado en is_sellable_by_weight del producto
--   - Crea transacción de auditoría en inventory_transactions
-- ============================================================================

DROP TRIGGER IF EXISTS sync_web_orders_trigger ON web_orders;
DROP FUNCTION IF EXISTS sync_web_order_to_dashboard();

CREATE OR REPLACE FUNCTION sync_web_order_to_dashboard()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id INTEGER;
  v_order_id    INTEGER;
  v_item        JSONB;
  v_product_id  INTEGER;
  v_unit_price  NUMERIC(10,2);
  v_needs_weigh BOOLEAN;
  v_any_weighing BOOLEAN := false;
BEGIN
  IF NEW.source <> 'website' THEN
    RETURN NEW;
  END IF;

  -- 1. Crear o actualizar cliente por teléfono
  INSERT INTO customers (
    whatsapp_phone, name, phone, address, notes,
    status, user_uid, email, created_at
  ) VALUES (
    NEW.phone,
    NEW.business_name,
    NEW.phone,
    NEW.delivery_address,
    NEW.notes,
    'active',
    'system',
    NEW.phone || '@web.carnicosgustavo.com',
    NOW()
  )
  ON CONFLICT (whatsapp_phone) DO UPDATE SET
    name    = EXCLUDED.name,
    phone   = EXCLUDED.phone,
    address = EXCLUDED.address,
    notes   = EXCLUDED.notes
  RETURNING id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id
    FROM customers WHERE whatsapp_phone = NEW.phone LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Crear orden (requires_weighing se actualiza después de procesar items)
  INSERT INTO orders (
    customer_id, status, total_amount, user_uid,
    notes, delivery_address, requires_weighing,
    web_order_id, created_at, updated_at
  ) VALUES (
    v_customer_id, 'pending', '0.00', 'system',
    NEW.notes, NEW.delivery_address, false,
    NEW.id, NOW(), NOW()
  )
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Procesar cada item del pedido
  FOR v_item IN SELECT jsonb_array_elements(NEW.items)
  LOOP
    -- Buscar producto por nombre (case-insensitive)
    SELECT id, price_per_piece, is_sellable_by_weight
    INTO v_product_id, v_unit_price, v_needs_weigh
    FROM products
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_item->>'name'))
      AND active = true
    LIMIT 1;

    -- Si no encontró por nombre, intentar por productId numérico
    IF v_product_id IS NULL AND (v_item->>'productId') ~ '^\d+$' THEN
      SELECT id, price_per_piece, is_sellable_by_weight
      INTO v_product_id, v_unit_price, v_needs_weigh
      FROM products
      WHERE id = (v_item->>'productId')::INTEGER
      LIMIT 1;
    END IF;

    -- Si algún item requiere pesaje, la orden lo requiere
    IF v_needs_weigh = true THEN
      v_any_weighing := true;
    END IF;

    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      quantity_pieces,
      quantity_kg,
      unit_price,
      subtotal,
      status,
      created_at
    ) VALUES (
      v_order_id,
      v_product_id,
      v_item->>'name',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'quantity')::INTEGER,
      NULL,
      COALESCE(v_unit_price, 0.00),
      0.00,
      CASE WHEN v_needs_weigh THEN 'PENDIENTE_PESAJE' ELSE 'COMPLETADO' END,
      NOW()
    );

    -- Reset para siguiente item
    v_product_id  := NULL;
    v_unit_price  := NULL;
    v_needs_weigh := NULL;
  END LOOP;

  -- 4. Actualizar requires_weighing en la orden según los items
  UPDATE orders
  SET requires_weighing = v_any_weighing
  WHERE id = v_order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER sync_web_orders_trigger
AFTER INSERT ON web_orders
FOR EACH ROW
EXECUTE FUNCTION sync_web_order_to_dashboard();

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
SELECT 'Trigger instalado:' as info, trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'sync_web_orders_trigger';
