-- ============================================================
-- SCHEMA V2 — App Pastelería Mami
-- Ejecuta este script en: Supabase → SQL Editor → New query
-- ============================================================

-- ── Proveedores ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsqueda por nombre (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS providers_name_unique ON providers (LOWER(name));

-- ── Clientes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  phone       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Stock de productos terminados ─────────────────────────────
-- Controla cuántas unidades terminadas hay disponibles por receta
CREATE TABLE IF NOT EXISTS product_stock (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  available_units INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id)
);

-- ── Ajustes de stock de productos terminados ──────────────────
-- Registra cada movimiento: producción, venta, daño, consumo, etc.
CREATE TABLE IF NOT EXISTS product_stock_adjustments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  quantity_change INTEGER NOT NULL, -- positivo = entrada, negativo = salida
  reason        TEXT NOT NULL, -- 'production', 'sale', 'damage', 'consumption', 'other'
  notes         TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Ventas ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   TEXT, -- Para clientes sin registrar
  sale_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method  TEXT NOT NULL DEFAULT 'efectivo', -- efectivo, transferencia, nequi, daviplata, otro
  is_paid         BOOLEAN NOT NULL DEFAULT true,
  status          TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed'
  notes           TEXT,
  total           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Detalle de items de cada venta ────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  recipe_id   UUID NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL,
  unit_price  NUMERIC(12, 2) NOT NULL, -- Precio al que se vendió
  subtotal    NUMERIC(12, 2) NOT NULL
);

-- ============================================================
-- RLS (Row Level Security) — Acceso autenticado
-- ============================================================

ALTER TABLE providers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items   ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer y escribir
-- (el control de permisos lo maneja el frontend con roles)

CREATE POLICY "Auth users can read providers"   ON providers   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert providers"  ON providers   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update providers"  ON providers   FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete providers"  ON providers   FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can read customers"   ON customers   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert customers"  ON customers   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update customers"  ON customers   FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete customers"  ON customers   FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can read product_stock"   ON product_stock   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert product_stock"  ON product_stock   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update product_stock"  ON product_stock   FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can read product_stock_adjustments"   ON product_stock_adjustments   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert product_stock_adjustments"  ON product_stock_adjustments   FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can read sales"   ON sales   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert sales"  ON sales   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update sales"  ON sales   FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete sales"  ON sales   FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can read sale_items"   ON sale_items   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert sale_items"  ON sale_items   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update sale_items"  ON sale_items   FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete sale_items"  ON sale_items   FOR DELETE USING (auth.role() = 'authenticated');
