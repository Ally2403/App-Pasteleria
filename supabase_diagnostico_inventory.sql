-- ============================================================
-- DIAGNÓSTICO: Estado del inventario
-- Ejecuta en: Supabase → SQL Editor → New query
-- ============================================================

-- 1. Ver qué hay en la tabla inventory directamente
SELECT * FROM inventory LIMIT 20;

-- 2. Ver si el JOIN funciona correctamente
SELECT 
  i.name,
  i.id AS ingredient_id,
  inv.id AS inventory_id,
  inv.current_stock,
  inv.unit
FROM ingredients i
LEFT JOIN inventory inv ON i.id = inv.ingredient_id
ORDER BY i.name;

-- 3. Ver si hay FK definida entre inventory e ingredients
SELECT
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'inventory';
