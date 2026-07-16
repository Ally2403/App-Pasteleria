import { useState, useEffect, useMemo } from 'react';
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  updateStock,
} from '../../services/ingredients.service';
import { getProviders } from '../../services/providers.service';
import { calcUnitPrice } from '../../utils/calculations';
import { formatCurrency, formatQuantity, UNITS } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input, Select } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import './IngredientsPage.css';

// ── Formulario de ingrediente ─────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '', provider: '', quantity_sold: '', unit: 'gr', price: '',
};

function IngredientForm({ initial, providers = [], onSave, onClose }) {
  const [form, setForm]     = useState(initial ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showSuggestions, setShowSuggestions] = useState(false);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const previewUnitPrice = useMemo(() => {
    const price = parseFloat(form.price);
    const qty   = parseFloat(form.quantity_sold);
    if (!price || !qty || qty === 0) return null;
    return calcUnitPrice(price, qty);
  }, [form.price, form.quantity_sold]);

  const filteredSuggestions = useMemo(() => {
    const query = form.provider.trim().toLowerCase();
    if (!query) return providers;
    return providers.filter(p => p.name.toLowerCase().includes(query));
  }, [providers, form.provider]);

  const validate = () => {
    const e = {};
    if (!form.name.trim())            e.name          = 'Escribe el nombre';
    if (!form.provider.trim())        e.provider       = 'Escribe el proveedor';
    if (!form.quantity_sold || +form.quantity_sold <= 0) e.quantity_sold = 'Cantidad inválida';
    if (!form.price         || +form.price <= 0)         e.price         = 'Precio inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        quantity_sold: parseFloat(form.quantity_sold),
        price:         parseFloat(form.price),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="ingredient-form" onSubmit={handleSubmit} noValidate>
      <Field label="Nombre del ingrediente" required error={errors.name}>
        <Input id="ing-name" placeholder="Ej: Harina de arroz" value={form.name}
          onChange={(e) => set('name', e.target.value)} error={errors.name} />
      </Field>

      <Field label="Proveedor (dónde lo compras)" required error={errors.provider}>
        <div style={{ position: 'relative' }}>
          <Input id="ing-provider" placeholder="Ej: Dispropan" value={form.provider}
            onChange={(e) => set('provider', e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            error={errors.provider} iconLeft="🏪" />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="provider-suggestions-dropdown">
              {filteredSuggestions.map((p) => (
                <div
                  key={p.id}
                  className="suggestion-item"
                  onMouseDown={() => {
                    set('provider', p.name);
                    setShowSuggestions(false);
                  }}
                >
                  🏪 {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </Field>

      <div className="ingredient-form-row">
        <Field label="Cantidad que venden" required error={errors.quantity_sold}>
          <Input id="ing-qty" type="number" min="0" step="any"
            placeholder="Ej: 500" value={form.quantity_sold}
            onChange={(e) => set('quantity_sold', e.target.value)} error={errors.quantity_sold} />
        </Field>

        <Field label="Unidad">
          <Select id="ing-unit" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Precio de esa cantidad" required error={errors.price}
        hint="El precio unitario se calcula automáticamente">
        <Input id="ing-price" type="number" min="0" step="any"
          placeholder="Ej: 3500" value={form.price} prefix="$"
          onChange={(e) => set('price', e.target.value)} error={errors.price} />
      </Field>

      {previewUnitPrice !== null && (
        <div className="price-preview">
          <div className="price-preview-label">💡 Precio por {form.unit}</div>
          <div className="price-preview-value">{formatCurrency(previewUnitPrice)}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>
          {initial ? 'Guardar cambios' : 'Agregar ingrediente 🌸'}
        </Button>
      </div>
    </form>
  );
}

// ── Tarjeta de ingrediente ────────────────────────────────────────────────────
function IngredientCard({ ingredient, onEdit, onDelete, onStockChange }) {
  const [editingStock, setEditingStock] = useState(false);
  const [stockVal,     setStockVal]     = useState('');

  const stock = ingredient.inventory?.[0]?.current_stock ?? 0;

  const handleStockSave = async () => {
    const newStock = parseFloat(stockVal);
    if (!isNaN(newStock) && newStock >= 0) {
      try {
        await onStockChange(ingredient.id, newStock);
        setEditingStock(false);
      } catch (err) {
        console.error('Error al actualizar stock:', err);
        alert(`No se pudo actualizar el stock: ${err.message || err}`);
      }
    } else {
      setEditingStock(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleStockSave();
    } else if (e.key === 'Escape') {
      setEditingStock(false);
    }
  };

  return (
    <Card hoverable className="ingredient-card animate-fade-in-up">
      <CardBody>
        <div className="ingredient-card-header">
          <div className="ingredient-card-name">📦 {ingredient.name}</div>
          <div className="ingredient-card-actions">
            <Button variant="ghost" size="sm" icon onClick={() => onEdit(ingredient)} title="Editar">✏️</Button>
            <Button variant="ghost" size="sm" icon onClick={() => onDelete(ingredient)} title="Eliminar">🗑️</Button>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div className="ingredient-info-row">
            <span className="ingredient-info-label">🏪 Proveedor</span>
            <span className="ingredient-info-value">{ingredient.provider}</span>
          </div>
          <div className="ingredient-info-row">
            <span className="ingredient-info-label">📏 Venden</span>
            <span className="ingredient-info-value">{formatQuantity(ingredient.quantity_sold, ingredient.unit)}</span>
          </div>
          <div className="ingredient-info-row">
            <span className="ingredient-info-label">💰 Precio pack</span>
            <span className="ingredient-info-value">{formatCurrency(ingredient.price)}</span>
          </div>
        </div>

        <div className="ingredient-unit-price">
          <span className="ingredient-unit-price-label">Precio por {ingredient.unit}</span>
          <span className="ingredient-unit-price-value">{formatCurrency(ingredient.unit_price)}</span>
        </div>

        <div className="stock-section">
          <span className="stock-label">📊 Stock actual</span>
          {editingStock ? (
            <div className="stock-input-row">
              <Input
                type="number" min="0" step="any"
                style={{ width: '90px', padding: '4px 8px' }}
                value={stockVal}
                onChange={(e) => setStockVal(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <Button size="sm" onClick={handleStockSave}>✓</Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingStock(false)}>✕</Button>
            </div>
          ) : (
            <div className="stock-input-row">
              <span className="stock-value">{formatQuantity(stock, ingredient.unit)}</span>
              <Button variant="ghost" size="sm" icon
                onClick={() => { setStockVal(stock); setEditingStock(true); }}
                title="Actualizar stock">
                ✏️
              </Button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState([]);
  const [providers,   setProviders]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [notification, setNotification] = useState(null); // { message, type }

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const loadIngredients = async () => {
    setLoading(true);
    try {
      const data = await getIngredients();
      setIngredients(data);
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      const data = await getProviders();
      setProviders(data);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
    }
  };

  useEffect(() => {
    loadIngredients();
    loadProviders();
  }, []);

  const filtered = useMemo(() =>
    ingredients.filter((i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.provider || '').toLowerCase().includes(search.toLowerCase())
    ), [ingredients, search]);

  const handleSave = async (formData) => {
    if (editing) {
      await updateIngredient(editing.id, formData);
    } else {
      await createIngredient(formData);
    }
    await Promise.all([loadIngredients(), loadProviders()]);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteIngredient(deleteTarget.id);
    setDeleteTarget(null);
    await Promise.all([loadIngredients(), loadProviders()]);
  };

  const handleStockChange = async (ingredientId, newStock) => {
    try {
      await updateStock(ingredientId, newStock);
      setNotification({ message: 'Stock actualizado correctamente. 🎉', type: 'success' });
      await loadIngredients();
    } catch (err) {
      console.error('Error al actualizar stock:', err);
      setNotification({ message: `No se pudo actualizar el stock: ${err.message || err}`, type: 'error' });
      throw err; // Relanzar para que el card sepa que no debe cerrar el modo edición
    }
  };

  return (
    <div className="app-content animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>📦 Ingredientes</h1>
          <p>Gestiona todos los ingredientes y su stock disponible</p>
        </div>
        <Button
          id="add-ingredient-btn"
          onClick={() => { setEditing(null); setModalOpen(true); }}
        >
          + Agregar ingrediente
        </Button>
      </div>

      {notification && (
        <div className={`notification-banner banner-${notification.type} animate-fade-in`}>
          <span className="notification-message">{notification.message}</span>
          <button className="banner-close-btn" onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* Búsqueda */}
      <div className="search-bar">
        <Input
          id="ingredient-search"
          placeholder="🔍 Buscar ingrediente o proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Contenido */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <LoadingSpinner size="lg" text="Cargando ingredientes..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <h3>{search ? 'Sin resultados' : '¡Aún no hay ingredientes!'}</h3>
          <p>{search
            ? `No encontramos nada para "${search}"`
            : 'Agrega tu primer ingrediente para empezar a gestionar tus recetas.'
          }</p>
          {!search && (
            <Button onClick={() => { setEditing(null); setModalOpen(true); }} style={{ marginTop: 'var(--space-4)' }}>
              + Agregar primer ingrediente
            </Button>
          )}
        </div>
      ) : (
        <div className="ingredients-grid">
          {filtered.map((ingredient, i) => (
            <div key={ingredient.id} className={`delay-${[0, 75, 150, 300][i % 4]}`}>
              <IngredientCard
                ingredient={ingredient}
                onEdit={(ing) => { setEditing(ing); setModalOpen(true); }}
                onDelete={setDeleteTarget}
                onStockChange={handleStockChange}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modal: Crear/Editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? '✏️ Editar ingrediente' : '📦 Agregar ingrediente'}
        size="md"
      >
        <IngredientForm
          initial={editing}
          providers={providers}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditing(null); }}
        />
      </Modal>

      {/* Modal: Confirmar eliminación */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="🗑️ Eliminar ingrediente"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Sí, eliminar</Button>
          </>
        }
      >
        <p>¿Estás segura de eliminar <strong>{deleteTarget?.name}</strong>?</p>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
          Esta acción no se puede deshacer y eliminará también su historial de stock.
        </p>
      </Modal>
    </div>
  );
}
