import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getExtraCostItems,
  createExtraCostItem,
  updateExtraCostItem,
  deleteExtraCostItem,
} from '../../services/extra_costs.service';
import { getProviders } from '../../services/providers.service';
import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input, Select } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Badge from '../../components/ui/Badge';
import { formatCurrency, getExtraCostTypeLabel, EXTRA_COST_TYPES } from '../../utils/formatters';
import './ExtraCostsPage.css';

const EMPTY_FORM = { name: '', provider: '', type: 'packaging', quantity_sold: '1', price: '' };

export default function ExtraCostsPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showProviderSuggestions, setShowProviderSuggestions] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      const [data, provs] = await Promise.all([getExtraCostItems(), getProviders()]);
      setItems(data);
      setProviders(provs);
    } catch (error) {
      console.error('Error al cargar conceptos de costos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      provider: item.provider ?? '',
      type: item.type,
      quantity_sold: (item.quantity_sold ?? 1).toString(),
      price: (item.price ?? item.unit_price).toString(),
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'El nombre es obligatorio';
    if (!form.quantity_sold || parseFloat(form.quantity_sold) <= 0) e.quantity_sold = 'Cantidad inválida';
    if (!form.price || parseFloat(form.price) < 0) e.price = 'Precio inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateExtraCostItem(editing.id, form);
      } else {
        await createExtraCostItem(form);
      }
      setModalOpen(false);
      await loadItems();
    } catch (error) {
      console.error('Error al guardar concepto:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExtraCostItem(deleteTarget.id);
      setDeleteTarget(null);
      await loadItems();
    } catch (error) {
      alert('No se pudo eliminar. Es posible que esta plantilla de costo esté en uso en alguna receta.');
      console.error(error);
    }
  };

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-content animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>💸 Plantillas de Otros Costos</h1>
          <p>Registra empaques, mano de obra y servicios comunes para seleccionarlos rápidamente al crear recetas.</p>
        </div>
        {isAdmin && <Button onClick={openCreate}>+ Registrar costo</Button>}
      </div>

      <div className="search-bar">
        <Input
          id="extra-cost-search"
          placeholder="🔍 Buscar costo por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <LoadingSpinner size="lg" text="Cargando plantillas..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">💸</span>
          <h3>{search ? 'Sin resultados' : '¡Aún no hay plantillas!'}</h3>
          <p>
            {search
              ? `No encontramos nada para "${search}"`
              : 'Registra los empaques, servicios y mano de obra para reusarlos en tus recetas.'}
          </p>
          {!search && isAdmin && (
            <Button onClick={openCreate} style={{ marginTop: 'var(--space-4)' }}>
              + Registrar primer costo
            </Button>
          )}
        </div>
      ) : (
        <div className="extra-costs-layout-grid-custom">
          {filtered.map((item) => (
            <Card hoverable key={item.id} className="extra-cost-card animate-fade-in-up">
              <CardBody className="extra-cost-card-body">
                <div className="extra-cost-main-info">
                  <span className="extra-cost-icon">💸</span>
                  <div className="extra-cost-details">
                    <span className="extra-cost-name">{item.name}</span>
                    {item.provider && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        🏪 {item.provider}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                      <Badge variant="neutral" style={{ fontSize: 'var(--font-size-xs)' }}>
                        {getExtraCostTypeLabel(item.type)}
                      </Badge>
                      <span className="extra-cost-price">{formatCurrency(item.unit_price)}/ud</span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        ({item.quantity_sold} ud × {formatCurrency(item.price ?? item.unit_price * item.quantity_sold)})
                      </span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="extra-cost-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon
                      onClick={() => openEdit(item)}
                      title="Editar"
                    >
                      ✏️
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon
                      onClick={() => setDeleteTarget(item)}
                      title="Eliminar"
                    >
                      🗑️
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Registrar/Editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '✏️ Editar Costo' : '💸 Registrar Costo'}
        size="md"
      >
        <form onSubmit={handleSave} className="extra-cost-form">
          <Field label="Nombre del concepto" required error={errors.name}>
            <Input
              id="ext-name"
              placeholder="Ej: Caja mediana de brownie"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
            />
          </Field>

          <Field label="Proveedor (dónde lo compras)">
            <div style={{ position: 'relative' }}>
              <Input
                id="ext-provider"
                placeholder="Ej: Papeúlia, Dispropan..."
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                onFocus={() => setShowProviderSuggestions(true)}
                onBlur={() => setTimeout(() => setShowProviderSuggestions(false), 200)}
                iconLeft="🏪"
              />
              {showProviderSuggestions && providers.filter(p =>
                p.name.toLowerCase().includes((form.provider ?? '').toLowerCase())
              ).length > 0 && (
                <div className="provider-suggestions-dropdown">
                  {providers
                    .filter(p => p.name.toLowerCase().includes((form.provider ?? '').toLowerCase()))
                    .map((p) => (
                      <div
                        key={p.id}
                        className="suggestion-item"
                        onMouseDown={() => {
                          setForm({ ...form, provider: p.name });
                          setShowProviderSuggestions(false);
                        }}
                      >
                        🏪 {p.name}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </Field>

          <Field label="Tipo de costo">
            <Select
              id="ext-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {EXTRA_COST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="extra-cost-form-row">
            <Field
              label="Cantidad en el paquete"
              hint="¿Cuántas unidades trae lo que compras?"
              required
              error={errors.quantity_sold}
            >
              <Input
                id="ext-qty"
                type="number"
                min="1"
                step="any"
                placeholder="Ej: 100"
                value={form.quantity_sold}
                onChange={(e) => setForm({ ...form, quantity_sold: e.target.value })}
                error={errors.quantity_sold}
              />
            </Field>

            <Field
              label="Precio del paquete"
              hint={(() => {
                const qty = parseFloat(form.quantity_sold);
                const prc = parseFloat(form.price);
                if (qty > 0 && prc > 0) {
                  const u = prc / qty;
                  return `Costo por unidad: $${u.toFixed(2)}`;
                }
                return 'Precio total de lo que compraste';
              })()}
              required
              error={errors.price}
            >
              <Input
                id="ext-price"
                type="number"
                min="0"
                step="any"
                prefix="$"
                placeholder="Ej: 5000"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                error={errors.price}
              />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Delete */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="🗑️ Eliminar Costo"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Sí, eliminar
            </Button>
          </>
        }
      >
        <p>¿Estás segura de eliminar a <strong>{deleteTarget?.name}</strong>?</p>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
          Esto borrará la plantilla pero no modificará las recetas existentes que ya hayan copiado este costo.
        </p>
      </Modal>
    </div>
  );
}
