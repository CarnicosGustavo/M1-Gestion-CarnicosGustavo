-- ============================================================================
-- TRIGGER: Sincronizar web_orders → orders (Dashboard)
-- Ejecuta esto en: https://supabase.co/dashboard/project/uajezdrnqujmutjokwfo/sql
-- ============================================================================

-- 1. Crear función que sincronice web_orders → orders
CREATE OR REPLACE FUNCTION sync_web_order_to_dashboard()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id INTEGER;
  v_order_id INTEGER;
  v_item RECORD;
BEGIN
  -- Solo sincronizar si es un pedido desde website
  IF NEW.source = 'website' THEN

    -- 1. Crear o actualizar cliente
    INSERT INTO customers (
      whatsapp_phone,
      name,
      phone,
      address,
      notes,
      status,
      user_uid,
      created_at,
      updated_at
    ) VALUES (
      NEW.phone,
      NEW.business_name,
      NEW.phone,
      NEW.delivery_address,
      NEW.notes,
      'active',
      'system',
      NOW(),
      NOW()
    )
    ON CONFLICT (whatsapp_phone) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING id INTO v_customer_id;

    -- 2. Obtener customer_id si no se insertó
    IF v_customer_id IS NULL THEN
      SELECT id INTO v_customer_id
      FROM customers
      WHERE whatsapp_phone = NEW.phone
      LIMIT 1;
    END IF;

    -- 3. Crear orden en dashboard (PENDIENTE_PESAJE)
    IF v_customer_id IS NOT NULL THEN
      INSERT INTO orders (
        customer_id,
        status,
        total_amount,
        user_uid,
        notes,
        delivery_address,
        requires_weighing,
        created_at,
        updated_at
      ) VALUES (
        v_customer_id,
        'pending',
        '0.00',
        'system',
        NEW.notes,
        NEW.delivery_address,
        true,
        NOW(),
        NOW()
      )
      RETURNING id INTO v_order_id;

      -- 4. Crear items en orden desde JSON
      IF v_order_id IS NOT NULL AND NEW.items IS NOT NULL THEN
        FOR v_item IN
          SELECT
            (item->>'productId')::INTEGER as product_id,
            (item->>'name') as product_name,
            (item->>'quantity')::INTEGER as quantity
          FROM jsonb_array_elements(NEW.items::jsonb) as item
        LOOP
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
            v_item.product_id,
            v_item.product_name,
            v_item.quantity,
            v_item.quantity,
            NULL,
            '0.00',
            '0.00',
            'PENDIENTE_PESAJE',
            NOW()
          );
        END LOOP;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Crear trigger
DROP TRIGGER IF EXISTS sync_web_orders_trigger ON web_orders;
CREATE TRIGGER sync_web_orders_trigger
AFTER INSERT ON web_orders
FOR EACH ROW
EXECUTE FUNCTION sync_web_order_to_dashboard();

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Ejecuta esto después de hacer un pedido en web para verificar:

-- ¿Se creó el cliente?
SELECT 'Customers created:' as check, COUNT(*) as count
FROM customers
WHERE user_uid = 'system'
AND created_at > NOW() - INTERVAL '5 minutes';

-- ¿Se creó la orden?
SELECT 'Orders created:' as check, COUNT(*) as count
FROM orders
WHERE user_uid = 'system'
AND requires_weighing = true
AND created_at > NOW() - INTERVAL '5 minutes';

-- ¿Se crearon los items?
SELECT 'Order items created:' as check, COUNT(*) as count
FROM order_items
WHERE status = 'PENDIENTE_PESAJE'
AND created_at > NOW() - INTERVAL '5 minutes';

-- Ver detalles completos del último pedido sincronizado
SELECT
  o.id as order_id,
  o.status,
  o.requires_weighing,
  c.name as customer_name,
  c.whatsapp_phone,
  COUNT(oi.id) as items_count
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.user_uid = 'system'
AND o.created_at > NOW() - INTERVAL '5 minutes'
GROUP BY o.id, o.status, o.requires_weighing, c.name, c.whatsapp_phone
ORDER BY o.created_at DESC
LIMIT 5;
