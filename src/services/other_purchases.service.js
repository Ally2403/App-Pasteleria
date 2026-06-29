import { supabase } from './supabase';

/**
 * Obtener compras no programadas
 */
export async function getOtherPurchases() {
  const { data, error } = await supabase
    .from('other_purchases')
    .select(`
      *,
      profiles:created_by (full_name)
    `)
    .order('purchase_date', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Crear una nueva compra no programada
 */
export async function createOtherPurchase(purchaseData) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('other_purchases')
    .insert([
      {
        name: purchaseData.name,
        price: parseFloat(purchaseData.price),
        quantity: parseInt(purchaseData.quantity),
        category: purchaseData.category,
        purchase_date: purchaseData.purchase_date,
        notes: purchaseData.notes || null,
        created_by: user?.id || null
      }
    ])
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * Actualizar una compra no programada existente
 */
export async function updateOtherPurchase(id, purchaseData) {
  const { data, error } = await supabase
    .from('other_purchases')
    .update({
      name: purchaseData.name,
      price: parseFloat(purchaseData.price),
      quantity: parseInt(purchaseData.quantity),
      category: purchaseData.category,
      purchase_date: purchaseData.purchase_date,
      notes: purchaseData.notes || null
    })
    .eq('id', id)
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * Eliminar una compra no programada
 */
export async function deleteOtherPurchase(id) {
  const { error } = await supabase
    .from('other_purchases')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}
