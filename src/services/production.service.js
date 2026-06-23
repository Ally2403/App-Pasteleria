/**
 * production.service.js
 * Registrar producciones y descontar inventario.
 */
import { supabase } from './supabase';
import { deductFromInventory, addToInventory } from './ingredients.service';
import { addProductStock, adjustProductStock } from './product_stock.service';

/**
 * Registra una producción completada y descuenta los ingredientes del inventario.
 *
 * @param {object} params
 * @param {string} params.recipeId
 * @param {number} params.unitsProduced
 * @param {Array}  params.actualIngredients - [{ ingredientId, quantityUsed }] (cantidades confirmadas)
 * @param {string} [params.notes]
 * @returns {Promise<object>}
 */
export async function registerProduction({ recipeId, unitsProduced, actualIngredients, notes }) {
  // 1. Guardar el log de producción
  const { data, error } = await supabase
    .from('production_logs')
    .insert({
      recipe_id:           recipeId,
      date:                new Date().toISOString(),
      units_produced:      unitsProduced,
      actual_ingredients:  actualIngredients,
      notes:               notes ?? '',
    })
    .select()
    .single();

  if (error) throw error;

  // 2. Descontar del inventario
  await deductFromInventory(actualIngredients);

  // 3. Agregar al stock de productos terminados
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await addProductStock(recipeId, unitsProduced, user?.id);
  } catch (stockError) {
    console.error('Error actualizando stock de producto terminado:', stockError);
  }

  return data;
}

/**
 * Obtiene el historial de producciones.
 * @param {string} [recipeId] - Filtrar por receta (opcional)
 * @returns {Promise<Array>}
 */
export async function getProductionLogs(recipeId) {
  let query = supabase
    .from('production_logs')
    .select(`
      *,
      recipes ( name )
    `)
    .order('date', { ascending: false });

  if (recipeId) {
    query = query.eq('recipe_id', recipeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Elimina un registro de producción, revierte el stock de ingredientes y resta las unidades del stock de productos terminados.
 * @param {string} logId
 */
export async function deleteProduction(logId) {
  // 1. Obtener los detalles del log antes de eliminar
  const { data: log, error: fetchError } = await supabase
    .from('production_logs')
    .select('*')
    .eq('id', logId)
    .single();

  if (fetchError) throw fetchError;
  if (!log) throw new Error('El registro de producción no existe.');

  // 2. Devolver los ingredientes gastados al inventario
  if (log.actual_ingredients && log.actual_ingredients.length > 0) {
    await addToInventory(log.actual_ingredients);
  }

  // 3. Descontar del stock de productos terminados
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await adjustProductStock(
      log.recipe_id,
      -log.units_produced,
      'other',
      `Producción eliminada (reversión log #${log.id.slice(0,8)})`,
      user?.id
    );
  } catch (stockError) {
    console.error('Error al revertir stock de producto terminado:', stockError);
  }

  // 4. Eliminar el registro
  const { error: deleteError } = await supabase
    .from('production_logs')
    .delete()
    .eq('id', logId);

  if (deleteError) throw deleteError;
}
