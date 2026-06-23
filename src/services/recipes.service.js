/**
 * recipes.service.js
 * CRUD de recetas, ingredientes de receta y costos extra.
 */
import { supabase } from './supabase';

/**
 * Obtiene todas las recetas.
 * Si role es 'partner', filtra solo las recetas donde es socio.
 * @param {{ role: string, userId: string }} user
 * @returns {Promise<Array>}
 */
export async function getRecipes({ role, userId } = {}) {
  let query = supabase
    .from('recipes')
    .select(`
      *,
      profiles:partner_id ( full_name ),
      recipe_pricing ( * )
    `)
    .order('created_at', { ascending: false });

  if (role === 'partner') {
    query = query.eq('partner_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Obtiene todas las recetas con detalles completos de ingredientes y costos extra.
 */
export async function getDetailedRecipes({ role, userId } = {}) {
  let query = supabase
    .from('recipes')
    .select(`
      *,
      profiles:partner_id ( full_name ),
      recipe_ingredients (
        id,
        quantity_used,
        ingredients ( id, name, unit, unit_price, provider, quantity_sold, price )
      ),
      recipe_extra_costs ( * ),
      recipe_pricing ( * )
    `)
    .order('created_at', { ascending: false });

  if (role === 'partner') {
    query = query.eq('partner_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Obtiene una receta completa con todos sus detalles.
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getRecipeById(id) {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      profiles:partner_id ( id, full_name ),
      recipe_ingredients (
        id,
        quantity_used,
        ingredients ( 
          id, name, unit, unit_price, provider, quantity_sold, price,
          inventory ( current_stock, unit )
        )
      ),
      recipe_extra_costs ( * ),
      recipe_pricing ( * )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;

  // Normalizar inventory anidado en recipe_ingredients (mismo fix que getIngredients)
  if (data?.recipe_ingredients) {
    data.recipe_ingredients = data.recipe_ingredients.map((ri) => ({
      ...ri,
      ingredients: ri.ingredients
        ? {
            ...ri.ingredients,
            inventory: Array.isArray(ri.ingredients.inventory)
              ? ri.ingredients.inventory
              : ri.ingredients.inventory
                ? [ri.ingredients.inventory]
                : [],
          }
        : ri.ingredients,
    }));
  }

  return data;
}

/**
 * Crea una nueva receta con sus ingredientes, costos extra y precios.
 * @param {object} recipe
 * @param {Array}  ingredients  - [{ ingredientId, quantityUsed }]
 * @param {Array}  extraCosts   - [{ name, type, quantity, unitPrice }]
 * @param {object} pricing      - { profitPercentage, suggestedPrice, roundedPrice }
 * @returns {Promise<object>}
 */
export async function createRecipe(recipe, ingredients, extraCosts, pricing) {
  // 1. Crear la receta base
  const { data: newRecipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      name:            recipe.name,
      description:     recipe.description ?? '',
      units_per_batch: recipe.unitsPerBatch,
      has_partner:     recipe.hasPartner ?? false,
      partner_id:      recipe.partnerId ?? null,
    })
    .select()
    .single();

  if (recipeError) throw recipeError;

  const recipeId = newRecipe.id;

  // 2. Insertar ingredientes de la receta
  if (ingredients.length > 0) {
    const { error: ingError } = await supabase
      .from('recipe_ingredients')
      .insert(
        ingredients.map((i) => ({
          recipe_id:     recipeId,
          ingredient_id: i.ingredientId,
          quantity_used: i.quantityUsed,
        }))
      );
    if (ingError) throw ingError;
  }

  // 3. Insertar costos extra
  if (extraCosts.length > 0) {
    const { error: costError } = await supabase
      .from('recipe_extra_costs')
      .insert(
        extraCosts.map((c) => ({
          recipe_id:  recipeId,
          name:       c.name,
          type:       c.type,
          quantity:   c.quantity,
          unit_price: c.unitPrice,
          total:      c.quantity * c.unitPrice,
          provider:   c.provider || null,
        }))
      );
    if (costError) throw costError;
  }

  // 4. Insertar precios
  const { error: priceError } = await supabase
    .from('recipe_pricing')
    .insert({
      recipe_id:          recipeId,
      profit_percentage:  pricing.profitPercentage,
      suggested_price:    pricing.suggestedPrice,
      rounded_price:      pricing.roundedPrice,
    });
  if (priceError) throw priceError;

  return newRecipe;
}

/**
 * Actualiza los datos base de una receta.
 * @param {string} id
 * @param {object} updates
 */
export async function updateRecipe(id, updates) {
  const { error } = await supabase
    .from('recipes')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

/**
 * Actualiza una receta completa: datos base, ingredientes, costos extra y precios.
 * Reemplaza ingredientes y costos extra (delete + reinsert).
 */
export async function updateFullRecipe(id, recipe, ingredients, extraCosts, pricing) {
  // 1. Actualizar datos base
  const { error: recipeError } = await supabase
    .from('recipes')
    .update({
      name:            recipe.name,
      description:     recipe.description ?? '',
      units_per_batch: recipe.unitsPerBatch,
      has_partner:     recipe.hasPartner ?? false,
      partner_id:      recipe.partnerId ?? null,
    })
    .eq('id', id);
  if (recipeError) throw recipeError;

  // 2. Reemplazar ingredientes
  await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
  if (ingredients.length > 0) {
    const { error: ingError } = await supabase
      .from('recipe_ingredients')
      .insert(ingredients.map((i) => ({
        recipe_id:     id,
        ingredient_id: i.ingredientId,
        quantity_used: i.quantityUsed,
      })));
    if (ingError) throw ingError;
  }

  // 3. Reemplazar costos extra
  await supabase.from('recipe_extra_costs').delete().eq('recipe_id', id);
  if (extraCosts.length > 0) {
    const { error: costError } = await supabase
      .from('recipe_extra_costs')
      .insert(extraCosts.map((c) => ({
        recipe_id:  id,
        name:       c.name,
        type:       c.type,
        quantity:   c.quantity,
        unit_price: c.unitPrice,
        total:      c.quantity * c.unitPrice,
        provider:   c.provider || null,
      })));
    if (costError) throw costError;
  }

  // 4. Actualizar precio (upsert por recipe_id)
  const { error: priceError } = await supabase
    .from('recipe_pricing')
    .upsert({
      recipe_id:         id,
      profit_percentage: pricing.profitPercentage,
      suggested_price:   pricing.suggestedPrice,
      rounded_price:     pricing.roundedPrice,
    }, { onConflict: 'recipe_id' });
  if (priceError) throw priceError;
}

/**
 * Actualiza el precio redondeado de una receta.
 * @param {string} recipeId
 * @param {number} roundedPrice
 */
export async function updateRoundedPrice(recipeId, roundedPrice) {
  const { error } = await supabase
    .from('recipe_pricing')
    .update({ rounded_price: roundedPrice })
    .eq('recipe_id', recipeId);
  if (error) throw error;
}

/**
 * Elimina una receta y todos sus datos relacionados (en cascada por FK).
 * @param {string} id
 */
export async function deleteRecipe(id) {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Obtiene todos los usuarios con rol 'partner' (para asignar socios).
 * @returns {Promise<Array>}
 */
export async function getPartners() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'partner');
  if (error) throw error;
  return data ?? [];
}
