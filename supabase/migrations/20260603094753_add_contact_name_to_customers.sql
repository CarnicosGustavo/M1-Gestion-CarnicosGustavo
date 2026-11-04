ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_name varchar(255);

-- El trigger de pedidos web ahora guarda el nombre del responsable (contacto)
CREATE OR REPLACE FUNCTION public.sync_web_order_to_dashboard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id  INTEGER;
  v_order_id     INTEGER;
  v_item         JSONB;
  v_product_id   INTEGER;
  v_unit_price   NUMERIC(10,2);
  v_needs_weigh  BOOLEAN;
  v_any_weighing BOOLEAN := false;
  v_is_kg        BOOLEAN;
BEGIN
  IF NEW.source NOT IN ('website', 'pedidos-app') THEN
    RETURN NEW;
  END IF;

  INSERT INTO customers (
    whatsapp_phone, name, contact_name, phone, address, notes,
    status, user_uid, email, created_at
  ) VALUES (
    NEW.phone, NEW.business_name, NEW.contact_name, NEW.phone, NEW.delivery_address, NEW.notes,
    'active', 'system', NEW.phone || '@web.carnicosgustavo.com', NOW()
  )
  ON CONFLICT (whatsapp_phone) DO UPDATE SET
    name = EXCLUDED.name, contact_name = EXCLUDED.contact_name, phone = EXCLUDED.phone,
    address = EXCLUDED.address, notes = EXCLUDED.notes
  RETURNING id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id FROM customers WHERE whatsapp_phone = NEW.phone LIMIT 1;
  END IF;
  IF v_customer_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO orders (
    customer_id, status, total_amount, user_uid,
    notes, delivery_address, requires_weighing,
    web_order_id, created_at, updated_at
  ) VALUES (
    v_customer_id, 'pending', '0.00', 'system',
    NEW.notes, NEW.delivery_address, false, NEW.id, NOW(), NOW()
  )
  RETURNING id INTO v_order_id;
  IF v_order_id IS NULL THEN RETURN NEW; END IF;

  FOR v_item IN SELECT jsonb_array_elements(NEW.items)
  LOOP
    SELECT id, price_per_piece, is_sellable_by_weight
    INTO v_product_id, v_unit_price, v_needs_weigh
    FROM products
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_item->>'name')) AND active = true
    LIMIT 1;

    IF v_product_id IS NULL AND (v_item->>'productId') ~ '^\d+$' THEN
      SELECT id, price_per_piece, is_sellable_by_weight
      INTO v_product_id, v_unit_price, v_needs_weigh
      FROM products WHERE id = (v_item->>'productId')::INTEGER LIMIT 1;
    END IF;

    IF v_needs_weigh = true THEN v_any_weighing := true; END IF;

    v_is_kg := LOWER(COALESCE(v_item->>'unit', 'piezas')) = 'kg';

    INSERT INTO order_items (
      order_id, product_id, product_name,
      quantity, quantity_pieces, quantity_kg,
      unit_price, subtotal, status, created_at
    ) VALUES (
      v_order_id,
      v_product_id,
      v_item->>'name',
      ROUND((v_item->>'quantity')::numeric)::INTEGER,
      CASE WHEN v_is_kg THEN NULL ELSE ROUND((v_item->>'quantity')::numeric)::INTEGER END,
      CASE WHEN v_is_kg THEN (v_item->>'quantity')::numeric ELSE NULL END,
      COALESCE(v_unit_price, 0.00),
      0.00,
      CASE WHEN v_needs_weigh = true THEN 'PENDIENTE_PESAJE' ELSE 'COMPLETADO' END,
      NOW()
    );

    v_product_id := NULL; v_unit_price := NULL; v_needs_weigh := NULL;
  END LOOP;

  UPDATE orders SET requires_weighing = v_any_weighing WHERE id = v_order_id;
  RETURN NEW;
END;
$function$;
