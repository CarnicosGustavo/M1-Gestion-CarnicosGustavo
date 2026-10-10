
-- Hoja de rendimiento (despiece): cabecera + renglones
CREATE TABLE IF NOT EXISTS yield_sheets (
  id            serial PRIMARY KEY,
  sheet_date    date NOT NULL DEFAULT CURRENT_DATE,
  num_canales   integer NOT NULL DEFAULT 0,
  kg_comprado   numeric(12,3) NOT NULL DEFAULT 0,
  notes         text,
  user_uid      varchar,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS yield_sheet_items (
  id            serial PRIMARY KEY,
  sheet_id      integer NOT NULL REFERENCES yield_sheets(id) ON DELETE CASCADE,
  product_id    integer REFERENCES products(id),
  product_name  varchar NOT NULL,
  pieces        integer NOT NULL DEFAULT 0,
  kg_total      numeric(12,3) NOT NULL DEFAULT 0,
  weighed       boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_yield_items_sheet ON yield_sheet_items(sheet_id);
