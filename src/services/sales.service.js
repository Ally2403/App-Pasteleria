/**
 * sales.service.js
 * CRUD de ventas, items de venta y estadísticas.
 */
import { supabase } from './supabase';
import { adjustProductStock } from './product_stock.service';

// ── Ventas ────────────────────────────────────────────────────────────────────

/**
 * Obtiene todas las ventas con sus items, recetas y quién las registró.
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
      ),
      profiles:created_by ( full_name )
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
 * Crea una venta o pedido con todos sus items.
 * Si es venta inmediata (sale_type='immediate'), descuenta el stock.
 * Si es pedido a futuro (sale_type='order'), NO descuenta stock —
 * el descuento ocurrirá cuando se marque como entregado.
 *
 * @param {object} saleData
 * @param {string|null}  saleData.customerId     - ID del cliente (null = sin registro)
 * @param {string|null}  saleData.customerName   - Nombre libre si no hay cliente
 * @param {string}       saleData.saleDate       - Fecha de registro YYYY-MM-DD
 * @param {string}       saleData.deliveryDate   - Fecha de entrega YYYY-MM-DD
 * @param {string}       saleData.saleType       - 'immediate' | 'order'
 * @param {string}       saleData.paymentMethod  - efectivo | transferencia | nequi | daviplata | otro
 * @param {number}       saleData.amountPaid     - Cuánto abonó el cliente
 * @param {string}       saleData.status         - pending | completed
 * @param {string}       [saleData.notes]
 * @param {number}       saleData.total
 * @param {string}       saleData.userId         - ID del usuario que registra
 *
 * @param {Array<{ recipeId, quantity, unitPrice }>} items
 */
export async function createSale(saleData, items) {
  const amountPaid  = saleData.amountPaid ?? 0;
  const isPaid      = amountPaid >= saleData.total;

  // 1. Crear la venta
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      customer_id:    saleData.customerId ?? null,
      customer_name:  saleData.customerName ?? null,
      sale_date:      saleData.saleDate,
      delivery_date:  saleData.deliveryDate ?? saleData.saleDate,
      sale_type:      saleData.saleType ?? 'immediate',
      payment_method: saleData.paymentMethod,
      is_paid:        isPaid,
      amount_paid:    amountPaid,
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

  // 3. Solo descontar stock si es venta INMEDIATA
  //    Los pedidos a futuro descuentan stock al marcarse como entregados.
  if (saleData.saleType === 'immediate' || !saleData.saleType) {
    for (const item of items) {
      await adjustProductStock(
        item.recipeId,
        -item.quantity,
        'sale',
        `Venta #${sale.id.slice(0, 8)} — ${item.quantity} unidades`,
        saleData.userId
      );
    }
  }

  return sale;
}

/**
 * Actualiza el estado de una venta (pendiente ↔ completada).
 * Si se marca como completada desde un pedido, descuenta el stock.
 * @param {string} saleId
 * @param {string} status - 'pending' | 'completed'
 * @param {boolean} isPaid
 * @param {string} [userId]
 */
export async function updateSaleStatus(saleId, status, isPaid, userId) {
  // Obtener la venta actual para saber si es pedido y si necesita descontar stock
  const { data: currentSale } = await supabase
    .from('sales')
    .select('status, sale_type, sale_items(recipe_id, quantity)')
    .eq('id', saleId)
    .single();

  const { data, error } = await supabase
    .from('sales')
    .update({ status, is_paid: isPaid })
    .eq('id', saleId)
    .select()
    .single();
  if (error) throw error;

  // Si es un pedido que acaba de marcarse como ENTREGADO (completed), descontar stock
  if (
    currentSale?.sale_type === 'order' &&
    currentSale?.status === 'pending' &&
    status === 'completed'
  ) {
    for (const item of (currentSale.sale_items ?? [])) {
      await adjustProductStock(
        item.recipe_id,
        -item.quantity,
        'sale',
        `Entrega de pedido #${saleId.slice(0, 8)} — ${item.quantity} unidades`,
        userId
      );
    }
  }

  return data;
}

/**
 * Registra o actualiza un abono del cliente en una venta.
 * @param {string} saleId
 * @param {number} newAmountPaid - El nuevo total acumulado de lo que pagó
 * @param {number} total - El total de la venta (para calcular is_paid)
 */
export async function updateSalePayment(saleId, newAmountPaid, total) {
  const isPaid = newAmountPaid >= total;
  const { data, error } = await supabase
    .from('sales')
    .update({
      amount_paid: newAmountPaid,
      is_paid: isPaid,
    })
    .eq('id', saleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Elimina una venta y sus items.
 * Solo devuelve stock si era venta inmediata ya completada o pedido entregado.
 * @param {string} saleId
 * @param {string} userId
 */
export async function deleteSale(saleId, userId) {
  // Obtener la venta y sus items antes de borrar
  const { data: saleToDelete } = await supabase
    .from('sales')
    .select('sale_type, status, sale_items(recipe_id, quantity)')
    .eq('id', saleId)
    .single();

  const { error } = await supabase.from('sales').delete().eq('id', saleId);
  if (error) throw error;

  // Devolver stock solo si el stock fue descontado:
  // - Venta inmediata (siempre se descontó al crear)
  // - Pedido que ya fue entregado (status = 'completed', se descontó al marcar entregado)
  const stockWasDiscounted =
    saleToDelete?.sale_type === 'immediate' ||
    (saleToDelete?.sale_type === 'order' && saleToDelete?.status === 'completed');

  if (stockWasDiscounted && saleToDelete?.sale_items) {
    for (const item of saleToDelete.sale_items) {
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

/**
 * Obtiene las próximas entregas (pedidos pendientes en los próximos días).
 * @param {number} daysAhead - Cuántos días hacia adelante mirar (default 14)
 */
export async function getUpcomingDeliveries(daysAhead = 14) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + daysAhead);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('sales')
    .select(`
      id, total, amount_paid, sale_date, delivery_date, status, customer_name, notes,
      customers ( id, name, phone ),
      sale_items (
        id, quantity, unit_price, subtotal,
        recipes ( id, name )
      ),
      profiles:created_by ( full_name )
    `)
    .eq('status', 'pending')
    .gte('delivery_date', todayStr)
    .lte('delivery_date', futureDateStr)
    .order('delivery_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ── Estadísticas ──────────────────────────────────────────────────────────────

/**
 * Obtiene estadísticas de ventas para un período dado.
 * @param {'day' | 'week' | 'month' | 'year'} period
 * @returns {Promise<{ totalSales: number, totalRevenue: number, salesCount: number, byProduct: Array }>}
 */
export async function getSalesStats(period = 'month') {
  let startISO;
  let endISO;

  if (typeof period === 'object' && period !== null) {
    startISO = period.startDate;
    endISO = period.endDate;
  } else {
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
    startISO = startDate.toISOString().split('T')[0];
  }

  let query = supabase
    .from('sales')
    .select(`
      id, total, amount_paid, sale_date, is_paid,
      sale_items (
        quantity, unit_price, subtotal,
        recipes ( id, name )
      )
    `);

  if (startISO) {
    query = query.gte('sale_date', startISO);
  }
  if (endISO) {
    query = query.lte('sale_date', endISO);
  }

  const { data: sales, error } = await query;

  if (error) throw error;

  const salesList = sales ?? [];
  const totalRevenue = salesList.reduce((sum, s) => sum + (s.total ?? 0), 0);
  const paidRevenue  = salesList.reduce((sum, s) => sum + (s.amount_paid ?? (s.is_paid ? s.total : 0)), 0);
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
      id, total, amount_paid, sale_date, delivery_date, sale_type, is_paid, status, customer_name,
      customers ( name ),
      sale_items (
        quantity,
        recipes ( name )
      ),
      profiles:created_by ( full_name )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
