ALTER TABLE channel_purchases
  ADD COLUMN IF NOT EXISTS verified_canales integer,
  ADD COLUMN IF NOT EXISTS verified_kg numeric(12,3);
