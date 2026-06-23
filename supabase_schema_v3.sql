-- ============================================================
-- SCHEMA V3 — Catalogo de Otros Costos (App Pastelería Mami)
-- Ejecuta este script en: Supabase → SQL Editor → New query
-- ============================================================

-- ── Catálogo de Costos Extra (Conceptos pre-registrados) ─────
CREATE TABLE IF NOT EXISTS extra_cost_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL, -- 'packaging', 'service', 'labor', 'other'
  quantity_sold   NUMERIC(12, 2) NOT NULL DEFAULT 1, -- cantidad que venden (ej: 100 capacillos)
  price           NUMERIC(12, 2) NOT NULL DEFAULT 0, -- precio del paquete (ej: $5000)
  unit_price      NUMERIC(12, 2) NOT NULL DEFAULT 0, -- precio por unidad individual (calculado)
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Índice único case-insensitive
CREATE UNIQUE INDEX IF NOT EXISTS extra_cost_items_name_unique ON extra_cost_items (LOWER(name));

-- RLS
ALTER TABLE extra_cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read extra_cost_items"   ON extra_cost_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert extra_cost_items"  ON extra_cost_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update extra_cost_items"  ON extra_cost_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete extra_cost_items"  ON extra_cost_items FOR DELETE USING (auth.role() = 'authenticated');

-- Seed inicial de conceptos comunes (opcional, tu mamá puede añadir más)
INSERT INTO extra_cost_items (name, type, quantity_sold, price, unit_price) VALUES
  ('Cajas de torta mediana (pack x10)', 'packaging', 10, 12000, 1200),
  ('Cajas de torta grande (pack x10)', 'packaging', 10, 18000, 1800),
  ('Bandejas domo (pack x20)', 'packaging', 20, 30000, 1500),
  ('Capacillos de muffin (pack x100)', 'packaging', 100, 25000, 250),
  ('Servicio gas (por tanda)', 'service', 1, 1000, 1000),
  ('Servicio luz/horno (por tanda)', 'service', 1, 1500, 1500),
  ('Mano de obra Cecilia', 'labor', 1, 5000, 5000),
  ('Cinta decorativa (rollo 50m)', 'packaging', 50, 5000, 100)
ON CONFLICT (LOWER(name)) DO NOTHING;
