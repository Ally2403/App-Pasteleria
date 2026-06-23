/**
 * calculations.js
 *
 * Funciones puras para todos los cálculos de costos y ganancias.
 * 100% testeables — no tienen efectos secundarios ni dependencias externas.
 */

/**
 * Calcula el precio unitario de un ingrediente.
 * Ej: 500 gr por $8,750 → precio por gr = $17.5
 * @param {number} price - Precio total de la cantidad vendida
 * @param {number} quantity - Cantidad vendida por el proveedor
 * @returns {number} Precio por unidad mínima
 */
export function calcUnitPrice(price, quantity) {
  if (!quantity || quantity === 0) return 0;
  return price / quantity;
}

/**
 * Calcula el costo de un ingrediente usado en una receta.
 * @param {number} unitPrice - Precio por unidad mínima del ingrediente
 * @param {number} quantityUsed - Cantidad usada en la receta
 * @returns {number} Costo total del ingrediente en la receta
 */
export function calcIngredientCost(unitPrice, quantityUsed) {
  return unitPrice * quantityUsed;
}

/**
 * Suma todos los costos de ingredientes de una receta.
 * @param {Array<{unitPrice: number, quantityUsed: number}>} ingredients
 * @returns {number} Costo total de ingredientes
 */
export function calcTotalIngredientsCost(ingredients) {
  return ingredients.reduce((sum, ing) => {
    return sum + calcIngredientCost(ing.unitPrice, ing.quantityUsed);
  }, 0);
}

/**
 * Suma todos los costos extra (empaques, servicios, mano de obra).
 * @param {Array<{quantity: number, unitPrice: number}>} extraCosts
 * @returns {number} Total de costos extra
 */
export function calcTotalExtraCosts(extraCosts) {
  return extraCosts.reduce((sum, cost) => {
    return sum + cost.quantity * cost.unitPrice;
  }, 0);
}

/**
 * Calcula el costo total de una bandeja completa.
 * @param {number} ingredientsCost - Total de ingredientes
 * @param {number} extraCosts - Total de costos extra
 * @returns {number} Costo total por bandeja
 */
export function calcBatchCost(ingredientsCost, extraCosts) {
  return ingredientsCost + extraCosts;
}

/**
 * Calcula el costo por unidad individual.
 * @param {number} batchCost - Costo total de la bandeja
 * @param {number} unitsPerBatch - Unidades que salen por bandeja
 * @returns {number} Costo individual por unidad
 */
export function calcUnitCost(batchCost, unitsPerBatch) {
  if (!unitsPerBatch || unitsPerBatch === 0) return 0;
  return batchCost / unitsPerBatch;
}

/**
 * Calcula el precio de venta sugerido (antes de redondear).
 * Ej: costo $3,692 + 50% → $5,538
 * @param {number} unitCost - Costo individual por unidad
 * @param {number} profitPercentage - Porcentaje de ganancia (ej: 50 para 50%)
 * @returns {number} Precio sugerido
 */
export function calcSuggestedPrice(unitCost, profitPercentage) {
  return unitCost * (1 + profitPercentage / 100);
}

/**
 * Calcula la ganancia por unidad individual.
 * @param {number} sellingPrice - Precio de venta redondeado
 * @param {number} unitCost - Costo individual
 * @returns {number} Ganancia por unidad
 */
export function calcProfitPerUnit(sellingPrice, unitCost) {
  return sellingPrice - unitCost;
}

/**
 * Calcula la ganancia total de vender toda la bandeja.
 * @param {number} profitPerUnit - Ganancia por unidad
 * @param {number} unitsPerBatch - Total de unidades por bandeja
 * @returns {number} Ganancia total de la bandeja
 */
export function calcTotalBatchProfit(profitPerUnit, unitsPerBatch) {
  return profitPerUnit * unitsPerBatch;
}

/**
 * Calcula la mano de obra total de la receta.
 * @param {Array<{quantity: number, unitPrice: number, type: string}>} extraCosts
 * @returns {number} Total de mano de obra
 */
export function calcLaborCost(extraCosts) {
  return extraCosts
    .filter((cost) => cost.type === 'labor')
    .reduce((sum, cost) => sum + cost.quantity * cost.unitPrice, 0);
}

/**
 * Calcula las ganancias desglosadas cuando hay un socio.
 *
 * Lógica (según el Excel de Cecilia):
 * - La ganancia total de la bandeja se divide en 2 partes iguales
 * - El socio (Jhon) se lleva la mitad de la ganancia
 * - Cecilia se lleva la otra mitad + la mano de obra total (íntegra, porque ella la trabajó)
 *
 * Ejemplo: ganancia total $6000, mano de obra $3000
 *   Jhon  = $6000 / 2 = $3000
 *   Cecilia = $3000 + $3000 = $6000
 *
 * @param {number} totalProfit - Ganancia total de la bandeja (precio venta - costo) × unidades
 * @param {number} laborCost - Mano de obra total (va íntegra a Cecilia además de su mitad)
 * @returns {{ ownerProfit: number, partnerProfit: number }}
 */
export function calcProfitSplit(totalProfit, laborCost) {
  const partnerProfit = totalProfit / 2;
  const ownerProfit = totalProfit / 2 + laborCost;
  return { ownerProfit, partnerProfit };
}

/**
 * Calcula cuánto queda en inventario después de usar una cantidad.
 * @param {number} currentStock - Stock actual
 * @param {number} used - Cantidad usada
 * @returns {number} Stock restante (nunca negativo)
 */
export function calcRemainingStock(currentStock, used) {
  return Math.max(0, currentStock - used);
}

/**
 * Calcula cuánto se necesita comprar de un ingrediente para hacer una receta,
 * teniendo en cuenta el stock actual y la cantidad mínima de venta del proveedor.
 *
 * @param {number} needed - Cantidad requerida para la receta
 * @param {number} currentStock - Stock disponible actualmente
 * @param {number} minProviderQty - Cantidad mínima que vende el proveedor
 * @returns {{ shortage: number, toBuy: number, enoughInStock: boolean }}
 */
export function calcToBuy(needed, currentStock, minProviderQty) {
  const shortage = Math.max(0, needed - currentStock);

  if (shortage === 0) {
    return { shortage: 0, toBuy: 0, enoughInStock: true };
  }

  // Si la escasez es menor que el mínimo del proveedor, comprar el mínimo
  const toBuy = shortage < minProviderQty ? minProviderQty : shortage;
  return { shortage, toBuy, enoughInStock: false };
}

/**
 * Genera el resumen completo de costos y ganancias de una receta.
 * Función de alto nivel que combina todas las anteriores.
 *
 * @param {object} params
 * @param {Array}  params.ingredients     - [{unitPrice, quantityUsed}]
 * @param {Array}  params.extraCosts      - [{quantity, unitPrice, type}]
 * @param {number} params.unitsPerBatch   - Unidades por bandeja
 * @param {number} params.profitPercentage- Porcentaje de ganancia (ej: 50)
 * @param {number} params.roundedPrice    - Precio redondeado final
 * @param {boolean}params.hasPartner      - ¿Tiene socio?
 * @returns {object} Resumen completo de la receta
 */
export function calcRecipeSummary({
  ingredients,
  extraCosts,
  unitsPerBatch,
  profitPercentage,
  roundedPrice,
  hasPartner,
}) {
  const ingredientsCost = calcTotalIngredientsCost(ingredients);
  const extraCostsTotal = calcTotalExtraCosts(extraCosts);
  const batchCost       = calcBatchCost(ingredientsCost, extraCostsTotal);
  const unitCost        = calcUnitCost(batchCost, unitsPerBatch);
  const suggestedPrice  = calcSuggestedPrice(unitCost, profitPercentage);
  const sellingPrice    = roundedPrice ?? suggestedPrice;
  const profitPerUnit   = calcProfitPerUnit(sellingPrice, unitCost);
  const totalProfit     = calcTotalBatchProfit(profitPerUnit, unitsPerBatch);
  const laborCost       = calcLaborCost(extraCosts);
  const totalRevenue    = sellingPrice * unitsPerBatch;

  const split = hasPartner
    ? calcProfitSplit(totalProfit, laborCost)
    : { ownerProfit: totalProfit, partnerProfit: 0 };

  return {
    ingredientsCost,
    extraCostsTotal,
    batchCost,
    unitCost,
    suggestedPrice,
    sellingPrice,
    profitPerUnit,
    totalProfit,
    laborCost,
    totalRevenue,
    ownerProfit:   split.ownerProfit,
    partnerProfit: split.partnerProfit,
  };
}

/**
 * Obtiene el objeto de precios de una receta de forma robusta,
 * soportando si Supabase lo devuelve como objeto (1-1) o como array.
 * @param {object} recipe
 * @returns {object} Objeto de precios o un objeto vacío
 */
export function getRecipePricing(recipe) {
  if (!recipe) return {};
  const rp = recipe.recipe_pricing;
  if (!rp) return {};
  return Array.isArray(rp) ? (rp[0] ?? {}) : rp;
}

