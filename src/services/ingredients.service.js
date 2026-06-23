/**
 * ingredients.service.js
 * CRUD de ingredientes e inventario.
 */
import { supabase } from './supabase';
import { calcUnitPrice } from '../utils/calculations';
import { getOrCreateProvider } from './providers.service';

// ── Ingredientes ──────────────────────────────────────────────────────────────

/**
 * Obtiene todos los ingredientes con su stock actual.
 * @returns {Promise<Array>}
 */
export async function getIngredients() {
  const { data, error } = await supabase
    .from('ingredients')
    .select(`
      *,
      inventory ( current_stock, unit )
    `)
    .order('name');

  if (error) throw error;

  // PostgREST puede devolver inventory como objeto (relación 1:1 por UNIQUE constraint)
  // Normalizamos siempre a array para que el código UI sea consistente.
  return (data ?? []).map((ing) => ({
    ...ing,
    inventory: Array.isArray(ing.inventory)
      ? ing.inventory
      : ing.inventory
        ? [ing.inventory]
        : [],
  }));
}

/**
 * Crea un nuevo ingrediente y su registro de inventario (stock inicial 0).
 * Calcula el precio unitario automáticamente.
 * @param {object} ingredient
 * @returns {Promise<object>}
 */
export async function createIngredient(ingredient) {
  const unitPrice = calcUnitPrice(ingredient.price, ingredient.quantity_sold);

  if (ingredient.provider) {
    await getOrCreateProvider(ingredient.provider);
  }

  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      name:          ingredient.name,
      provider:      ingredient.provider,
      quantity_sold: ingredient.quantity_sold,
      unit:          ingredient.unit,
      price:         ingredient.price,
      unit_price:    unitPrice,
    })
    .select()
    .single();

  if (error) throw error;

  // Crear el registro de inventario con stock = 0
  await supabase.from('inventory').insert({
    ingredient_id:  data.id,
    current_stock:  0,
    unit:           data.unit,
  });

  return data;
}

/**
 * Actualiza un ingrediente existente.
 * Recalcula el precio unitario.
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object>}
 */
export async function updateIngredient(id, updates) {
  const unitPrice = calcUnitPrice(
    updates.price ?? updates.price,
    updates.quantity_sold ?? updates.quantity_sold
  );

  if (updates.provider) {
    await getOrCreateProvider(updates.provider);
  }

  const { data, error } = await supabase
    .from('ingredients')
    .update({ ...updates, unit_price: unitPrice })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Elimina un ingrediente (y su inventario en cascada por FK).
 * @param {string} id
 */
export async function deleteIngredient(id) {
  const { error } = await supabase.from('ingredients').delete().eq('id', id);
  if (error) throw error;
}

// ── Inventario ────────────────────────────────────────────────────────────────

/**
 * Actualiza el stock de un ingrediente.
 * @param {string} ingredientId
 * @param {number} newStock
 */
export async function updateStock(ingredientId, newStock) {
  console.log('updateStock llamado para:', ingredientId, 'con nuevo stock:', newStock);
  
  // 1. Verificar si ya existe en inventory
  const { data: existing, error: fetchError } = await supabase
    .from('inventory')
    .select('id, unit, current_stock')
    .eq('ingredient_id', ingredientId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  console.log('Registro de inventario existente encontrado:', existing);

  let resultError;
  let resultData;

  if (existing) {
    // Si existe, actualizamos
    console.log('Ejecutando UPDATE en inventory para ingredient_id:', ingredientId);
    const { data, error } = await supabase
      .from('inventory')
      .update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq('ingredient_id', ingredientId)
      .select();
    resultError = error;
    resultData = data;
  } else {
    // Si no existe, buscamos la unidad en la tabla ingredients
    console.log('No existe registro en inventory. Buscando ingrediente en tabla ingredients...');
    const { data: ing, error: ingError } = await supabase
      .from('ingredients')
      .select('unit')
      .eq('id', ingredientId)
      .single();

    if (ingError) throw ingError;

    // E insertamos
    console.log('Ejecutando INSERT en inventory para ingredient_id:', ingredientId);
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        ingredient_id: ingredientId,
        current_stock: newStock,
        unit: ing.unit,
        updated_at: new Date().toISOString()
      })
      .select();
    resultError = error;
    resultData = data;
  }

  if (resultError) throw resultError;
  console.log('Resultado final de la consulta Supabase:', resultData);
  if (!resultData || resultData.length === 0) {
    throw new Error('No tienes permisos (RLS) para modificar este inventario.');
  }
}

/**
 * Descuenta del inventario múltiples ingredientes a la vez.
 * Usado al registrar una producción.
 * @param {Array<{ ingredientId: string, quantityUsed: number }>} usages
 */
export async function deductFromInventory(usages) {
  // Obtener stocks actuales
  const ids = usages.map((u) => u.ingredientId);
  const { data: stocks, error: fetchError } = await supabase
    .from('inventory')
    .select('ingredient_id, current_stock')
    .in('ingredient_id', ids);

  if (fetchError) throw fetchError;

  // Calcular nuevos stocks y actualizar
  const updates = usages.map((usage) => {
    const current = stocks.find((s) => s.ingredient_id === usage.ingredientId);
    const newStock = Math.max(0, (current?.current_stock ?? 0) - usage.quantityUsed);
    return updateStock(usage.ingredientId, newStock);
  });

  await Promise.all(updates);
}

/**
 * Devuelve al inventario múltiples ingredientes (operación inversa a deduct).
 * Usado al eliminar una producción.
 * @param {Array<{ ingredientId: string, quantityUsed: number }>} usages
 */
export async function addToInventory(usages) {
  const ids = usages.map((u) => u.ingredientId);
  const { data: stocks, error: fetchError } = await supabase
    .from('inventory')
    .select('ingredient_id, current_stock')
    .in('ingredient_id', ids);

  if (fetchError) throw fetchError;

  const updates = usages.map((usage) => {
    const current = stocks.find((s) => s.ingredient_id === usage.ingredientId);
    const newStock = (current?.current_stock ?? 0) + usage.quantityUsed;
    return updateStock(usage.ingredientId, newStock);
  });

  await Promise.all(updates);
}
