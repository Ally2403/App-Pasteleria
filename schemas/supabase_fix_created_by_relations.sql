-- ============================================================
-- FIX: Relaciones de created_by con la tabla public.profiles
-- Ejecuta esto en: Supabase → SQL Editor → New query
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Buscar y eliminar cualquier constraint de clave foránea existente en la columna 'created_by' de las tablas en el esquema public
  FOR r IN (
    SELECT 
      tc.table_name, 
      kcu.column_name, 
      tc.constraint_name
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE 
      tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
      AND kcu.column_name = 'created_by'
  ) LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

-- 2. Crear las nuevas claves foráneas apuntando a public.profiles(id) de forma segura
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales') THEN
    ALTER TABLE public.sales 
      ADD CONSTRAINT sales_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'other_purchases') THEN
    ALTER TABLE public.other_purchases 
      ADD CONSTRAINT other_purchases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ingredient_purchases') THEN
    ALTER TABLE public.ingredient_purchases 
      ADD CONSTRAINT ingredient_purchases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_stock_adjustments') THEN
    ALTER TABLE public.product_stock_adjustments 
      ADD CONSTRAINT product_stock_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
