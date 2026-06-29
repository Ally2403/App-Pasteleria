-- ============================================================
-- FIX RLS inventory — App Pastelería
-- Ejecuta en: Supabase → SQL Editor → New query
-- ============================================================

-- Paso 1: Borrar TODAS las políticas existentes en inventory
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'inventory'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON inventory';
  END LOOP;
END $$;

-- Paso 2: Activar RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Paso 3: Crear una sola política que permite todo a usuarios autenticados
CREATE POLICY "allow_all_authenticated"
  ON inventory
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Verificar que quedó bien
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'inventory';
