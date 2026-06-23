/**
 * formatters.js
 *
 * Utilidades de formato para moneda, unidades y fechas.
 * Configuradas para Colombia (COP, es-CO).
 */

// ── Moneda ────────────────────────────────────────────────────────────────────

/**
 * Formatea un número como moneda colombiana (COP).
 * Ej: 73837 → "$ 73.837"
 * @param {number} value
 * @param {boolean} [compact=false] - Formato compacto para espacios pequeños
 * @returns {string}
 */
export function formatCurrency(value, compact = false) {
  if (value === null || value === undefined || isNaN(value)) return '$ 0';

  if (compact && value >= 1_000_000) {
    return `$ ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (compact && value >= 1_000) {
    return `$ ${(value / 1_000).toFixed(0)}K`;
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace('COP', '$')
    .trim();
}

/**
 * Formatea un número como moneda sin el símbolo.
 * Ej: 73837 → "73.837"
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('es-CO').format(Math.round(value));
}

// ── Unidades ──────────────────────────────────────────────────────────────────

/**
 * Lista de unidades disponibles en la app.
 */
export const UNITS = [
  { value: 'gr',     label: 'Gramos (gr)' },
  { value: 'kg',     label: 'Kilogramos (kg)' },
  { value: 'ml',     label: 'Mililitros (ml)' },
  { value: 'lt',     label: 'Litros (lt)' },
  { value: 'unidad', label: 'Unidad' },
  { value: 'hoja',   label: 'Hoja' },
  { value: 'taza',   label: 'Taza' },
  { value: 'cdta',   label: 'Cucharadita' },
  { value: 'cda',    label: 'Cucharada' },
];

/**
 * Devuelve la etiqueta legible de una unidad.
 * @param {string} unit
 * @returns {string}
 */
export function getUnitLabel(unit) {
  return UNITS.find((u) => u.value === unit)?.label ?? unit;
}

/**
 * Formatea una cantidad con su unidad.
 * Ej: formatQuantity(500, 'gr') → "500 gr"
 * @param {number} quantity
 * @param {string} unit
 * @returns {string}
 */
export function formatQuantity(quantity, unit) {
  if (quantity === null || quantity === undefined) return `0 ${unit}`;
  return `${formatNumber(quantity)} ${unit}`;
}

// ── Tipos de costo extra ──────────────────────────────────────────────────────

export const EXTRA_COST_TYPES = [
  { value: 'packaging', label: '📦 Empaque' },
  { value: 'service',   label: '💡 Servicio' },
  { value: 'labor',     label: '👐 Mano de obra' },
  { value: 'other',     label: '📋 Otro' },
];

/**
 * Devuelve la etiqueta de un tipo de costo extra.
 * @param {string} type
 * @returns {string}
 */
export function getExtraCostTypeLabel(type) {
  return EXTRA_COST_TYPES.find((t) => t.value === type)?.label ?? type;
}

// ── Fechas ────────────────────────────────────────────────────────────────────

/**
 * Formatea una fecha ISO en formato legible en español.
 * Ej: "2024-01-15T10:30:00Z" → "15 de enero de 2024"
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

/**
 * Formatea una fecha con hora.
 * Ej: "15 ene 2024, 10:30 a. m."
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDateTime(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD.
 * @returns {string}
 */
export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ── Porcentajes ───────────────────────────────────────────────────────────────

/**
 * Formatea un número como porcentaje.
 * Ej: 50 → "50%"
 * @param {number} value
 * @returns {string}
 */
export function formatPercentage(value) {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${value}%`;
}

// ── Texto ─────────────────────────────────────────────────────────────────────

/**
 * Trunca un texto largo con "..." al final.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(text, maxLength = 40) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Convierte la primera letra de un string a mayúscula.
 * @param {string} text
 * @returns {string}
 */
export function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
