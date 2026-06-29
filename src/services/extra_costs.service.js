/**
 * extra_costs.service.js
 * CRUD de conceptos de costos extra (empaques, mano de obra, etc.)
 */
import { supabase } from './supabase';
import { getOrCreateProvider } from './providers.service';

/**
 * Obtiene todos los conceptos de costo extra ordenados por nombre.
 */
export async function getExtraCostItems() {
  const { data, error } = await supabase
    .from('extra_cost_items')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

/**
 * Crea un nuevo concepto de costo extra.
 * @param {{ name: string, type: string, quantity_sold: number, price: number }} item
 */
export async function createExtraCostItem(item) {
  const qty = parseFloat(item.quantity_sold) || 1;
  const prc = parseFloat(item.price) || 0;
  const unitPrice = qty > 0 ? prc / qty : 0;

  if (item.provider) {
    await getOrCreateProvider(item.provider);
  }

  const { data, error } = await supabase
    .from('extra_cost_items')
    .insert({
      name:          item.name.trim(),
      type:          item.type,
      quantity_sold: qty,
      price:         prc,
      unit_price:    unitPrice,
      provider:      item.provider?.trim() || null,
      current_stock: item.current_stock !== undefined ? parseFloat(item.current_stock) : 0,
      has_inventory: item.has_inventory !== undefined ? !!item.has_inventory : (item.type === 'packaging'),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Obtiene o crea un concepto si no existe.
 */
export async function getOrCreateExtraCostItem(name, type, price) {
  if (!name?.trim()) return null;

  const { data: existing } = await supabase
    .from('extra_cost_items')
    .select('*')
    .ilike('name', name.trim())
    .maybeSingle();

  if (existing) return existing;

  return await createExtraCostItem({ name, type, quantity_sold: 1, price: price });
}

/**
 * Actualiza un concepto de costo extra.
 */
export async function updateExtraCostItem(id, updates) {
  const qty = parseFloat(updates.quantity_sold) || 1;
  const prc = parseFloat(updates.price) || 0;
  const unitPrice = qty > 0 ? prc / qty : 0;

  if (updates.provider) {
    await getOrCreateProvider(updates.provider);
  }

  const { data, error } = await supabase
    .from('extra_cost_items')
    .update({
      name:          updates.name?.trim(),
      type:          updates.type,
      quantity_sold: qty,
      price:         prc,
      unit_price:    unitPrice,
      provider:      updates.provider?.trim() || null,
      current_stock: updates.current_stock !== undefined ? parseFloat(updates.current_stock) : undefined,
      has_inventory: updates.has_inventory !== undefined ? !!updates.has_inventory : undefined,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Elimina un concepto de costo extra.
 */
export async function deleteExtraCostItem(id) {
  const { error } = await supabase
    .from('extra_cost_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * Descuenta del stock de empaques (extra_cost_items) los usados en la producción.
 * Solo descuenta aquellos que tienen habilitado el inventario (has_inventory = true).
 * @param {Array} items - [{ extraCostItemId, quantityUsed }]
 */
export async function deductExtraCostsFromInventory(items) {
  if (!items || items.length === 0) return;

  for (const item of items) {
    if (!item.extraCostItemId) continue;

    // Obtener stock actual y si maneja inventario
    const { data: costItem, error: fetchError } = await supabase
      .from('extra_cost_items')
      .select('current_stock, has_inventory')
      .eq('id', item.extraCostItemId)
      .single();

    if (fetchError || !costItem || !costItem.has_inventory) continue;

    const newStock = Math.max(0, (costItem.current_stock || 0) - item.quantityUsed);

    await supabase
      .from('extra_cost_items')
      .update({ current_stock: newStock })
      .eq('id', item.extraCostItemId);
  }
}

/**
 * Agrega al stock de empaques (reversión de producción).
 * @param {Array} items - [{ extraCostItemId, quantityUsed }]
 */
export async function addExtraCostsToInventory(items) {
  if (!items || items.length === 0) return;

  for (const item of items) {
    if (!item.extraCostItemId) continue;

    const { data: costItem, error: fetchError } = await supabase
      .from('extra_cost_items')
      .select('current_stock, has_inventory')
      .eq('id', item.extraCostItemId)
      .single();

    if (fetchError || !costItem || !costItem.has_inventory) continue;

    const newStock = (costItem.current_stock || 0) + item.quantityUsed;

    await supabase
      .from('extra_cost_items')
      .update({ current_stock: newStock })
      .eq('id', item.extraCostItemId);
  }
}
