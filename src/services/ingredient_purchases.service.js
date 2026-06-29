/**
 * ingredient_purchases.service.js
 * Registro de compras reales de ingredientes y empaques.
 * Estas son los egresos reales del negocio.
 */
import { supabase } from './supabase';

/**
 * Obtiene todas las compras registradas, más recientes primero.
 * @param {{ startDate?: string, endDate?: string }} filters
 */
export async function getIngredientPurchases(filters = {}) {
  let query = supabase
    .from('ingredient_purchases')
    .select('*')
    .order('purchase_date', { ascending: false });

  if (filters.startDate) {
    query = query.gte('purchase_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('purchase_date', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Registra una compra de ingredientes o empaques.
 * @param {{ purchase_date: string, total_spent: number, category: 'ingredients'|'packaging', notes?: string }} purchase
 */
export async function addIngredientPurchase(purchase) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('ingredient_purchases')
    .insert({
      purchase_date: purchase.purchase_date,
      total_spent:   parseFloat(purchase.total_spent) || 0,
      category:      purchase.category || 'ingredients',
      notes:         purchase.notes?.trim() || null,
      created_by:    user?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Elimina un registro de compra.
 * @param {string} id
 */
export async function deleteIngredientPurchase(id) {
  const { error } = await supabase
    .from('ingredient_purchases')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
