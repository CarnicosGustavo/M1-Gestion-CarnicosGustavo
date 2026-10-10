
-- Inventario Frío: segundo bucket de stock (congelado).
-- El inventario fresco (stock_kg/stock_pieces) es el único vendible.
-- Para vender de frío, primero se transfiere a fresco.
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_kg_frozen numeric(10,3) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_pieces_frozen integer NOT NULL DEFAULT 0;
