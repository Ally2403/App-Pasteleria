/**
 * auth.service.js
 * Todas las operaciones de autenticación con Supabase.
 */
import { supabase } from './supabase';

/**
 * Inicia sesión con email y contraseña.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user, profile, error }>}
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { user: null, profile: null, error };

  // Obtener el perfil del usuario (rol, nombre)
  const profile = await getProfile(data.user.id);
  return { user: data.user, profile, error: null };
}

/**
 * Cierra la sesión del usuario actual.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Error al cerrar sesión:', error);
}

/**
 * Obtiene el perfil extendido del usuario (rol, nombre).
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error al obtener perfil:', error);
    return null;
  }
  return data;
}

/**
 * Obtiene la sesión activa actual.
 * @returns {Promise<{ session, user, profile }>}
 */
export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return { session: null, user: null, profile: null };

  const profile = await getProfile(session.user.id);
  return { session, user: session.user, profile };
}

/**
 * Escucha cambios en el estado de autenticación.
 * @param {Function} callback - (event, session) => void
 * @returns Unsubscribe function
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
