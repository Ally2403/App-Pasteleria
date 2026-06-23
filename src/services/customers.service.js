/**
 * customers.service.js
 * CRUD de clientes.
 */
import { supabase } from './supabase';

/**
 * Obtiene todos los clientes ordenados por nombre.
 */
export async function getCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

/**
 * Busca clientes por nombre (para autocomplete en ventas).
 * @param {string} query
 */
export async function searchCustomers(query) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

/**
 * Crea un cliente nuevo.
 * @param {{ name: string, phone?: string, notes?: string }} customer
 */
export async function createCustomer(customer) {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name:  customer.name.trim(),
      phone: customer.phone?.trim() ?? null,
      notes: customer.notes?.trim() ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Actualiza un cliente.
 * @param {string} id
 * @param {object} updates
 */
export async function updateCustomer(id, updates) {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Busca un cliente por nombre exacto (case-insensitive) o lo crea si no existe.
 * Usado al registrar ventas para auto-registrar clientes nuevos.
 * @param {string} name
 * @returns {Promise<object>} El cliente existente o recién creado
 */
export async function getOrCreateCustomerByName(name) {
  const trimmed = name.trim();
  // Intentar encontrar por nombre (insensible a mayúsculas)
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .ilike('name', trimmed)
    .maybeSingle();

  if (existing) return existing;

  // Si no existe, crear uno nuevo
  const { data: created, error } = await supabase
    .from('customers')
    .insert({ name: trimmed })
    .select()
    .single();

  if (error) throw error;
  return created;
}

/**
 * Obtiene todos los clientes con un resumen de sus compras en un periodo.
 * @param {string|null} startDate  - YYYY-MM-DD o null para todo
 * @param {string|null} endDate    - YYYY-MM-DD o null para todo
 * @returns {Promise<Array>}
 */
export async function getCustomersWithHistory(startDate = null, endDate = null) {
  // Traer clientes
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('*')
    .order('name');
  if (custError) throw custError;

  if (!customers?.length) return [];

  // Traer ventas del periodo filtradas por customer_id
  let salesQuery = supabase
    .from('sales')
    .select(`
      id, total, sale_date, is_paid, customer_id,
      sale_items (
        quantity, subtotal,
        recipes ( id, name )
      )
    `)
    .not('customer_id', 'is', null)
    .order('sale_date', { ascending: false });

  if (startDate) salesQuery = salesQuery.gte('sale_date', startDate);
  if (endDate)   salesQuery = salesQuery.lte('sale_date', endDate);

  const { data: sales, error: salesError } = await salesQuery;
  if (salesError) throw salesError;

  // Agrupar ventas por customer_id
  const salesByCustomer = {};
  (sales ?? []).forEach((sale) => {
    const cid = sale.customer_id;
    if (!salesByCustomer[cid]) salesByCustomer[cid] = [];
    salesByCustomer[cid].push(sale);
  });

  // Construir resumen por cliente
  return customers.map((c) => {
    const customerSales = salesByCustomer[c.id] ?? [];
    const totalSpent    = customerSales.reduce((sum, s) => sum + (s.total ?? 0), 0);
    const ordersCount   = customerSales.length;

    // Conteo de productos comprados
    const productMap = {};
    customerSales.forEach((sale) => {
      (sale.sale_items ?? []).forEach((item) => {
        const rid = item.recipes?.id;
        if (!rid) return;
        if (!productMap[rid]) productMap[rid] = { name: item.recipes.name, qty: 0 };
        productMap[rid].qty += item.quantity;
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      ...c,
      _stats: { totalSpent, ordersCount, topProducts, recentSales: customerSales.slice(0, 5) },
    };
  });
}

/**
 * Elimina un cliente.
 * @param {string} id
 */
export async function deleteCustomer(id) {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}
