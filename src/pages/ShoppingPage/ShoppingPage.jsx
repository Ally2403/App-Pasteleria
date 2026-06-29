import { useState, useEffect, useMemo } from 'react';
import { getRecipes, getRecipeById } from '../../services/recipes.service';
import { getIngredients, addToInventory } from '../../services/ingredients.service';
import { formatQuantity } from '../../utils/formatters';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select, Input, Field, SearchableSelect } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import './ShoppingPage.css';

export default function ShoppingPage() {
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [batches, setBatches] = useState(1);
  const [allIngredients, setAllIngredients] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Estados para Modal de Compras
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseItems, setPurchaseItems] = useState([]); // [{ id, name, unit, provider, quantityToRegister, checked, quantitySold }]
  const [extraIngredientId, setExtraIngredientId] = useState('');
  const [extraQty, setExtraQty] = useState('');
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [notification, setNotification] = useState(null); // { message, type }

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Función auxiliar para refrescar stock tras comprar
  const refreshIngredientsOnly = async () => {
    try {
      const ingredientsData = await getIngredients();
      setAllIngredients(ingredientsData);
    } catch (err) {
      console.error('Error al refrescar ingredientes:', err);
    }
  };

  // Abrir el modal de registro cargando los elementos faltantes
  const handleOpenPurchaseModal = () => {
    const items = [];
    Object.keys(shoppingListByProvider).forEach((provider) => {
      shoppingListByProvider[provider].forEach((item) => {
        items.push({
          id: item.id,
          name: item.name,
          unit: item.unit,
          provider: provider,
          quantityToRegister: item.totalToBuy, // Sugerimos comprar el total de paquetes
          quantitySold: item.quantitySold,
          checked: true,
        });
      });
    });
    setPurchaseItems(items);
    setExtraIngredientId('');
    setExtraQty('');
    setIsPurchaseModalOpen(true);
  };

  // Cambiar cantidad en la lista de compras del modal
  const handlePurchaseQtyChange = (id, val) => {
    setPurchaseItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantityToRegister: parseFloat(val) || 0 } : item
      )
    );
  };

  // Marcar/Desmarcar ingrediente en el modal
  const handlePurchaseToggle = (id) => {
    setPurchaseItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  // Agregar un ingrediente extra que no estuviera originalmente en la lista
  const handleAddExtraIngredient = () => {
    if (!extraIngredientId) return;
    const ing = allIngredients.find((a) => a.id === extraIngredientId);
    if (!ing) return;

    // Verificar si ya está en la lista del modal
    const exists = purchaseItems.some((item) => item.id === ing.id);
    if (exists) {
      alert(`El ingrediente "${ing.name}" ya está en la lista de ingreso.`);
      return;
    }

    const qty = parseFloat(extraQty) || ing.quantity_sold || 0;

    setPurchaseItems((prev) => [
      ...prev,
      {
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        provider: ing.provider || 'Sin Proveedor',
        quantityToRegister: qty,
        quantitySold: ing.quantity_sold,
        checked: true,
      },
    ]);

    setExtraIngredientId('');
    setExtraQty('');
  };

  // Confirmar y guardar las compras en la base de datos
  const handleConfirmPurchase = async () => {
    const activePurchases = purchaseItems.filter((item) => item.checked && item.quantityToRegister > 0);
    if (activePurchases.length === 0) {
      setNotification({ message: 'Por favor selecciona al menos un ingrediente para registrar la compra.', type: 'warning' });
      return;
    }

    setSavingPurchase(true);
    console.log('Iniciando registro de compras con ítems:', activePurchases);

    try {
      const usages = activePurchases.map((item) => ({
        ingredientId: item.id,
        quantityUsed: parseFloat(item.quantityToRegister) || 0,
      }));

      console.log('Enviando usages calculados a addToInventory:', usages);
      await addToInventory(usages);
      
      setIsPurchaseModalOpen(false);
      
      console.log('Refrescando inventario en la vista...');
      await refreshIngredientsOnly();
      
      setNotification({ message: '¡Inventario actualizado correctamente con las compras registradas! 🎉', type: 'success' });
    } catch (err) {
      console.error('Error al registrar compras:', err);
      setNotification({ message: `Hubo un error al registrar las compras en el inventario: ${err.message || err}`, type: 'error' });
    } finally {
      setSavingPurchase(false);
    }
  };

  // Cargar recetas e ingredientes al inicializar
  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      try {
        const [recipesData, ingredientsData] = await Promise.all([
          getRecipes(),
          getIngredients(),
        ]);
        setRecipes(recipesData);
        setAllIngredients(ingredientsData);
      } catch (err) {
        console.error('Error al cargar datos de compras:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Cargar detalles de la receta seleccionada
  useEffect(() => {
    if (!selectedRecipeId) {
      setSelectedRecipe(null);
      return;
    }

    async function loadRecipeDetails() {
      setLoadingRecipe(true);
      try {
        const recipe = await getRecipeById(selectedRecipeId);
        setSelectedRecipe(recipe);
        setBatches(1);
      } catch (err) {
        console.error('Error al cargar receta:', err);
      } finally {
        setLoadingRecipe(false);
      }
    }

    loadRecipeDetails();
  }, [selectedRecipeId]);

  // Generar la lista de compras agrupada por proveedor
  const shoppingListByProvider = useMemo(() => {
    if (!selectedRecipe) return {};

    const list = {};

    (selectedRecipe.recipe_ingredients ?? []).forEach((ri) => {
      const ing = ri.ingredients;
      if (!ing) return;

      // Buscar el ingrediente actualizado con su inventario
      const updatedIng = allIngredients.find((a) => a.id === ing.id);
      const stock = updatedIng?.inventory?.[0]?.current_stock ?? 0;
      const needed = ri.quantity_used * batches;
      const deficit = needed - stock;

      if (deficit > 0) {
        // Calcular paquetes recomendados a comprar
        const quantitySold = ing.quantity_sold || 1;
        const packsToBuy = Math.ceil(deficit / quantitySold);
        const totalToBuy = packsToBuy * quantitySold;
        const providerName = ing.provider ? ing.provider.trim() : 'Sin Proveedor';

        if (!list[providerName]) {
          list[providerName] = [];
        }

        const packagePrice = updatedIng?.price || 0;
        const totalCost = packsToBuy * packagePrice;

        list[providerName].push({
          id: ing.id,
          name: ing.name,
          unit: ing.unit,
          stock,
          needed,
          deficit,
          quantitySold,
          packsToBuy,
          totalToBuy,
          packagePrice,
          totalCost
        });
      }
    });

    return list;
  }, [selectedRecipe, batches, allIngredients]);

  const hasShoppingItems = useMemo(() => {
    return Object.keys(shoppingListByProvider).length > 0;
  }, [shoppingListByProvider]);

  const shoppingTotals = useMemo(() => {
    let grandTotal = 0;
    const totalsByProvider = {};

    Object.keys(shoppingListByProvider).forEach((provider) => {
      let providerSum = 0;
      shoppingListByProvider[provider].forEach((item) => {
        providerSum += item.totalCost;
      });
      totalsByProvider[provider] = providerSum;
      grandTotal += providerSum;
    });

    return { grandTotal, totalsByProvider };
  }, [shoppingListByProvider]);

  // Generar texto para compartir por WhatsApp / portapapeles
  const handleCopyList = () => {
    if (!selectedRecipe) return;

    let text = `📋 *LISTA DE COMPRAS — PASTELERÍA MAMI* 🌸\n`;
    text += `Para hacer: *${selectedRecipe.name}* (${batches} bandeja${batches > 1 ? 's' : ''})\n`;
    text += `Total estimado de dinero necesario: *${formatCurrency(shoppingTotals.grandTotal)}*\n`;
    text += `------------------------------------------\n\n`;

    Object.keys(shoppingListByProvider).forEach((provider) => {
      const providerTotal = shoppingTotals.totalsByProvider[provider] || 0;
      text += `🏢 *${provider.toUpperCase()}* (Presupuesto: *${formatCurrency(providerTotal)}*)\n`;
      shoppingListByProvider[provider].forEach((item) => {
        text += `• *${item.name}*: Compra *${item.packsToBuy} paquete(s)* de ${formatQuantity(item.quantitySold, item.unit)} (Valor: ${formatCurrency(item.totalCost)})\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="app-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-16)' }}>
        <LoadingSpinner size="lg" text="Cargando calculadora de compras..." />
      </div>
    );
  }

  return (
    <div className="app-content shopping-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>🛒 Lista de Compras</h1>
          <p>Compara recetas con tu stock disponible y genera la lista de compras por proveedor</p>
        </div>
        <Button variant="success" onClick={() => { setPurchaseItems([]); setExtraIngredientId(''); setExtraQty(''); setIsPurchaseModalOpen(true); }}>
          📥 Registrar Compras Directas
        </Button>
      </div>

      {notification && (
        <div className={`notification-banner banner-${notification.type} animate-fade-in`}>
          <span className="notification-message">{notification.message}</span>
          <button className="banner-close-btn" onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      <div className="shopping-recipe-select-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <label style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
            Selecciona la receta que quieres preparar
          </label>
          <SearchableSelect
            value={selectedRecipeId}
            onChange={(e) => setSelectedRecipeId(e.target.value)}
            options={[
              { value: '', label: '-- Elige una receta --' },
              ...recipes.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.units_per_batch} unidades)`,
              })),
            ]}
            placeholder="Buscar receta..."
          />
        </div>

        {loadingRecipe && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
            <LoadingSpinner size="md" text="Calculando lista de compras..." />
          </div>
        )}

        {selectedRecipe && !loadingRecipe && (
          <div className="animate-fade-in">
            <div className="shopping-form-header">
              <span className="shopping-form-title">
                📋 Ingredientes para: {selectedRecipe.name}
              </span>
              
              <div className="shopping-batch-control">
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>
                  Bandejas a planear:
                </span>
                <button
                  type="button"
                  className="shopping-batch-btn"
                  onClick={() => setBatches(Math.max(1, batches - 1))}
                >
                  -
                </button>
                <span className="shopping-batch-val">{batches}</span>
                <button
                  type="button"
                  className="shopping-batch-btn"
                  onClick={() => setBatches(batches + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              Cálculo estimado para preparar <strong>{batches} bandeja{batches > 1 ? 's' : ''}</strong> ({selectedRecipe.units_per_batch * batches} unidades).
            </p>

            {/* Tarjeta de Presupuesto Estimado */}
            {hasShoppingItems && (
              <div className="shopping-budget-banner animate-fade-in" style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1.5px solid #bbf7d0',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-4) var(--space-5)',
                marginBottom: 'var(--space-5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: '2.2rem' }}>💰</span>
                  <div>
                    <h3 style={{ color: '#166534', margin: 0, fontSize: 'var(--font-size-lg)' }}>Presupuesto Estimado Necesario</h3>
                    <p style={{ color: '#14532d', margin: 0, fontSize: 'var(--font-size-sm)' }}>
                      Total de dinero que necesitas para comprar toda esta lista.
                    </p>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-extrabold)', color: '#15803d' }}>
                  {formatCurrency(shoppingTotals.grandTotal)}
                </div>
              </div>
            )}

            {/* Acciones para la lista */}
            <div className="shopping-actions-row">
              {hasShoppingItems && (
                <>
                  <Button variant="secondary" onClick={handlePrint}>
                    🖨️ Imprimir Lista
                  </Button>
                  <Button variant="primary" onClick={handleCopyList}>
                    {copySuccess ? '✓ ¡Copiado!' : '📋 Copiar para WhatsApp'}
                  </Button>
                  <Button variant="success" onClick={handleOpenPurchaseModal}>
                    📥 Ingresar Compras a Inventario
                  </Button>
                </>
              )}
            </div>

            {!hasShoppingItems ? (
              <Card highlighted style={{ borderLeft: '4px solid var(--color-success)' }}>
                <CardBody>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: '2rem' }}>🎉</span>
                    <div>
                      <h4 style={{ color: 'var(--color-success)', margin: 0 }}>¡Tienes todo en stock!</h4>
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
                        No necesitas comprar ningún ingrediente. Tienes suficiente stock para preparar estas {batches} bandeja{batches > 1 ? 's' : ''}.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ) : (
              <div className="shopping-providers-grid">
                {Object.keys(shoppingListByProvider).map((provider) => {
                  const providerTotal = shoppingTotals.totalsByProvider[provider] || 0;
                  return (
                    <div key={provider} className="provider-shopping-card animate-fade-in-up">
                      <div className="provider-card-header" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--color-border-light)',
                        paddingBottom: 'var(--space-2)'
                      }}>
                        <span className="provider-card-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold' }}>
                          🏢 {provider}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-rose-700)', fontWeight: 'extrabold' }}>
                            Presupuesto: {formatCurrency(providerTotal)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="provider-card-body" style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {shoppingListByProvider[provider].map((item) => (
                          <div key={item.id} className="provider-item-row" style={{
                            padding: 'var(--space-2) 0',
                            borderBottom: '1px dashed var(--color-border-light)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-base)' }}>
                                {item.name}
                              </div>
                              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success)', fontWeight: 'bold', marginTop: '2px' }}>
                                🛒 Compra: {item.packsToBuy} paquete{item.packsToBuy > 1 ? 's' : ''} de {formatQuantity(item.quantitySold, item.unit)}
                              </div>
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                (Faltan {formatQuantity(item.deficit, item.unit)} • Stock actual: {formatQuantity(item.stock, item.unit)})
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 'extrabold', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-base)' }}>
                                {formatCurrency(item.totalCost)}
                              </span>
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                ({formatCurrency(item.packagePrice)} / ud)
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal interactivo de Registro de Compras */}
      <Modal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        title="📥 Registrar Ingreso de Compras"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsPurchaseModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="success" loading={savingPurchase} onClick={handleConfirmPurchase}>
              Confirmar e Ingresar Stock
            </Button>
          </>
        }
      >
        <div className="shopping-modal-content">
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            Marca los ingredientes comprados y escribe la cantidad exacta recibida para sumarla automáticamente al inventario.
          </p>

          {/* Lista de compras a registrar */}
          <div className="shopping-purchase-list">
            <div className="purchase-list-header">
              <div style={{ width: '40px' }}></div>
              <div>Ingrediente</div>
              <div>Proveedor</div>
              <div style={{ textAlign: 'right' }}>Cantidad a Sumar</div>
            </div>

            {purchaseItems.length === 0 ? (
              <div className="purchase-list-empty">
                No hay ingredientes en la lista. Agrega ingredientes abajo.
              </div>
            ) : (
              purchaseItems.map((item) => (
                <div key={item.id} className={`purchase-list-row ${!item.checked ? 'row-disabled' : ''}`}>
                  <div className="purchase-row-check">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handlePurchaseToggle(item.id)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                  </div>
                  <div className="purchase-row-name">
                    <strong>{item.name}</strong>
                  </div>
                  <div className="purchase-row-provider">
                    <span className="badge-provider">{item.provider}</span>
                  </div>
                  <div className="purchase-row-qty">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.quantityToRegister}
                        disabled={!item.checked}
                        onChange={(e) => handlePurchaseQtyChange(item.id, e.target.value)}
                        style={{ width: '90px', padding: '4px 8px', textAlign: 'right' }}
                      />
                      <span className="purchase-row-unit">{item.unit}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Formulario de Ingrediente Extra */}
          <div className="shopping-extra-form">
            <h4>➕ ¿Compraste algo más que no estaba en la receta?</h4>
            <div className="extra-form-grid">
              <div style={{ flex: 2 }}>
                <SearchableSelect
                  value={extraIngredientId}
                  onChange={(e) => setExtraIngredientId(e.target.value)}
                  options={[
                    { value: '', label: '-- Selecciona un ingrediente --' },
                    ...allIngredients.map((ing) => ({
                      value: ing.id,
                      label: `${ing.name} (${ing.unit}) — ${ing.provider || 'Sin Proveedor'}`,
                    })),
                  ]}
                  placeholder="Buscar ingrediente extra..."
                />
              </div>
              <div style={{ width: '130px' }}>
                <Input
                  type="number"
                  placeholder="Cant. (g/ml)"
                  value={extraQty}
                  onChange={(e) => setExtraQty(e.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" onClick={handleAddExtraIngredient}>
                Agregar a la lista
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
