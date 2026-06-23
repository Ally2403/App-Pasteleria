/**
 * permissions.js
 *
 * Sistema de permisos extensible.
 * Para dar más acceso a Jhon (u otros roles), solo modifica ROLE_PERMISSIONS.
 * No necesitas tocar ningún otro archivo de la app.
 */

// ── Catálogo de permisos disponibles ──────────────────────────────────────────
export const PERMISSIONS = {
  // Ingredientes
  VIEW_INGREDIENTS:   'view_ingredients',
  MANAGE_INGREDIENTS: 'manage_ingredients',   // crear, editar, eliminar

  // Inventario
  VIEW_INVENTORY:     'view_inventory',
  MANAGE_INVENTORY:   'manage_inventory',

  // Recetas
  VIEW_RECIPES:       'view_recipes',
  MANAGE_RECIPES:     'manage_recipes',        // crear, editar, eliminar

  // Ver detalles de costos completos (precios de ingredientes, márgenes)
  VIEW_COST_DETAILS:  'view_cost_details',

  // Ganancias
  VIEW_OWN_PROFIT:    'view_own_profit',       // ver solo su parte de ganancia
  VIEW_ALL_PROFITS:   'view_all_profits',      // ver todas las ganancias y costos

  // Producción
  VIEW_PRODUCTION:    'view_production',
  MANAGE_PRODUCTION:  'manage_production',     // registrar producciones

  // Lista de compras
  VIEW_SHOPPING_LIST: 'view_shopping_list',

  // Ventas
  VIEW_SALES:         'view_sales',
  MANAGE_SALES:       'manage_sales',          // crear, editar ventas

  // Clientes
  VIEW_CUSTOMERS:     'view_customers',
  MANAGE_CUSTOMERS:   'manage_customers',

  // Proveedores
  VIEW_PROVIDERS:     'view_providers',

  // Plantillas de Costos Extra
  VIEW_EXTRA_COST_ITEMS:   'view_extra_cost_items',
  MANAGE_EXTRA_COST_ITEMS: 'manage_extra_cost_items',

  // Administración de usuarios (futuro)
  MANAGE_USERS:       'manage_users',
};

// ── Permisos por rol ──────────────────────────────────────────────────────────
// Para ampliar el acceso de Jhon: agrega permisos al array 'partner'.
export const ROLE_PERMISSIONS = {
  admin: Object.values(PERMISSIONS), // Admin tiene TODO

  partner: [
    PERMISSIONS.VIEW_RECIPES,
    PERMISSIONS.VIEW_OWN_PROFIT,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.MANAGE_SALES,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.VIEW_PRODUCTION,
    PERMISSIONS.VIEW_INGREDIENTS,
    PERMISSIONS.VIEW_SHOPPING_LIST,
    PERMISSIONS.VIEW_PROVIDERS,
    PERMISSIONS.VIEW_EXTRA_COST_ITEMS,
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verifica si un rol tiene un permiso específico.
 * @param {string} role - El rol del usuario ('admin' | 'partner')
 * @param {string} permission - La constante de permiso a verificar
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return permissions.includes(permission);
}

/**
 * Retorna todos los permisos de un rol.
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissions(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Verifica si el usuario tiene TODOS los permisos indicados.
 * @param {string} role
 * @param {string[]} permissions
 * @returns {boolean}
 */
export function hasAllPermissions(role, permissions) {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Verifica si el usuario tiene AL MENOS UNO de los permisos indicados.
 * @param {string} role
 * @param {string[]} permissions
 * @returns {boolean}
 */
export function hasAnyPermission(role, permissions) {
  return permissions.some((p) => hasPermission(role, p));
}
