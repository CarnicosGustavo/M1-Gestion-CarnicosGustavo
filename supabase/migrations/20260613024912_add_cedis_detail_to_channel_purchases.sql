ALTER TABLE channel_purchases
  ADD COLUMN IF NOT EXISTS cedis_detail jsonb;
