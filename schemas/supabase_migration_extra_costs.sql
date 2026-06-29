-- ============================================================
-- MIGRACIÓN — Proveedor en extra_cost_items
-- Ejecuta en: Supabase → SQL Editor → New query
-- SEGURO: solo agrega columna si no existe.
-- ============================================================

-- Agrega columna de proveedor (texto libre, igual que en ingredientes)
ALTER TABLE extra_cost_items
  ADD COLUMN IF NOT EXISTS provider TEXT;

-- Agrega columna de proveedor a los costos extras específicos guardados en recetas
ALTER TABLE recipe_extra_costs
  ADD COLUMN IF NOT EXISTS provider TEXT;

