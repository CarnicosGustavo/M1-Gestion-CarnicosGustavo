
-- COBRANZA / CRÉDITO
-- Montos en PESOS (numeric), independiente de la convención de centavos de orders.

-- Configuración de crédito por cliente
CREATE TABLE IF NOT EXISTS credit_accounts (
  id            serial PRIMARY KEY,
  customer_id   integer NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  credit_limit  numeric(12,2) NOT NULL DEFAULT 0,
  terms_days    integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Cargos: pedidos a crédito + tickets viejos sin pagar
CREATE TABLE IF NOT EXISTS credit_charges (
  id            serial PRIMARY KEY,
  customer_id   integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id      integer,
  amount        numeric(12,2) NOT NULL DEFAULT 0,
  concept       varchar(255),
  charge_date   date NOT NULL DEFAULT CURRENT_DATE,
  source        varchar(30) NOT NULL DEFAULT 'ticket_viejo', -- 'pedido' | 'ticket_viejo'
  created_at    timestamptz DEFAULT now()
);

-- Abonos / pagos del cliente
CREATE TABLE IF NOT EXISTS credit_payments (
  id            serial PRIMARY KEY,
  customer_id   integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount        numeric(12,2) NOT NULL DEFAULT 0,
  payment_date  date NOT NULL DEFAULT CURRENT_DATE,
  method        varchar(50),
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_charges_customer ON credit_charges(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_customer ON credit_payments(customer_id);
