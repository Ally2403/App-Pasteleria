/**
 * providers.service.js
 * CRUD de proveedores.
 */
import { supabase } from './supabase';

/**
 * Obtiene todos los proveedores ordenados por nombre.
 */
export async function getProviders() {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

/**
 * Crea un proveedor nuevo.
 * @param {string} name
 */
export async function createProvider(name) {
  const { data, error } = await supabase
    .from('providers')
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Obtiene un proveedor por nombre o lo crea si no existe.
 * Útil para crear proveedores automáticamente al ingresar ingredientes.
 * @param {string} name
 * @returns {Promise<object>}
 */
export async function getOrCreateProvider(name) {
  if (!name?.trim()) return null;

  // Buscar por nombre (case-insensitive)
  const { data: existing } = await supabase
    .from('providers')
    .select('*')
    .ilike('name', name.trim())
    .maybeSingle();

  if (existing) return existing;

  // Crear nuevo
  return await createProvider(name);
}

/**
 * Elimina un proveedor.
 * @param {string} id
 */
export async function deleteProvider(id) {
  const { error } = await supabase.from('providers').delete().eq('id', id);
  if (error) throw error;
}
