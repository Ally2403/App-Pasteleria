import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getRecipes, getRecipeById } from '../../services/recipes.service';
import { registerProduction, getProductionLogs, deleteProduction } from '../../services/production.service';
import { formatCurrency, formatQuantity, formatDateTime } from '../../utils/formatters';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select, Textarea, Input, Field } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import './ProductionPage.css';

export default function ProductionPage() {
  const { hasPermission } = useAuth();

  const [recipes, setRecipes] = useState([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [batches, setBatches] = useState(1);
  const [ingredientQuantities, setIngredientQuantities] = useState({}); // { ingredientId: value }
  const [notes, setNotes] = useState('');
  const [logs, setLogs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Determinar si hay stock insuficiente según las cantidades reales ingresadas
  const isStockInsufficient = useMemo(() => {
    if (!selectedRecipe) return false;
    return (selectedRecipe.recipe_ingredients ?? []).some((ri) => {
      const stock = ri.ingredients?.inventory?.[0]?.current_stock ?? 0;
      const actualQty = parseFloat(ingredientQuantities[ri.id]) || 0;
      return stock < actualQty;
    });
  }, [selectedRecipe, ingredientQuantities]);

  // Cargar recetas e historial al iniciar
  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [recipesData, logsData] = await Promise.all([
        getRecipes(),
        getProductionLogs(),
      ]);
      setRecipes(recipesData);
      setLogs(logsData);
    } catch (err) {
      console.error('Error al cargar datos de producción:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cargar detalles de la receta seleccionada
  useEffect(() => {
    if (!selectedRecipeId) {
      setSelectedRecipe(null);
      setIngredientQuantities({});
      return;
    }

    async function loadRecipeDetails() {
      setLoadingRecipe(true);
      try {
        const recipe = await getRecipeById(selectedRecipeId);
        setSelectedRecipe(recipe);

        // Inicializar las cantidades editables con las cantidades requeridas para 1 batch
        // Usamos ri.id (PK de recipe_ingredients) como clave porque el query no expone ingredient_id
        const initialQtys = {};
        (recipe.recipe_ingredients ?? []).forEach((ri) => {
          initialQtys[ri.id] = ri.quantity_used;
        });
        setIngredientQuantities(initialQtys);
        setBatches(1);
      } catch (err) {
        console.error('Error al cargar receta:', err);
      } finally {
        setLoadingRecipe(false);
      }
    }

    loadRecipeDetails();
  }, [selectedRecipeId]);

  // Actualizar cantidades recomendadas al cambiar el número de lotes (lotes / bandejas)
  const handleBatchesChange = (newBatches) => {
    if (newBatches < 1) return;
    setBatches(newBatches);

    // Escalar las cantidades en base al cambio
    const updatedQtys = {};
    (selectedRecipe?.recipe_ingredients ?? []).forEach((ri) => {
      updatedQtys[ri.id] = (ri.quantity_used * newBatches).toFixed(2).replace(/\.00$/, '');
    });
    setIngredientQuantities(updatedQtys);
  };

  // Manejar el cambio individual de cantidad
  const handleQuantityChange = (ingredientId, val) => {
    setIngredientQuantities((prev) => ({
      ...prev,
      [ingredientId]: val,
    }));
  };

  const handleRegisterClick = (e) => {
    e.preventDefault();
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setSaving(true);
    setConfirmOpen(false);

    try {
      // Mapeamos de ri.id → ingredient real (buscamos ingredient id desde la receta)
      const actualIngredients = (selectedRecipe.recipe_ingredients ?? []).map((ri) => ({
        ingredientId: ri.ingredients?.id ?? ri.id,
        quantityUsed: parseFloat(ingredientQuantities[ri.id]) || 0,
      }));

      // Unidades producidas totales = unidades por bandeja * bandejas hechas
      const totalUnits = selectedRecipe.units_per_batch * batches;

      await registerProduction({
        recipeId: selectedRecipe.id,
        unitsProduced: totalUnits,
        actualIngredients,
        notes: notes.trim(),
      });

      // Resetear estado
      setSelectedRecipeId('');
      setSelectedRecipe(null);
      setIngredientQuantities({});
      setNotes('');
      setSuccessOpen(true);

      // Recargar logs silenciosamente
      await loadData(false);
    } catch (err) {
      console.error('Error al registrar producción:', err);
      alert('Hubo un error al guardar el registro de producción.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (log) => {
    setLogToDelete(log);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!logToDelete) return;
    setDeleting(true);
    try {
      await deleteProduction(logToDelete.id);
      setDeleteOpen(false);
      setLogToDelete(null);
      // Recargar datos e historial silenciosamente
      await loadData(false);
    } catch (err) {
      console.error('Error al eliminar producción:', err);
      alert(`Hubo un error al eliminar el registro de producción: ${err.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  // Resumen de ingredientes para mostrar en la confirmación
  const confirmationList = useMemo(() => {
    if (!selectedRecipe) return [];
    return (selectedRecipe.recipe_ingredients ?? []).map((ri) => {
      const actualQty = parseFloat(ingredientQuantities[ri.id]) || 0;
      const ing = ri.ingredients;
      return {
        id: ri.id,
        name: ing?.name ?? 'Ingrediente',
        unit: ing?.unit ?? '',
        qty: actualQty,
      };
    });
  }, [selectedRecipe, ingredientQuantities]);

  if (loading) {
    return (
      <div className="app-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-16)' }}>
        <LoadingSpinner size="lg" text="Cargando operaciones de producción..." />
      </div>
    );
  }

  return (
    <div className="app-content production-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>🥣 Producción</h1>
          <p>Registra las recetas que has preparado para descontar ingredientes del inventario automáticamente</p>
        </div>
      </div>

      <div className="production-recipe-select-card">
        <Field label="Selecciona la receta a preparar">
          <Select
            value={selectedRecipeId}
            onChange={(e) => setSelectedRecipeId(e.target.value)}
          >
            <option value="">-- Elige una receta --</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.units_per_batch} unid/bandeja)
              </option>
            ))}
          </Select>
        </Field>

        {loadingRecipe && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
            <LoadingSpinner size="md" text="Cargando detalles de la receta..." />
          </div>
        )}

        {selectedRecipe && !loadingRecipe && (
          <form className="animate-fade-in" onSubmit={handleRegisterClick}>
            <div className="production-form-header">
              <span className="production-form-title">
                👩‍🍳 Receta: {selectedRecipe.name}
              </span>
              
              <div className="production-batch-control">
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>
                  Bandejas a producir:
                </span>
                <button
                  type="button"
                  className="production-batch-btn"
                  onClick={() => handleBatchesChange(batches - 1)}
                >
                  -
                </button>
                <span className="production-batch-val">{batches}</span>
                <button
                  type="button"
                  className="production-batch-btn"
                  onClick={() => handleBatchesChange(batches + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                Se producirán en total <strong>{selectedRecipe.units_per_batch * batches} unidades</strong>.
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Confirma abajo las cantidades exactas gastadas. Puedes editarlas si usaste un poco más o un poco menos.
              </p>
            </div>

            <div className="production-ingredients-list">
              <div
                className="production-ingredient-row"
                style={{
                  background: 'var(--color-warm-50)',
                  fontWeight: 'bold',
                  borderBottom: '2px solid var(--color-border)',
                }}
              >
                <div className="production-ing-name">Ingrediente</div>
                <div className="production-ing-stock">Stock actual</div>
                <div className="production-ing-needed">Sugerido Receta</div>
                <div className="production-ing-input-header">Gastado Real</div>
              </div>

              {(selectedRecipe.recipe_ingredients ?? []).map((ri) => {
                const ing = ri.ingredients;
                const stock = ing?.inventory?.[0]?.current_stock ?? 0;
                const needed = ri.quantity_used * batches;
                const isInsufficient = stock < needed;
                
                return (
                  <div key={ri.id} className="production-ingredient-row">
                    <div className="production-ing-name">
                      {ing?.name}
                    </div>
                    
                    <div className="production-ing-stock">
                      <span className={isInsufficient ? 'text-error font-bold' : 'text-success'}>
                        {formatQuantity(stock, ing?.unit)}
                      </span>
                    </div>

                    <div className="production-ing-needed">
                      {formatQuantity(needed, ing?.unit)}
                    </div>

                    <div className="production-ing-input-wrapper">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={ingredientQuantities[ri.id] ?? ''}
                        onChange={(e) => handleQuantityChange(ri.id, e.target.value)}
                        style={{ width: '90px' }}
                      />
                      <span className="production-ing-input-unit">{ing?.unit}</span>
                      <button
                        type="button"
                        className="production-use-suggested-btn"
                        title={`Usar cantidad sugerida: ${formatQuantity(needed, ing?.unit)}`}
                        onClick={() => handleQuantityChange(ri.id, needed)}
                      >
                        ✓ Sugerido
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Field label="Notas adicionales (opcional)">
              <Textarea
                placeholder="Ej: La masa quedó un poco más seca y agregué 50 ml más de leche. O todo salió perfecto."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </Field>

            {isStockInsufficient && (
              <div className="production-stock-warning">
                ⚠️ Uno o más ingredientes no tienen suficiente stock actual. Por favor repone el inventario o ajusta la cantidad gastada real.
              </div>
            )}

            <div className="production-submit-section">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isStockInsufficient}
              >
                Registrar producción 🥣
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Historial de producciones al fondo */}
      <Card className="production-history-card">
        <CardHeader>
          <h3>📋 Historial de Producción</h3>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {logs.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No hay registros de producción anteriores.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Receta</th>
                    <th>Unidades producidas</th>
                    <th>Ingredientes gastados</th>
                    <th>Notas</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const ingSummary = (log.actual_ingredients ?? [])
                      .map((act) => {
                        const originalIng = selectedRecipe?.recipe_ingredients?.find(
                          (ri) => ri.ingredient_id === act.ingredientId
                        )?.ingredients;
                        // Si no está disponible en la receta cargada, sólo mostramos el ID o buscamos
                        return `${formatQuantity(act.quantityUsed, originalIng?.unit ?? '')}`;
                      })
                      .join(', ');

                    return (
                      <tr key={log.id}>
                        <td>
                          <div className="history-log-date">{formatDateTime(log.date)}</div>
                        </td>
                        <td>
                          <div className="history-log-recipe">{log.recipes?.name ?? 'Receta eliminada'}</div>
                        </td>
                        <td className="font-bold text-primary">
                          +{log.units_produced} unid.
                        </td>
                        <td>
                          <div className="history-log-ingredients-summary">
                            {log.actual_ingredients?.length ?? 0} ingredientes
                          </div>
                        </td>
                        <td>
                          <div className="history-log-notes" title={log.notes}>
                            {log.notes || '—'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="production-delete-log-btn"
                            title="Eliminar producción y revertir inventario"
                            onClick={() => handleDeleteClick(log)}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal de confirmación */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="🥣 ¿Confirmar producción?"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Volver a revisar
            </Button>
            <Button variant="primary" loading={saving} onClick={handleConfirmSubmit}>
              Sí, descontar inventario
            </Button>
          </>
        }
      >
        <p>Al confirmar, se descontarán las siguientes cantidades reales de tu inventario:</p>
        <div className="production-confirm-list">
          {confirmationList.map((item) => (
            <div key={item.id} className="production-confirm-item">
              <span className="production-confirm-name">{item.name}</span>
              <span className="production-confirm-qty">
                {formatQuantity(item.qty, item.unit)}
              </span>
            </div>
          ))}
        </div>
        {notes.trim() && (
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', background: 'var(--color-warm-50)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
            <strong>Nota:</strong> &ldquo;{notes}&rdquo;
          </p>
        )}
      </Modal>

      {/* Modal de éxito */}
      <Modal
        isOpen={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="✓ ¡Producción Registrada!"
        size="sm"
        footer={
          <Button variant="primary" onClick={() => setSuccessOpen(false)}>
            Entendido
          </Button>
        }
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--space-2)' }}>🎂</span>
          <p style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
            ¡Inventario actualizado correctamente!
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Las cantidades confirmadas ya fueron restadas de tu stock.
          </p>
        </div>
      </Modal>

      {/* Modal para eliminar producción */}
      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="⚠️ ¿Eliminar registro de producción?"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDeleteConfirm}>
              Sí, eliminar y devolver stock
            </Button>
          </>
        }
      >
        <p style={{ marginBottom: 'var(--space-3)' }}>
          ¿Estás seguro de que quieres eliminar esta producción del historial?
        </p>
        <div className="alert alert-warning" style={{ fontSize: 'var(--font-size-sm)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
          <strong>⚠️ Importante:</strong> Esta acción es irreversible. Se realizarán los siguientes cambios:
          <ul style={{ marginLeft: 'var(--space-5)', marginTop: 'var(--space-2)' }}>
            <li>Se devolverá la cantidad de ingredientes utilizada al inventario.</li>
            <li>Se restarán las {logToDelete?.units_produced ?? 0} unidades producidas del stock de productos terminados.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}
