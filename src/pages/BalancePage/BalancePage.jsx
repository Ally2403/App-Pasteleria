import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import {
  getOtherPurchases,
  createOtherPurchase,
  updateOtherPurchase,
  deleteOtherPurchase,
} from '../../services/other_purchases.service';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Field, Input, Select } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatCurrency } from '../../utils/formatters';
import './BalancePage.css';

const CATEGORIES = [
  { value: 'equipamiento', label: '🛠️ Moldes / Utensilios' },
  { value: 'servicios', label: '🔌 Servicios / Gas / Luz' },
  { value: 'publicidad', label: '📢 Publicidad / Volantes' },
  { value: 'otros', label: '📦 Otros egresos' },
];

export default function BalancePage() {
  const { isAdmin } = useAuth();

  // Filtros de fecha (por mes y año)
  const today = new Date();
  const currentMonthStr = String(today.getMonth() + 1).padStart(2, '0');
  const currentYearStr = String(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);

  // Estados de datos
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balanceMetrics, setBalanceMetrics] = useState({
    income: 0,
    productionCost: 0,
    templatesCost: 0,
    purchasesCost: 0,
    totalExpenses: 0,
    netProfit: 0
  });

  // Estados del formulario de compras no programadas
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    price: '',
    quantity: '1',
    category: 'equipamiento',
    purchase_date: today.toISOString().split('T')[0],
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Cargar datos
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Cargar las compras no programadas
      const purchasesData = await getOtherPurchases();
      setPurchases(purchasesData);

      // 2. Calcular métricas para el mes seleccionado
      await calculateMonthlyBalance(purchasesData, selectedMonth, selectedYear);
    } catch (error) {
      console.error('Error al cargar datos de balance:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  // Lógica de cálculo del balance mensual
  const calculateMonthlyBalance = async (purchasesList, month, year) => {
    const startDate = `${year}-${month}-01`;
    // Obtener último día del mes
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    try {
      // A. Ingresos Reales: abonos recibidos en ventas en este rango de fechas
      // (Opcionalmente, podemos sumar los abonos recibidos, o el total si la venta es inmediata)
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total, amount_paid, is_paid, sale_date')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate);

      if (salesError) throw salesError;

      let totalIncome = 0;
      salesData.forEach(sale => {
        // Ingreso real es lo abonado o pagado
        const amountPaidVal = sale.amount_paid ?? (sale.is_paid ? sale.total : 0);
        totalIncome += amountPaidVal;
      });

      // B. Costos de producción de recetas del mes (ingredientes descontados en registros de producción)
      const { data: prodData, error: prodError } = await supabase
        .from('production_logs')
        .select(`
          id, 
          created_at,
          recipes (cost_price)
        `)
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lte('created_at', `${endDate}T23:59:59Z`);

      if (prodError) throw prodError;

      let totalProductionCost = 0;
      prodData.forEach(log => {
        if (log.recipes?.cost_price) {
          totalProductionCost += log.recipes.cost_price;
        }
      });

      // C. Costos de plantillas / empaques aplicados en ventas entregadas del mes
      const { data: salesItemsData, error: salesItemsError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_items (
            quantity,
            recipes (
              recipe_extra_costs (
                quantity_used,
                extra_cost_items (price, quantity_sold)
              )
            )
          )
        `)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .eq('status', 'completed'); // Solo entregados

      if (salesItemsError) throw salesItemsError;

      let totalTemplatesCost = 0;
      salesItemsData.forEach(sale => {
        (sale.sale_items || []).forEach(item => {
          const qty = item.quantity || 0;
          (item.recipes?.recipe_extra_costs || []).forEach(recCost => {
            const used = recCost.quantity_used || 0;
            const itemPrice = recCost.extra_cost_items?.price || 0;
            const packageQty = recCost.extra_cost_items?.quantity_sold || 1;
            const unitCost = itemPrice / packageQty;
            totalTemplatesCost += (unitCost * used) * qty;
          });
        });
      });

      // D. Costos no programados de la tabla other_purchases en el mes
      let totalPurchasesCost = 0;
      purchasesList.forEach(p => {
        const pDate = new Date(p.purchase_date);
        const pMonth = String(pDate.getMonth() + 1).padStart(2, '0');
        const pYear = String(pDate.getFullYear());
        if (pMonth === month && pYear === year) {
          totalPurchasesCost += (p.price * p.quantity);
        }
      });

      const totalExpenses = totalProductionCost + totalTemplatesCost + totalPurchasesCost;
      const netProfit = totalIncome - totalExpenses;

      setBalanceMetrics({
        income: totalIncome,
        productionCost: totalProductionCost,
        templatesCost: totalTemplatesCost,
        purchasesCost: totalPurchasesCost,
        totalExpenses,
        netProfit
      });

    } catch (err) {
      console.error('Error al calcular balances mensuales:', err);
    }
  };

  const handleOpenCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      price: '',
      quantity: '1',
      category: 'equipamiento',
      purchase_date: today.toISOString().split('T')[0],
      notes: ''
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      price: p.price.toString(),
      quantity: p.quantity.toString(),
      category: p.category,
      purchase_date: p.purchase_date,
      notes: p.notes || ''
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim()) {
      setFormError('Por favor escribe el nombre de la compra.');
      return;
    }
    if (!form.price || parseFloat(form.price) <= 0) {
      setFormError('Por favor escribe un precio válido mayor a 0.');
      return;
    }
    if (!form.quantity || parseInt(form.quantity) <= 0) {
      setFormError('La cantidad debe ser mínimo 1.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateOtherPurchase(editing.id, form);
      } else {
        await createOtherPurchase(form);
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      setFormError('Error al guardar el registro. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteOtherPurchase(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar la compra.');
    }
  };

  // Filtrar compras para la lista del mes seleccionado
  const monthlyPurchases = purchases.filter(p => {
    const pDate = new Date(p.purchase_date);
    const pMonth = String(pDate.getMonth() + 1).padStart(2, '0');
    const pYear = String(pDate.getFullYear());
    return pMonth === selectedMonth && pYear === selectedYear;
  });

  return (
    <div className="app-content balance-page-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>📊 Balance y Caja Mensual</h1>
          <p>Consulta las ganancias netas de la pastelería y lleva el control de todas las compras extras del negocio.</p>
        </div>
        {isAdmin && (
          <Button onClick={handleOpenCreate}>+ Registrar compra no programada</Button>
        )}
      </div>

      {/* ── Tarjeta de Balance General ── */}
      <div className="balance-summary-card">
        <div className="balance-header-row">
          <div className="balance-title-area">
            <h2>Balance General del Período</h2>
            <p>Resumen de ingresos percibidos y gastos totales del mes seleccionado.</p>
          </div>
          <div className="balance-period-selector">
            <Select
              id="balance-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ width: '130px' }}
            >
              <option value="01">Enero</option>
              <option value="02">Febrero</option>
              <option value="03">Marzo</option>
              <option value="04">Abril</option>
              <option value="05">Mayo</option>
              <option value="06">Junio</option>
              <option value="07">Julio</option>
              <option value="08">Agosto</option>
              <option value="09">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </Select>
            <Select
              id="balance-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{ width: '100px' }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
            <LoadingSpinner size="md" text="Calculando balance..." />
          </div>
        ) : (
          <div className="balance-metrics-grid">
            <div className="balance-metric-box income">
              <span className="balance-metric-label">💵 Ingresos Reales</span>
              <span className="balance-metric-value">{formatCurrency(balanceMetrics.income)}</span>
              <span className="balance-metric-sub">Abonos y pagos de ventas recibidos este mes</span>
            </div>

            <div className="balance-metric-box expense">
              <span className="balance-metric-label">💸 Egresos Totales</span>
              <span className="balance-metric-value">{formatCurrency(balanceMetrics.totalExpenses)}</span>
              <span className="balance-metric-sub">Suma de ingredientes, empaques y compras extras</span>
            </div>

            <div className={`balance-metric-box ${balanceMetrics.netProfit >= 0 ? 'profit' : 'loss'}`}>
              <span className="balance-metric-label">📈 Ganancia Neta</span>
              <span className="balance-metric-value">{formatCurrency(balanceMetrics.netProfit)}</span>
              <span className="balance-metric-sub">Lo que realmente quedó libre al final del mes</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Desglose de Gastos ── */}
      {!loading && (
        <div className="expenses-breakdown-section">
          <h3>Gastos Desglosados</h3>
          <div className="expenses-breakdown-grid">
            <div className="expense-breakdown-box">
              <span className="expense-breakdown-title">🍳 Costo de Producción</span>
              <span className="expense-breakdown-val">{formatCurrency(balanceMetrics.productionCost)}</span>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Ingredientes consumidos al registrar la producción.
              </p>
            </div>
            <div className="expense-breakdown-box">
              <span className="expense-breakdown-title">📦 Empaques y Costos Fijos</span>
              <span className="expense-breakdown-val">{formatCurrency(balanceMetrics.templatesCost)}</span>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Cajas y plantillas aplicadas a pedidos completados.
              </p>
            </div>
            <div className="expense-breakdown-box">
              <span className="expense-breakdown-title">🛠️ Compras Extras No Programadas</span>
              <span className="expense-breakdown-val">{formatCurrency(balanceMetrics.purchasesCost)}</span>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Moldes, utensilios, servicios o publicidad del mes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Listado de Compras no programadas ── */}
      <div className="balance-content-grid">
        <div className="purchases-list-card">
          <Card>
            <CardHeader>
              <h4>🛠️ Compras No Programadas de este Mes</h4>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
                  <LoadingSpinner size="sm" text="Cargando compras..." />
                </div>
              ) : monthlyPurchases.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🛠️</span>
                  <h3>No hay compras no programadas este mes</h3>
                  <p>Registra compras como moldes, servicios, etc., usando el botón superior.</p>
                </div>
              ) : (
                <div className="purchases-table-wrapper">
                  <table className="purchases-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th>Categoría</th>
                        <th>Cant.</th>
                        <th>Total</th>
                        <th>Registrado por</th>
                        {isAdmin && <th style={{ width: '80px' }}>Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyPurchases.map((p) => {
                        const registeredBy = p.profiles?.full_name || 'Desconocido';
                        return (
                          <tr key={p.id}>
                            <td>{new Date(p.purchase_date + 'T00:00:00').toLocaleDateString()}</td>
                            <td>
                              <strong>{p.name}</strong>
                              {p.notes && <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>{p.notes}</p>}
                            </td>
                            <td>
                              <span className={`purchase-cat-badge cat-${p.category}`}>
                                {CATEGORIES.find(c => c.value === p.category)?.label.split(' ')[1] || p.category}
                              </span>
                            </td>
                            <td>{p.quantity}</td>
                            <td><strong>{formatCurrency(p.price * p.quantity)}</strong></td>
                            <td>{registeredBy}</td>
                            {isAdmin && (
                              <td>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => handleOpenEdit(p)} className="purchase-actions-btn" title="Editar">✏️</button>
                                  <button onClick={() => setDeleteTarget(p)} className="purchase-actions-btn" title="Eliminar">🗑️</button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Formulario Rápido (Solo Visible si está el formulario modal cerrado pero útil de tener estructurado en modal) ── */}
      </div>

      {/* Modal: Agregar / Editar Compra */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? '✏️ Editar Compra No Programada' : '🛍️ Registrar Compra No Programada'}
        size="md"
      >
        <form onSubmit={handleSave} className="purchase-form">
          <Field label="Nombre del concepto / Artículo" required>
            <Input
              id="purchase-name"
              placeholder="Ej: Molde para torta desmontable 24cm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Field label="Cantidad" required>
              <Input
                id="purchase-qty"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>

            <Field label="Precio Unitario" required>
              <Input
                id="purchase-price"
                type="number"
                min="0.01"
                step="any"
                prefix="$"
                placeholder="Ej: 32000"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Field label="Categoría">
              <Select
                id="purchase-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Fecha de la compra" required>
              <Input
                id="purchase-date-input"
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Notas adicionales (opcional)">
            <textarea
              id="purchase-notes"
              className="input textarea"
              placeholder="Escribe alguna observación o el proveedor..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </Field>

          {formError && <div className="profile-error">{formError}</div>}

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Guardar Cambios' : 'Registrar Compra'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirmar Borrado */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="🗑️ Eliminar Registro"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Eliminar
            </Button>
          </>
        }
      >
        <p>¿Estás segura de eliminar la compra de <strong>{deleteTarget?.name}</strong>?</p>
      </Modal>
    </div>
  );
}
