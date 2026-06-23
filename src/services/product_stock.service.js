/**
 * product_stock.service.js
 * Gestión del stock de productos terminados (unidades listas para vender).
 */
import { supabase } from './supabase';

/**
 * Obtiene el stock actual de todos los productos terminados.
 * @returns {Promise<Array>}
 */
export async function getProductStock() {
  const { data, error } = await supabase
    .from('product_stock')
    .select(`
      *,
      recipes ( id, name, units_per_batch )
    `)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Obtiene el stock de un producto específico.
 * @param {string} recipeId
 */
export async function getProductStockByRecipe(recipeId) {
  const { data, error } = await supabase
    .from('product_stock')
    .select('*')
    .eq('recipe_id', recipeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Suma unidades al stock de un producto (después de una producción).
 * Crea el registro si no existe.
 * @param {string} recipeId
 * @param {number} units - Unidades producidas a sumar
 * @param {string} userId - ID del usuario que registra
 */
export async function addProductStock(recipeId, units, userId) {
  // Obtener stock actual
  const current = await getProductStockByRecipe(recipeId);

  if (current) {
    // Actualizar stock existente
    const { error } = await supabase
      .from('product_stock')
      .update({
        available_units: current.available_units + units,
        updated_at: new Date().toISOString(),
      })
      .eq('recipe_id', recipeId);
    if (error) throw error;
  } else {
    // Crear registro nuevo
    const { error } = await supabase
      .from('product_stock')
      .insert({ recipe_id: recipeId, available_units: units });
    if (error) throw error;
  }

  // Registrar ajuste en historial
  await supabase.from('product_stock_adjustments').insert({
    recipe_id:      recipeId,
    quantity_change: units,
    reason:         'production',
    notes:          `Se produjeron ${units} unidades`,
    created_by:     userId ?? null,
  });
}

/**
 * Ajusta el stock de un producto (puede ser negativo para salidas).
 * @param {string} recipeId
 * @param {number} quantityChange - Positivo = entrada, negativo = salida
 * @param {string} reason - 'sale' | 'damage' | 'consumption' | 'other'
 * @param {string} notes
 * @param {string} userId
 */
export async function adjustProductStock(recipeId, quantityChange, reason, notes, userId) {
  const current = await getProductStockByRecipe(recipeId);
  const currentUnits = current?.available_units ?? 0;
  const newUnits = Math.max(0, currentUnits + quantityChange);

  if (current) {
    const { error } = await supabase
      .from('product_stock')
      .update({ available_units: newUnits, updated_at: new Date().toISOString() })
      .eq('recipe_id', recipeId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('product_stock')
      .insert({ recipe_id: recipeId, available_units: Math.max(0, quantityChange) });
    if (error) throw error;
  }

  // Historial
  await supabase.from('product_stock_adjustments').insert({
    recipe_id:       recipeId,
    quantity_change: quantityChange,
    reason,
    notes:           notes ?? null,
    created_by:      userId ?? null,
  });
}

/**
 * Obtiene el historial de ajustes de un producto.
 * @param {string} recipeId
 */
export async function getProductStockAdjustments(recipeId) {
  const { data, error } = await supabase
    .from('product_stock_adjustments')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
