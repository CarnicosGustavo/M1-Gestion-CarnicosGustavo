
-- Precios por cliente: cada cliente guarda su propio precio por producto.
-- Al cobrar/actualizar, se hace upsert aquí; el próximo pedido pre-carga estos precios.
CREATE TABLE IF NOT EXISTS customer_prices (
  id              serial PRIMARY KEY,
  customer_id     integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id      integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_per_kg    numeric(10,2),
  price_per_piece numeric(10,2),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_prices_customer ON customer_prices(customer_id);
