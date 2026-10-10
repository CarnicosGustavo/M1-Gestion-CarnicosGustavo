
-- product_id puede ser NULL para pedidos web donde el producto
-- no coincide exactamente con el catálogo. El operario lo asigna después.
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
