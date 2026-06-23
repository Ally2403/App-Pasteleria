/**
 * sales.service.js
 * CRUD de ventas, items de venta y estadísticas.
 */
import { supabase } from './supabase';
import { adjustProductStock } from './product_stock.service';

// ── Ventas ────────────────────────────────────────────────────────────────────

/**
 * Obtiene todas las ventas con sus items y recetas.
 * @param {{ status?: string, startDate?: string, endDate?: string }} filters
 */
export async function getSales(filters = {}) {
  let query = supabase
    .from('sales')
    .select(`
      *,
      customers ( id, name, phone ),
      sale_items (
        id, quantity, unit_price, subtotal,
        recipes ( id, name )
      )
    `)
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.startDate) {
    query = query.gte('sale_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('sale_date', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Crea una venta con todos sus items y descuenta el stock de productos.
 *
 * @param {object} saleData
 * @param {string|null}  saleData.customerId     - ID del cliente (null = sin registro)
 * @param {string|null}  saleData.customerName   - Nombre libre si no hay cliente
 * @param {string}       saleData.saleDate       - Fecha YYYY-MM-DD
 * @param {string}       saleData.paymentMethod  - efectivo | transferencia | nequi | daviplata | otro
 * @param {boolean}      saleData.isPaid         - ¿Ya pagó?
 * @param {string}       saleData.status         - pending | completed
 * @param {string}       [saleData.notes]
 * @param {number}       saleData.total
 * @param {string}       saleData.userId         - ID del usuario que registra
 *
 * @param {Array<{ recipeId, quantity, unitPrice }>} items
 */
export async function createSale(saleData, items) {
  // 1. Crear la venta
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      customer_id:    saleData.customerId ?? null,
      customer_name:  saleData.customerName ?? null,
      sale_date:      saleData.saleDate,
      payment_method: saleData.paymentMethod,
      is_paid:        saleData.isPaid,
      status:         saleData.status,
      notes:          saleData.notes ?? null,
      total:          saleData.total,
      created_by:     saleData.userId ?? null,
    })
    .select()
    .single();

  if (saleError) throw saleError;

  // 2. Insertar items de la venta
  const saleItems = items.map((item) => ({
    sale_id:    sale.id,
    recipe_id:  item.recipeId,
    quantity:   item.quantity,
    unit_price: item.unitPrice,
    subtotal:   item.quantity * item.unitPrice,
  }));

  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(saleItems);

  if (itemsError) throw itemsError;

  // 3. Descontar del stock de productos terminados
  for (const item of items) {
    await adjustProductStock(
      item.recipeId,
      -item.quantity,
      'sale',
      `Venta #${sale.id.slice(0, 8)} — ${item.quantity} unidades`,
      saleData.userId
    );
  }

  return sale;
}

/**
 * Actualiza el estado de una venta (pendiente ↔ completada).
 * @param {string} saleId
 * @param {string} status - 'pending' | 'completed'
 * @param {boolean} isPaid
 */
export async function updateSaleStatus(saleId, status, isPaid) {
  const { data, error } = await supabase
    .from('sales')
    .update({ status, is_paid: isPaid })
    .eq('id', saleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Elimina una venta y sus items (devuelve stock).
 * @param {string} saleId
 * @param {string} userId
 */
export async function deleteSale(saleId, userId) {
  // Obtener los items antes de borrar para devolver el stock
  const { data: items } = await supabase
    .from('sale_items')
    .select('recipe_id, quantity')
    .eq('sale_id', saleId);

  const { error } = await supabase.from('sales').delete().eq('id', saleId);
  if (error) throw error;

  // Devolver el stock de los productos
  if (items) {
    for (const item of items) {
      await adjustProductStock(
        item.recipe_id,
        item.quantity,
        'other',
        'Venta eliminada — stock devuelto',
        userId
      );
    }
  }
}

// ── Estadísticas ──────────────────────────────────────────────────────────────

/**
 * Obtiene estadísticas de ventas para un período dado.
 * @param {'day' | 'week' | 'month' | 'year'} period
 * @returns {Promise<{ totalSales: number, totalRevenue: number, salesCount: number, byProduct: Array }>}
 */
export async function getSalesStats(period = 'month') {
  const now = new Date();
  let startDate;

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const startISO = startDate.toISOString().split('T')[0];

  const { data: sales, error } = await supabase
    .from('sales')
    .select(`
      id, total, sale_date, is_paid,
      sale_items (
        quantity, unit_price, subtotal,
        recipes ( id, name )
      )
    `)
    .gte('sale_date', startISO);

  if (error) throw error;

  const salesList = sales ?? [];
  const totalRevenue = salesList.reduce((sum, s) => sum + (s.total ?? 0), 0);
  const paidRevenue  = salesList.filter(s => s.is_paid).reduce((sum, s) => sum + (s.total ?? 0), 0);
  const pendingRevenue = totalRevenue - paidRevenue;

  // Agrupar por producto
  const productMap = {};
  salesList.forEach((sale) => {
    (sale.sale_items ?? []).forEach((item) => {
      const recipeId = item.recipes?.id;
      if (!recipeId) return;
      if (!productMap[recipeId]) {
        productMap[recipeId] = {
          recipeId,
          recipeName: item.recipes?.name ?? 'Sin nombre',
          totalQty: 0,
          totalRevenue: 0,
        };
      }
      productMap[recipeId].totalQty += item.quantity;
      productMap[recipeId].totalRevenue += item.subtotal;
    });
  });

  const byProduct = Object.values(productMap).sort(
    (a, b) => b.totalRevenue - a.totalRevenue
  );

  return {
    salesCount:     salesList.length,
    totalRevenue,
    paidRevenue,
    pendingRevenue,
    byProduct,
  };
}

/**
 * Obtiene las ventas recientes (para dashboard).
 * @param {number} limit
 */
export async function getRecentSales(limit = 5) {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id, total, sale_date, is_paid, status, customer_name,
      customers ( name ),
      sale_items (
        quantity,
        recipes ( name )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
