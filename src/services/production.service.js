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

  // 2. Descontar ingredientes del inventario
  await deductFromInventory(actualIngredients);

  // 3. Descontar empaques físicos del inventario
  try {
    // Obtener unidades por tanda de la receta
    const { data: recipe, error: recipeErr } = await supabase
      .from('recipes')
      .select('units_per_batch')
      .eq('id', recipeId)
      .single();

    if (!recipeErr && recipe) {
      const unitsPerBatch = parseFloat(recipe.units_per_batch) || 1;
      const batches = unitsProduced / unitsPerBatch;

      // Obtener costos extras asociados a la receta
      const { data: recCosts, error: recCostsErr } = await supabase
        .from('recipe_extra_costs')
        .from('recipe_extra_costs')
        .select('name, type, quantity')
        .eq('recipe_id', recipeId);

      if (!recCostsErr && recCosts) {
        // Filtrar solo los empaques/packaging
        const packagingCosts = recCosts.filter(rc => rc.type === 'packaging');
        if (packagingCosts.length > 0) {
          // Obtener todos los extra_cost_items con inventario habilitado
          const { data: extraItems } = await supabase
            .from('extra_cost_items')
            .select('id, name')
            .eq('has_inventory', true);

          if (extraItems) {
            const deductItems = [];
            packagingCosts.forEach(pc => {
              // Buscar coincidencia por nombre (case-insensitive)
              const matchedItem = extraItems.find(ei => ei.name.toLowerCase().trim() === pc.name.toLowerCase().trim());
              if (matchedItem) {
                deductItems.push({
                  extraCostItemId: matchedItem.id,
                  quantityUsed: (parseFloat(pc.quantity) || 0) * batches
                });
              }
            });
            
            if (deductItems.length > 0) {
              const { deductExtraCostsFromInventory } = await import('./extra_costs.service');
              await deductExtraCostsFromInventory(deductItems);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error al descontar empaques del inventario:', err);
  }

  // 4. Agregar al stock de productos terminados
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

  // 2.5. Devolver los empaques gastados al inventario
  try {
    const { data: recipe, error: recipeErr } = await supabase
      .from('recipes')
      .select('units_per_batch')
      .eq('id', log.recipe_id)
      .single();

    if (!recipeErr && recipe) {
      const unitsPerBatch = parseFloat(recipe.units_per_batch) || 1;
      const batches = log.units_produced / unitsPerBatch;

      const { data: recCosts, error: recCostsErr } = await supabase
        .from('recipe_extra_costs')
        .select('name, type, quantity')
        .eq('recipe_id', log.recipe_id);

      if (!recCostsErr && recCosts) {
        const packagingCosts = recCosts.filter(rc => rc.type === 'packaging');
        if (packagingCosts.length > 0) {
          const { data: extraItems } = await supabase
            .from('extra_cost_items')
            .select('id, name')
            .eq('has_inventory', true);

          if (extraItems) {
            const addItems = [];
            packagingCosts.forEach(pc => {
              const matchedItem = extraItems.find(ei => ei.name.toLowerCase().trim() === pc.name.toLowerCase().trim());
              if (matchedItem) {
                addItems.push({
                  extraCostItemId: matchedItem.id,
                  quantityUsed: (parseFloat(pc.quantity) || 0) * batches
                });
              }
            });

            if (addItems.length > 0) {
              const { addExtraCostsToInventory } = await import('./extra_costs.service');
              await addExtraCostsToInventory(addItems);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error al revertir empaques del inventario:', err);
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
