import { useState, useEffect, useMemo } from 'react';
import {
  getRecipes, getRecipeById, createRecipe, updateFullRecipe, deleteRecipe, updateRoundedPrice, getPartners,
} from '../../services/recipes.service';
import { getIngredients } from '../../services/ingredients.service';
import { getExtraCostItems } from '../../services/extra_costs.service';
import { calcRecipeSummary, getRecipePricing } from '../../utils/calculations';
import { formatCurrency, formatQuantity, UNITS, EXTRA_COST_TYPES } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { PERMISSIONS } from '../../utils/permissions';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card';
import { Field, Input, Select, Textarea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import './RecipesPage.css';

// ── Formulario de receta ──────────────────────────────────────────────────────
function RecipeForm({ allIngredients, partners, extraCostItems = [], initialData = null, onSave, onClose }) {
  const [name,         setName]         = useState(initialData?.name ?? '');
  const [description,  setDescription]  = useState(initialData?.description ?? '');
  const [unitsPerBatch,setUnitsPerBatch]= useState(initialData?.units_per_batch?.toString() ?? '');
  const [hasPartner,   setHasPartner]   = useState(initialData?.has_partner ?? false);
  const [partnerId,    setPartnerId]    = useState(initialData?.partner_id ?? '');
  const [profitPct,    setProfitPct]    = useState(getRecipePricing(initialData).profit_percentage?.toString() ?? '50');
  const [ingredients,  setIngredients]  = useState(
    initialData?.recipe_ingredients?.length
      ? initialData.recipe_ingredients.map((ri) => ({ ingredientId: ri.ingredients?.id ?? ri.ingredient_id ?? '', quantityUsed: ri.quantity_used?.toString() ?? '' }))
      : [{ ingredientId: '', quantityUsed: '' }]
  );
  const [extraCosts,   setExtraCosts]   = useState(
    initialData?.recipe_extra_costs?.length
      ? initialData.recipe_extra_costs.map((c) => ({ name: c.name, provider: c.provider ?? '', type: c.type, quantityUsed: c.quantity?.toString() ?? '', unitPrice: c.unit_price?.toString() ?? '' }))
      : [{ name: '', provider: '', type: 'packaging', quantityUsed: '', unitPrice: '' }]
  );
  const [saving,       setSaving]       = useState(false);
  const [errors,       setErrors]       = useState({});

  // Cálculos en tiempo real
  const summary = useMemo(() => {
    const ings = ingredients
      .filter((i) => i.ingredientId && i.quantityUsed)
      .map((i) => {
        const ing = allIngredients.find((a) => a.id === i.ingredientId);
        return { unitPrice: ing?.unit_price ?? 0, quantityUsed: parseFloat(i.quantityUsed) || 0 };
      });
    const extras = extraCosts
      .filter((c) => c.unitPrice && c.quantityUsed)
      .map((c) => ({ quantity: parseFloat(c.quantityUsed) || 1, unitPrice: parseFloat(c.unitPrice) || 0, type: c.type }));
    const units = parseFloat(unitsPerBatch) || 1;
    const pct   = parseFloat(profitPct) || 0;
    return calcRecipeSummary({ ingredients: ings, extraCosts: extras, unitsPerBatch: units, profitPercentage: pct, hasPartner });
  }, [ingredients, extraCosts, unitsPerBatch, profitPct, hasPartner, allIngredients]);

  const addIngredient  = () => setIngredients((p) => [...p, { ingredientId: '', quantityUsed: '' }]);
  const removeIngredient = (i) => setIngredients((p) => p.filter((_, idx) => idx !== i));
  const setIng = (i, key, val) => setIngredients((p) => p.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  const addExtra    = () => setExtraCosts((p) => [...p, { name: '', provider: '', type: 'packaging', quantityUsed: '', unitPrice: '' }]);
  const removeExtra = (i) => setExtraCosts((p) => p.filter((_, idx) => idx !== i));
  const setExtra    = (i, key, val) => setExtraCosts((p) => p.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  const handleSelectExtraItemChange = (index, selectedId) => {
    const template = extraCostItems.find((item) => item.id === selectedId);
    setExtraCosts((prev) =>
      prev.map((row, idx) =>
        idx === index
          ? template
            ? {
                ...row,
                name: template.name,
                provider: template.provider || '',
                type: template.type,
                unitPrice: template.unit_price.toString(),
                _packageQty: template.quantity_sold,
                _packagePrice: template.price ?? (template.unit_price * template.quantity_sold),
              }
            : {
                ...row,
                name: '',
                provider: '',
                type: 'packaging',
                unitPrice: '',
                _packageQty: undefined,
                _packagePrice: undefined,
              }
          : row
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const e2 = {};
    if (!name.trim())         e2.name         = 'Escribe el nombre';
    if (!unitsPerBatch || +unitsPerBatch <= 0) e2.unitsPerBatch = 'Ingresa las unidades';
    setErrors(e2);
    if (Object.keys(e2).length) return;

    setSaving(true);
    try {
      const validIngs = ingredients.filter((i) => i.ingredientId && i.quantityUsed).map((i) => ({
        ingredientId:  i.ingredientId,
        quantityUsed:  parseFloat(i.quantityUsed),
      }));
      const validExtras = extraCosts.filter((c) => c.name && c.unitPrice && c.quantityUsed).map((c) => ({
        name: c.name, type: c.type,
        quantity: parseFloat(c.quantityUsed) || 1,
        unitPrice: parseFloat(c.unitPrice),
        provider: c.provider || null,
      }));
      const pricing = {
        profitPercentage: parseFloat(profitPct) || 50,
        suggestedPrice:   summary.suggestedPrice,
        roundedPrice:     initialData
          ? (getRecipePricing(initialData).rounded_price ?? summary.suggestedPrice)
          : summary.suggestedPrice,
      };
      await onSave(
        { name, description, unitsPerBatch: parseFloat(unitsPerBatch), hasPartner, partnerId: hasPartner ? partnerId : null },
        validIngs, validExtras, pricing
      );
      onClose();
    } finally { setSaving(false); }
  };

  const ingUnit = (id) => allIngredients.find((a) => a.id === id)?.unit ?? '';

  return (
    <form className="recipe-form" onSubmit={handleSubmit} noValidate>
      {/* Info básica */}
      <div className="recipe-form-section">
        <div className="recipe-form-section-header">📋 Información básica</div>
        <div className="recipe-form-section-body">
          <Field label="Nombre del producto" required error={errors.name}>
            <Input id="recipe-name" placeholder="Ej: Torta de Coco Premium" value={name}
              onChange={(e) => setName(e.target.value)} error={errors.name} />
          </Field>
          <Field label="Descripción (opcional)">
            <Textarea id="recipe-desc" placeholder="Descripción del producto..." value={description}
              onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label="Unidades por bandeja" required error={errors.unitsPerBatch}
            hint="¿Cuántas tortas/brownies salen de esta receta?">
            <Input id="recipe-units" type="number" min="1" placeholder="Ej: 20" value={unitsPerBatch}
              onChange={(e) => setUnitsPerBatch(e.target.value)} error={errors.unitsPerBatch} />
          </Field>
        </div>
      </div>

      {/* Ingredientes */}
      <div className="recipe-form-section">
        <div className="recipe-form-section-header">
          🥣 Ingredientes
          <Button type="button" variant="secondary" size="sm" onClick={addIngredient}>+ Agregar</Button>
        </div>
        <div className="recipe-form-section-body">
          {ingredients.map((row, i) => (
            <div key={i} className="ingredient-row">
              <Field label={i === 0 ? 'Ingrediente' : ''}>
                <Select value={row.ingredientId} onChange={(e) => setIng(i, 'ingredientId', e.target.value)}>
                  <option value="">Selecciona...</option>
                  {allIngredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label={i === 0 ? 'Cantidad' : ''}>
                <Input type="number" min="0" step="any" placeholder="0"
                  iconRight={ingUnit(row.ingredientId) || 'unid.'}
                  value={row.quantityUsed} onChange={(e) => setIng(i, 'quantityUsed', e.target.value)} />
              </Field>
              <Button type="button" variant="ghost" size="sm" icon
                onClick={() => removeIngredient(i)} style={{ marginTop: i === 0 ? '22px' : '0' }}>🗑️</Button>
            </div>
          ))}
        </div>
      </div>

      {/* Costos extra */}
      <div className="recipe-form-section">
        <div className="recipe-form-section-header">
          💰 Otros costos (empaques, servicios, mano de obra)
          <Button type="button" variant="secondary" size="sm" onClick={addExtra}>+ Agregar</Button>
        </div>
        <div className="recipe-form-section-body">
          {extraCosts.map((row, i) => {
            // Cost preview for this row
            const rowCost = (parseFloat(row.quantityUsed) || 0) * (parseFloat(row.unitPrice) || 0);
            const matchedItem = extraCostItems.find((item) => item.name === row.name);

            return (
              <div key={i} className="extra-cost-row">
                <Field label={i === 0 ? 'Concepto de Costo' : ''}>
                  <Select
                    value={matchedItem?.id || ''}
                    onChange={(e) => handleSelectExtraItemChange(i, e.target.value)}
                  >
                    <option value="">Selecciona...</option>
                    {extraCostItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} {item.provider ? `(${item.provider})` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={i === 0 ? 'Cant. usadas' : ''}
                  hint={row._packageQty ? `Paquete: ${row._packageQty} uds` : matchedItem?.quantity_sold ? `Paquete: ${matchedItem.quantity_sold} uds` : undefined}
                >
                  <Input type="number" min="0" step="any" placeholder="Ej: 20"
                    value={row.quantityUsed} onChange={(e) => setExtra(i, 'quantityUsed', e.target.value)} />
                </Field>
                <Field label={i === 0 ? 'Costo/ud' : ''}>
                  <Input type="number" min="0" step="any" prefix="$" placeholder="0"
                    value={row.unitPrice} onChange={(e) => setExtra(i, 'unitPrice', e.target.value)} />
                </Field>
                {rowCost > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)', paddingTop: i === 0 ? '22px' : '0', whiteSpace: 'nowrap' }}>
                    = {formatCurrency(rowCost)}
                  </div>
                )}
                <Button type="button" variant="ghost" size="sm" icon
                  onClick={() => removeExtra(i)} style={{ marginTop: i === 0 ? '22px' : '0' }}>🗑️</Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Precios */}
      <div className="recipe-form-section">
        <div className="recipe-form-section-header">💵 Margen de ganancia</div>
        <div className="recipe-form-section-body">
          <Field label="Porcentaje de ganancia" hint="Ej: 50 para cobrar costo × 1.5. El precio final redondeado se ajusta en la vista de detalle de la receta.">
            <Input type="number" min="0" max="500" placeholder="50" value={profitPct}
              iconRight="%" onChange={(e) => setProfitPct(e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Socio */}
      <div className="recipe-form-section">
        <div className="recipe-form-section-header">🤝 Socio de negocio</div>
        <div className="recipe-form-section-body">
          <div className={`partner-toggle ${hasPartner ? 'active' : ''}`}
            onClick={() => setHasPartner(!hasPartner)} role="checkbox" aria-checked={hasPartner}>
            <div className={`toggle-switch ${hasPartner ? 'on' : ''}`} />
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
              {hasPartner ? '🤝 Esta receta tiene socio' : 'Sin socio en esta receta'}
            </span>
          </div>
          {hasPartner && partners.length > 0 && (
            <Field label="Selecciona el socio">
              <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">Selecciona...</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </Select>
            </Field>
          )}
        </div>
      </div>

      {/* Resumen en tiempo real */}
      {summary.batchCost > 0 && (
        <div style={{ background: 'var(--color-rose-50)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)', border: '1px solid var(--color-rose-200)' }}>
          <div style={{ fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            📊 Vista previa de costos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
            {[
              { label: 'Costo bandeja', value: formatCurrency(summary.batchCost) },
              { label: 'Costo individual', value: formatCurrency(summary.unitCost) },
              { label: 'Precio venta', value: formatCurrency(summary.sellingPrice) },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{s.label}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-primary)' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>Guardar receta 🎂</Button>
      </div>
    </form>
  );
}

// ── Vista detalle de receta ───────────────────────────────────────────────────
function RecipeDetail({ recipe, onBack, onDelete, onEdit, onRoundedPriceUpdate, userRole }) {
  const canManage  = userRole === 'admin';
  const isPartner  = userRole === 'partner';

  const ings   = recipe.recipe_ingredients ?? [];
  const extras = recipe.recipe_extra_costs ?? [];
  const pricing = getRecipePricing(recipe);

  const summary = useMemo(() => {
    const ingsCalc  = ings.map((i) => ({ unitPrice: i.ingredients?.unit_price ?? 0, quantityUsed: i.quantity_used }));
    const extrasCalc = extras.map((c) => ({ quantity: c.quantity, unitPrice: c.unit_price, type: c.type }));
    return calcRecipeSummary({
      ingredients: ingsCalc, extraCosts: extrasCalc,
      unitsPerBatch: recipe.units_per_batch,
      profitPercentage: pricing.profit_percentage ?? 50,
      roundedPrice: pricing.rounded_price,
      hasPartner: recipe.has_partner,
    });
  }, [recipe, ings, extras, pricing]);

  const [editingPrice, setEditingPrice] = useState(false);
  const [newPrice, setNewPrice] = useState(pricing.rounded_price ?? '');
  const [saving, setSaving] = useState(false);

  const handlePriceSave = async () => {
    setSaving(true);
    await onRoundedPriceUpdate(recipe.id, parseFloat(newPrice));
    setEditingPrice(false);
    setSaving(false);
  };

  return (
    <div className="animate-fade-in">
      {/* Encabezado */}
      <div className="recipe-detail-header">
        <button className="recipe-detail-back" onClick={onBack}>← Volver</button>
        <div className="recipe-detail-title-row">
          <h1>{recipe.name}</h1>
          {canManage && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="secondary" size="sm" onClick={onEdit}>✏️ Editar receta</Button>
              <Button variant="danger" size="sm" onClick={() => onDelete(recipe)}>🗑️ Eliminar</Button>
            </div>
          )}
        </div>
      </div>

      {recipe.description && (
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)', fontSize: 'var(--font-size-sm)' }}>
          {recipe.description}
        </p>
      )}

      {/* Stats principales */}
      {!isPartner && (
        <div className="recipe-stats-grid">
          {[
            { label: 'Costo total bandeja', value: formatCurrency(summary.batchCost) },
            { label: `Unidades (${recipe.units_per_batch})`, value: formatCurrency(summary.unitCost), sub: 'por unidad' },
            { label: 'Precio de venta', value: formatCurrency(summary.sellingPrice) },
            { label: 'Ganancia total bandeja', value: formatCurrency(summary.totalProfit) },
            { label: 'Ingresos totales', value: formatCurrency(summary.totalRevenue), sub: 'vendiendo todo' },
          ].map((s) => <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} />)}
        </div>
      )}

      {/* Precio editable */}
      {canManage && (
        <Card highlighted style={{ marginBottom: 'var(--space-5)' }}>
          <CardBody>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>💵 Precio de venta redondeado</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Precio sugerido: {formatCurrency(summary.suggestedPrice)} (costo × {pricing.profit_percentage ?? 50}%+)</div>
              </div>
              {editingPrice ? (
                <div className="price-editor">
                  <Input type="number" prefix="$" value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                    style={{ width: '130px' }} />
                  <Button size="sm" loading={saving} onClick={handlePriceSave}>Guardar</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingPrice(false)}>Cancelar</Button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-primary)' }}>
                    {formatCurrency(summary.sellingPrice)}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => { setNewPrice(summary.sellingPrice); setEditingPrice(true); }}>
                    ✏️ Editar
                  </Button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-5)' }}>
        {/* Ingredientes */}
        {!isPartner && (
          <Card>
            <CardHeader><h3>🥣 Ingredientes</h3></CardHeader>
            <CardBody style={{ padding: 0 }}>
              <table className="recipe-ingredients-table">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Cantidad</th>
                    <th>Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {ings.map((i) => {
                    const cost = (i.ingredients?.unit_price ?? 0) * i.quantity_used;
                    return (
                      <tr key={i.id}>
                        <td>
                          {i.ingredients?.name}
                          {i.ingredients?.provider && (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 'var(--space-1)' }}>
                              (🏪 {i.ingredients?.provider})
                            </span>
                          )}
                        </td>
                        <td>{formatQuantity(i.quantity_used, i.ingredients?.unit)}</td>
                        <td>{formatCurrency(cost)}</td>
                      </tr>
                    );
                  })}
                  {extras.map((c) => (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--color-text-muted)' }}>
                        {c.name}
                        {c.provider && (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 'var(--space-1)' }}>
                            (🏪 {c.provider})
                          </span>
                        )}{' '}
                        <Badge variant="neutral" style={{ fontSize: '10px' }}>{c.type}</Badge>
                      </td>
                      <td>{c.quantity} ud × {formatCurrency(c.unit_price)}/ud</td>
                      <td>{formatCurrency(c.quantity * c.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        )}

        {/* Ganancias */}
        <Card>
          <CardHeader>
            <h3>💰 Ganancias</h3>
            {recipe.has_partner && <Badge variant="info">🤝 Con socio</Badge>}
          </CardHeader>
          <CardBody>
            {recipe.has_partner ? (
              <div className="profit-breakdown">
                <div className="profit-box profit-box-owner">
                  <div className="profit-box-emoji">🧁</div>
                  <div className="profit-box-name">Cecilia{!isPartner ? ' (mano de obra + mitad)' : ''}</div>
                  {!isPartner && <div className="profit-box-amount">{formatCurrency(summary.ownerProfit)}</div>}
                </div>
                <div className="profit-box profit-box-partner">
                  <div className="profit-box-emoji">🤝</div>
                  <div className="profit-box-name">{recipe.profiles?.full_name ?? 'Socio'} (mitad)</div>
                  <div className="profit-box-amount">{formatCurrency(summary.partnerProfit)}</div>
                </div>
              </div>
            ) : (
              <div className="profit-box profit-box-owner" style={{ textAlign: 'center' }}>
                <div className="profit-box-emoji">🧁</div>
                <div className="profit-box-name">Ganancia total</div>
                {!isPartner && <div className="profit-box-amount">{formatCurrency(summary.totalProfit)}</div>}
              </div>
            )}
            {!isPartner && (
              <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                Ganancia por unidad: {formatCurrency(summary.profitPerUnit)}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function RecipesPage() {
  const { role, hasPermission, user } = useAuth();
  const canManage = hasPermission(PERMISSIONS.MANAGE_RECIPES);

  const [recipes,      setRecipes]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedId,   setSelectedId]   = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [loadingDetail,  setLoadingDetail]  = useState(false);
  const [formOpen,     setFormOpen]     = useState(false);
  const [editRecipeOpen, setEditRecipeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [allIngredients, setAllIngredients] = useState([]);
  const [partners,       setPartners]       = useState([]);
  const [extraCostItems, setExtraCostItems] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [data, ings, parts, costItems] = await Promise.all([
        getRecipes({ role, userId: user?.id }),
        getIngredients(),
        getPartners(),
        getExtraCostItems(),
      ]);
      setRecipes(data);
      setAllIngredients(ings);
      setPartners(parts);
      setExtraCostItems(costItems);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const loadDetail = async (id) => {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const data = await getRecipeById(id);
      setSelectedRecipe(data);
    } finally { setLoadingDetail(false); }
  };

  const handleSave = async (recipe, ingredients, extraCosts, pricing) => {
    await createRecipe(recipe, ingredients, extraCosts, pricing);
    await load();
  };

  const handleUpdate = async (recipe, ingredients, extraCosts, pricing) => {
    await updateFullRecipe(selectedId, recipe, ingredients, extraCosts, pricing);
    const updated = await getRecipeById(selectedId);
    setSelectedRecipe(updated);
    setEditRecipeOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteRecipe(deleteTarget.id);
    setDeleteTarget(null);
    setSelectedId(null);
    setSelectedRecipe(null);
    await load();
  };

  const handlePriceUpdate = async (recipeId, price) => {
    await updateRoundedPrice(recipeId, price);
    const updated = await getRecipeById(recipeId);
    setSelectedRecipe(updated);
  };

  if (loading) return (
    <div className="app-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-16)' }}>
      <LoadingSpinner size="lg" text="Cargando recetas..." />
    </div>
  );

  // Vista detalle
  if (selectedId) {
    if (loadingDetail) return (
      <div className="app-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-16)' }}>
        <LoadingSpinner size="lg" text="Cargando receta..." />
      </div>
    );
    return (
      <div className="app-content">
        <RecipeDetail
          recipe={selectedRecipe}
          userRole={role}
          onBack={() => { setSelectedId(null); setSelectedRecipe(null); }}
          onDelete={setDeleteTarget}
          onEdit={() => setEditRecipeOpen(true)}
          onRoundedPriceUpdate={handlePriceUpdate}
        />
        {/* Modal: Editar receta */}
        <Modal isOpen={editRecipeOpen} onClose={() => setEditRecipeOpen(false)} title="✏️ Editar receta" size="xl">
          <RecipeForm
            allIngredients={allIngredients}
            partners={partners}
            extraCostItems={extraCostItems}
            initialData={selectedRecipe}
            onSave={handleUpdate}
            onClose={() => setEditRecipeOpen(false)}
          />
        </Modal>
        {/* Modal: Eliminar receta */}
        <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="🗑️ Eliminar receta" size="sm"
          footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Sí, eliminar</Button></>}>
          <p>¿Estás segura de eliminar <strong>{deleteTarget?.name}</strong>?</p>
        </Modal>
      </div>
    );
  }

  // Lista de recetas
  return (
    <div className="app-content animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>🍰 Recetas</h1>
          <p>Tus productos con sus costos y ganancias calculadas</p>
        </div>
        {canManage && (
          <Button id="add-recipe-btn" onClick={() => setFormOpen(true)}>+ Nueva receta</Button>
        )}
      </div>

      {recipes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🍰</span>
          <h3>¡Aún no hay recetas!</h3>
          <p>Crea tu primera receta para ver los costos y ganancias calculados automáticamente.</p>
          {canManage && (
            <Button onClick={() => setFormOpen(true)} style={{ marginTop: 'var(--space-4)' }}>+ Crear primera receta</Button>
          )}
        </div>
      ) : (
        <div className="recipes-grid">
          {recipes.map((recipe) => {
            const pricing = getRecipePricing(recipe);
            return (
              <Card key={recipe.id} hoverable className="recipe-card animate-fade-in-up"
                onClick={() => loadDetail(recipe.id)}>
                <CardBody>
                  <div className="recipe-card-emoji">🎂</div>
                  <div className="recipe-card-name">{recipe.name}</div>
                  {recipe.description && <div className="recipe-card-desc">{recipe.description}</div>}
                  <div className="recipe-card-stats">
                    <div className="recipe-card-stat">
                      <div className="recipe-card-stat-label">Precio venta</div>
                      <div className="recipe-card-stat-value">{formatCurrency(pricing.rounded_price ?? 0)}</div>
                    </div>
                    <div className="recipe-card-stat">
                      <div className="recipe-card-stat-label">Unidades</div>
                      <div className="recipe-card-stat-value">{recipe.units_per_batch}</div>
                    </div>
                  </div>
                  <div className="recipe-card-footer">
                    {recipe.has_partner
                      ? <Badge variant="info">🤝 Con socio</Badge>
                      : <Badge variant="rose">🧁 Sin socio</Badge>}
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Ver detalles →</span>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="🎂 Nueva receta" size="xl">
        <RecipeForm allIngredients={allIngredients} partners={partners} extraCostItems={extraCostItems}
          onSave={handleSave} onClose={() => setFormOpen(false)} />
      </Modal>
    </div>
  );
}
