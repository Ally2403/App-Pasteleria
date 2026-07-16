-- ====================================================
-- ESQUEMA COMPLETO — App Pastelería Mami 🎂
-- Reconstruido desde el código fuente (todos los services)
-- 
-- ⚠️ INSTRUCCIONES:
-- 1. Crea un proyecto NUEVO en Supabase (cuenta nueva si quieres)
-- 2. Ve a: SQL Editor → New query
-- 3. Pega TODO este script y ejecútalo
-- 4. Luego crea los usuarios manualmente en Authentication → Users
-- 5. Actualiza sus roles con los UPDATE del final
-- ====================================================

-- ── EXTENSIONES ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── LIMPIAR TABLAS EXISTENTES (orden inverso de FK) ──────────
DROP TABLE IF EXISTS product_stock_adjustments CASCADE;
DROP TABLE IF EXISTS product_stock CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS production_logs CASCADE;
DROP TABLE IF EXISTS recipe_pricing CASCADE;
DROP TABLE IF EXISTS recipe_extra_costs CASCADE;
DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS extra_cost_items CASCADE;
DROP TABLE IF EXISTS ingredient_purchases CASCADE;
DROP TABLE IF EXISTS other_purchases CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS providers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================
-- 1. PERFILES (vinculados con auth.users)
-- ============================================================
CREATE TABLE profiles (
  id          UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'partner')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquier usuario autenticado puede leer perfiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Los usuarios pueden editar su propio perfil"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============================================================
-- 2. PROVEEDORES
-- ============================================================
CREATE TABLE providers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS providers_name_unique ON providers (LOWER(name));

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read providers"   ON providers FOR SELECT    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert providers"  ON providers FOR INSERT    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update providers"  ON providers FOR UPDATE    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete providers"  ON providers FOR DELETE    USING (auth.role() = 'authenticated');

-- ============================================================
-- 3. INGREDIENTES
-- ============================================================
CREATE TABLE ingredients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  provider       TEXT,
  quantity_sold  NUMERIC NOT NULL,
  unit           TEXT NOT NULL,
  price          NUMERIC NOT NULL,
  unit_price     NUMERIC NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquier usuario autenticado puede ver ingredientes"
  ON ingredients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo administradores pueden modificar ingredientes"
  ON ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 4. INVENTARIO (stock de ingredientes)
-- ============================================================
CREATE TABLE inventory (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id  UUID REFERENCES ingredients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_stock  NUMERIC DEFAULT 0 NOT NULL,
  unit           TEXT NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquier usuario autenticado puede ver inventario"
  ON inventory FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo administradores pueden modificar inventario"
  ON inventory FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 5. CATALOGO DE COSTOS EXTRA
--    Incluye: has_inventory y current_stock para empaques fisicos
-- ============================================================
CREATE TABLE extra_cost_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  type           TEXT NOT NULL,
  quantity_sold  NUMERIC(12, 2) NOT NULL DEFAULT 1,
  price          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_price     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  provider       TEXT,
  has_inventory  BOOLEAN NOT NULL DEFAULT false,
  current_stock  NUMERIC(12, 2) DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS extra_cost_items_name_unique ON extra_cost_items (LOWER(name));

ALTER TABLE extra_cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read extra_cost_items"   ON extra_cost_items FOR SELECT    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert extra_cost_items"  ON extra_cost_items FOR INSERT    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update extra_cost_items"  ON extra_cost_items FOR UPDATE    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete extra_cost_items"  ON extra_cost_items FOR DELETE    USING (auth.role() = 'authenticated');

-- ============================================================
-- 6. RECETAS
-- ============================================================
CREATE TABLE recipes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  units_per_batch NUMERIC NOT NULL,
  has_partner     BOOLEAN DEFAULT false NOT NULL,
  partner_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquier usuario autenticado puede ver recetas"
  ON recipes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo administradores pueden modificar recetas"
  ON recipes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 7. INGREDIENTES DE RECETA
-- ============================================================
CREATE TABLE recipe_ingredients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id      UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  ingredient_id  UUID REFERENCES ingredients(id) ON DELETE CASCADE NOT NULL,
  quantity_used  NUMERIC NOT NULL
);

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquier usuario autenticado puede ver ingredientes de receta"
  ON recipe_ingredients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo administradores pueden modificar ingredientes de receta"
  ON recipe_ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 8. COSTOS EXTRA DE RECETA
-- ============================================================
CREATE TABLE recipe_extra_costs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('packaging', 'service', 'labor', 'other')),
  quantity   NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total      NUMERIC NOT NULL,
  provider   TEXT
);

ALTER TABLE recipe_extra_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquier usuario autenticado puede ver costos extra"
  ON recipe_extra_costs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo administradores pueden modificar costos extra"
  ON recipe_extra_costs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 9. PRECIOS Y MARGENES DE RECETA
-- ============================================================
CREATE TABLE recipe_pricing (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id          UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL UNIQUE,
  profit_percentage  NUMERIC NOT NULL,
  suggested_price    NUMERIC NOT NULL,
  rounded_price      NUMERIC NOT NULL
);

ALTER TABLE recipe_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquier usuario autenticado puede ver precios"
  ON recipe_pricing FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo administradores pueden modificar precios"
  ON recipe_pricing FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 10. LOGS DE PRODUCCION
-- ============================================================
CREATE TABLE production_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  date                TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  units_produced      NUMERIC NOT NULL,
  actual_ingredients  JSONB NOT NULL,
  notes               TEXT
);

ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquier usuario autenticado puede ver logs de produccion"
  ON production_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo administradores pueden registrar producciones"
  ON production_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Solo administradores pueden eliminar producciones"
  ON production_logs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 11. CLIENTES
-- ============================================================
CREATE TABLE customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read customers"   ON customers FOR SELECT    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert customers"  ON customers FOR INSERT    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update customers"  ON customers FOR UPDATE    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete customers"  ON customers FOR DELETE    USING (auth.role() = 'authenticated');

-- ============================================================
-- 12. STOCK DE PRODUCTOS TERMINADOS
-- ============================================================
CREATE TABLE product_stock (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id        UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  available_units  INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recipe_id)
);

ALTER TABLE product_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read product_stock"   ON product_stock FOR SELECT    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert product_stock"  ON product_stock FOR INSERT    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update product_stock"  ON product_stock FOR UPDATE    USING (auth.role() = 'authenticated');

-- ============================================================
-- 13. HISTORIAL DE AJUSTES DE STOCK
-- ============================================================
CREATE TABLE product_stock_adjustments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id        UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  quantity_change  INTEGER NOT NULL,
  reason           TEXT NOT NULL,
  notes            TEXT,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read product_stock_adjustments"   ON product_stock_adjustments FOR SELECT    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert product_stock_adjustments"  ON product_stock_adjustments FOR INSERT    WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 14. VENTAS (pedidos, abonos y fecha de entrega incluidos)
-- ============================================================
CREATE TABLE sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   TEXT,
  sale_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   DATE,
  sale_type       TEXT NOT NULL DEFAULT 'immediate' CHECK (sale_type IN ('immediate', 'order')),
  payment_method  TEXT NOT NULL DEFAULT 'efectivo',
  is_paid         BOOLEAN NOT NULL DEFAULT true,
  amount_paid     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'completed',
  notes           TEXT,
  total           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_delivery_date ON sales (delivery_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON sales (sale_type);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read sales"   ON sales FOR SELECT    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert sales"  ON sales FOR INSERT    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update sales"  ON sales FOR UPDATE    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete sales"  ON sales FOR DELETE    USING (auth.role() = 'authenticated');

-- ============================================================
-- 15. ITEMS DE CADA VENTA
-- ============================================================
CREATE TABLE sale_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  recipe_id   UUID NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL,
  unit_price  NUMERIC(12, 2) NOT NULL,
  subtotal    NUMERIC(12, 2) NOT NULL
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read sale_items"   ON sale_items FOR SELECT    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert sale_items"  ON sale_items FOR INSERT    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update sale_items"  ON sale_items FOR UPDATE    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete sale_items"  ON sale_items FOR DELETE    USING (auth.role() = 'authenticated');

-- ============================================================
-- 16. COMPRAS DE INGREDIENTES Y EMPAQUES (egresos reales)
-- ============================================================
CREATE TABLE ingredient_purchases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  total_spent    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  category       TEXT NOT NULL DEFAULT 'ingredients',
  notes          TEXT,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ingredient_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read ingredient_purchases"   ON ingredient_purchases FOR SELECT    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert ingredient_purchases"  ON ingredient_purchases FOR INSERT    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update ingredient_purchases"  ON ingredient_purchases FOR UPDATE    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete ingredient_purchases"  ON ingredient_purchases FOR DELETE    USING (auth.role() = 'authenticated');

-- ============================================================
-- 17. OTRAS COMPRAS (gastos varios / no programados)
-- ============================================================
CREATE TABLE other_purchases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  price          NUMERIC(12, 2) NOT NULL,
  quantity       INTEGER NOT NULL DEFAULT 1,
  category       TEXT,
  purchase_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE other_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read other_purchases"   ON other_purchases FOR SELECT    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can insert other_purchases"  ON other_purchases FOR INSERT    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update other_purchases"  ON other_purchases FOR UPDATE    USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete other_purchases"  ON other_purchases FOR DELETE    USING (auth.role() = 'authenticated');

-- ============================================================
-- 18. TRIGGER — Crear perfil automatico al registrar usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nueva Pastelera'),
    COALESCE(new.raw_user_meta_data->>'role', 'partner')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- DESPUES DE EJECUTAR ESTE SCRIPT:
-- ============================================================
-- 1. Ve a Authentication -> Users -> Add user
--    Crea a Cecilia (admin) y a Jhon (partner) con sus emails
--
-- 2. Actualiza sus roles:
--    UPDATE public.profiles
--    SET role = 'admin', full_name = 'Cecilia Ruiz'
--    WHERE id = 'PEGA-AQUI-EL-UUID-DE-CECILIA';
--
--    UPDATE public.profiles
--    SET role = 'partner', full_name = 'Jhon'
--    WHERE id = 'PEGA-AQUI-EL-UUID-DE-JHON';
--
-- 3. Actualiza el archivo .env:
--    VITE_SUPABASE_URL=https://TU-NUEVO-PROYECTO.supabase.co
--    VITE_SUPABASE_ANON_KEY=TU-NUEVA-ANON-KEY
-- ============================================================
