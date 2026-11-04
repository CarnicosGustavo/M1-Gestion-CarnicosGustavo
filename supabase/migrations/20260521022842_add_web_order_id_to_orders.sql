
-- Agregar referencia a web_orders en tabla orders para trazabilidad
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS web_order_id UUID REFERENCES web_orders(id) ON DELETE SET NULL;

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_orders_web_order_id ON orders(web_order_id);
