-- Variante: especificación alternativa de la misma pieza (ej. JAMON vs JAMON S/H).
-- No suma al peso del padre; se produce una u otra.
ALTER TABLE product_transformations
  ADD COLUMN IF NOT EXISTS is_variant boolean NOT NULL DEFAULT false;
