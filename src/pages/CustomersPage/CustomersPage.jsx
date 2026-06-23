import { useState, useEffect, useMemo } from 'react';
import {
  getCustomersWithHistory,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../../services/customers.service';
import { formatCurrency } from '../../utils/formatters';
import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input, Textarea } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import './CustomersPage.css';

const EMPTY_FORM = { name: '', phone: '', notes: '' };

// ── Periodos predefinidos ────────────────────────────────────────────────────
const PERIODS = [
  { key: 'month',  label: 'Este mes' },
  { key: '3months',label: 'Últimos 3 meses' },
  { key: 'year',   label: 'Este año' },
  { key: 'all',    label: 'Todo el tiempo' },
];

function getPeriodDates(key) {
  const now = new Date();
  let start = null;
  const end = now.toISOString().split('T')[0];
  if (key === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  } else if (key === '3months') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    start = d.toISOString().split('T')[0];
  } else if (key === 'year') {
    start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  }
  return { start, end: key === 'all' ? null : end };
}

// ── Tarjeta de cliente ───────────────────────────────────────────────────────
function CustomerCard({ customer, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const stats = customer._stats;
  const initial = customer.name.charAt(0).toUpperCase();

  return (
    <Card hoverable className="customer-card animate-fade-in-up">
      <CardBody className="customer-card-body">
        {/* Header */}
        <div className="customer-main-info">
          <div className="customer-avatar">{initial}</div>
          <div className="customer-details">
            <span className="customer-name">{customer.name}</span>
            {customer.phone && (
              <span className="customer-phone">📞 {customer.phone}</span>
            )}
            {customer.notes && (
              <span className="customer-notes">📝 {customer.notes}</span>
            )}
          </div>
          <div className="customer-actions">
            <Button variant="ghost" size="sm" icon onClick={() => onEdit(customer)} title="Editar">✏️</Button>
            <Button variant="ghost" size="sm" icon onClick={() => onDelete(customer)} title="Eliminar">🗑️</Button>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="customer-stats-row">
          <div className="customer-stat">
            <span className="customer-stat-value">{stats.ordersCount}</span>
            <span className="customer-stat-label">pedidos</span>
          </div>
          <div className="customer-stat-divider" />
          <div className="customer-stat">
            <span className="customer-stat-value">{formatCurrency(stats.totalSpent)}</span>
            <span className="customer-stat-label">total gastado</span>
          </div>
          {stats.ordersCount > 0 && (
            <>
              <div className="customer-stat-divider" />
              <div className="customer-stat">
                <span className="customer-stat-value">
                  {formatCurrency(stats.ordersCount ? stats.totalSpent / stats.ordersCount : 0)}
                </span>
                <span className="customer-stat-label">promedio pedido</span>
              </div>
            </>
          )}
        </div>

        {/* Productos favoritos */}
        {stats.topProducts.length > 0 && (
          <div className="customer-top-products">
            <span className="customer-top-products-label">⭐ Lo que más compra:</span>
            <div className="customer-product-pills">
              {stats.topProducts.map((p) => (
                <span key={p.name} className="product-pill">
                  {p.name} <span className="product-pill-qty">×{p.qty}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Expandible: historial detallado */}
        {stats.recentSales.length > 0 && (
          <>
            <button
              className="customer-expand-btn"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? '▲ Ocultar historial' : '▼ Ver últimas compras'}
            </button>

            {expanded && (
              <div className="customer-history">
                {stats.recentSales.map((sale) => (
                  <div key={sale.id} className="customer-history-item">
                    <div className="customer-history-date">
                      📅 {new Date(sale.sale_date + 'T12:00:00').toLocaleDateString('es-CO', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </div>
                    <div className="customer-history-products">
                      {(sale.sale_items ?? []).map((item, i) => (
                        <span key={i} className="history-product-item">
                          {item.recipes?.name} ×{item.quantity}
                        </span>
                      ))}
                    </div>
                    <div className="customer-history-total">
                      {formatCurrency(sale.total)}
                      {sale.is_paid
                        ? <span className="badge-paid">✓ Pagado</span>
                        : <span className="badge-pending">⏳ Pendiente</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {stats.ordersCount === 0 && (
          <div className="customer-no-orders">Sin pedidos en este periodo</div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [customers, setCustomers]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [period, setPeriod]           = useState('month');
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [errors, setErrors]           = useState({});
  const [saving, setSaving]           = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadCustomers = async (selectedPeriod = period) => {
    setLoading(true);
    try {
      const { start, end } = getPeriodDates(selectedPeriod);
      const data = await getCustomersWithHistory(start, end);
      setCustomers(data);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers(period);
  }, [period]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({ name: customer.name, phone: customer.phone ?? '', notes: customer.notes ?? '' });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'El nombre es obligatorio';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCustomer(editing.id, form);
      } else {
        await createCustomer(form);
      }
      setModalOpen(false);
      await loadCustomers();
    } catch (error) {
      console.error('Error al guardar cliente:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      await loadCustomers();
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
    }
  };

  const filtered = useMemo(() =>
    customers.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
    ), [customers, search]);

  // Ordenar: primero los que tienen más pedidos en el periodo
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => b._stats.totalSpent - a._stats.totalSpent),
    [filtered]
  );

  // Totales del periodo
  const periodTotals = useMemo(() => ({
    totalCustomers: filtered.length,
    withOrders: filtered.filter(c => c._stats.ordersCount > 0).length,
    totalRevenue: filtered.reduce((sum, c) => sum + c._stats.totalSpent, 0),
  }), [filtered]);

  return (
    <div className="app-content animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>👥 Clientes</h1>
          <p>Historial de compras y datos de contacto de tus clientes.</p>
        </div>
        <Button onClick={openCreate}>+ Agregar cliente</Button>
      </div>

      {/* Filtro de periodo */}
      <div className="period-filter-row">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={`period-pill${period === p.key ? ' active' : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Resumen del periodo */}
      {!loading && (
        <div className="customers-summary-row">
          <div className="customers-summary-card">
            <span className="summary-icon">👥</span>
            <div>
              <div className="summary-value">{periodTotals.totalCustomers}</div>
              <div className="summary-label">clientes totales</div>
            </div>
          </div>
          <div className="customers-summary-card">
            <span className="summary-icon">🛍️</span>
            <div>
              <div className="summary-value">{periodTotals.withOrders}</div>
              <div className="summary-label">compraron en este periodo</div>
            </div>
          </div>
          <div className="customers-summary-card">
            <span className="summary-icon">💰</span>
            <div>
              <div className="summary-value">{formatCurrency(periodTotals.totalRevenue)}</div>
              <div className="summary-label">ingresos del periodo</div>
            </div>
          </div>
        </div>
      )}

      {/* Buscador */}
      <div className="search-bar">
        <Input
          id="customer-search"
          placeholder="🔍 Buscar cliente por nombre o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Contenido */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <LoadingSpinner size="lg" text="Cargando clientes..." />
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">👥</span>
          <h3>{search ? 'Sin resultados' : '¡Aún no hay clientes!'}</h3>
          <p>
            {search
              ? `No encontramos coincidencias para "${search}"`
              : 'Los clientes se registran automáticamente al crear una venta con su nombre.'}
          </p>
          {!search && (
            <Button onClick={openCreate} style={{ marginTop: 'var(--space-4)' }}>
              + Agregar primer cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="customers-grid">
          {sorted.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Modal: Crear/Editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '✏️ Editar cliente' : '👥 Agregar cliente'}
        size="md"
      >
        <form onSubmit={handleSave} className="customer-form">
          <Field label="Nombre completo" required error={errors.name}>
            <Input
              id="cust-name"
              placeholder="Ej: María González"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
            />
          </Field>
          <Field label="Teléfono de contacto">
            <Input
              id="cust-phone"
              placeholder="Ej: 3123456789"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Notas / Preferencias">
            <Textarea
              id="cust-notes"
              placeholder="Ej: Prefiere tortas bajas en dulce, entrega los domingos."
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Guardar cambios' : 'Registrar cliente'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirmar eliminación */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="🗑️ Eliminar cliente"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Sí, eliminar</Button>
          </>
        }
      >
        <p>¿Estás segura de eliminar a <strong>{deleteTarget?.name}</strong>?</p>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
          Esta acción no afectará el historial de ventas anteriores.
        </p>
      </Modal>
    </div>
  );
}
