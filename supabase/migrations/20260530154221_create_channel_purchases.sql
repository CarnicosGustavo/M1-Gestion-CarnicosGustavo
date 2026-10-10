
-- Registro de cada compra de canales (para alimentar el módulo de Rendimiento)
CREATE TABLE IF NOT EXISTS channel_purchases (
  id            serial PRIMARY KEY,
  supplier      varchar(100),
  qty_americano integer NOT NULL DEFAULT 0,
  qty_nacional  integer NOT NULL DEFAULT 0,
  num_medias    integer NOT NULL DEFAULT 0,
  total_kg      numeric(12,3) NOT NULL DEFAULT 0,
  price_per_kg  numeric(10,2),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  user_uid      varchar(255),
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_purchases_date ON channel_purchases(purchase_date);
