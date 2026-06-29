-- ============================================================
-- SCHEMA V4 — Pedidos, Abonos y Fecha de Entrega
-- App Pastelería Mami 🎂
-- Ejecuta este script en: Supabase → SQL Editor → New query
-- ============================================================

-- ── 1. Agregar tipo de venta: 'immediate' (venta ya lista) o 'order' (pedido a futuro) ──
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS sale_type TEXT NOT NULL DEFAULT 'immediate'
  CHECK (sale_type IN ('immediate', 'order'));

-- ── 2. Fecha de entrega del pedido ────────────────────────────────────────────────────────
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- Si la venta es inmediata, delivery_date = sale_date por defecto
-- Para pedidos, delivery_date es la fecha que el cliente exige

-- ── 3. Monto abonado por el cliente ──────────────────────────────────────────────────────
-- Reemplaza el booleano is_paid para permitir pagos parciales.
-- is_paid sigue existiendo como campo calculado: amount_paid >= total
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Sincronizar amount_paid con los registros existentes:
-- Si is_paid = true → amount_paid = total; si no → 0
UPDATE sales
  SET amount_paid = CASE WHEN is_paid = true THEN total ELSE 0 END
  WHERE amount_paid = 0;

-- ── 4. Índice para consultas eficientes de próximas entregas ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_delivery_date ON sales (delivery_date)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON sales (sale_type);

-- ── 5. Verificación final ─────────────────────────────────────────────────────────────────
-- Ejecuta esto para confirmar que las columnas quedaron bien:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'sales'
-- ORDER BY ordinal_position;
