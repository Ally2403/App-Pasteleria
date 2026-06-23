import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getRecipes } from '../../services/recipes.service';
import { getCustomers, createCustomer, getOrCreateCustomerByName } from '../../services/customers.service';
import { getSales, createSale, updateSaleStatus, deleteSale } from '../../services/sales.service';
import { getProductStock, adjustProductStock } from '../../services/product_stock.service';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getRecipePricing } from '../../utils/calculations';
import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input, Select, Textarea } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import './SalesPage.css';

export default function SalesPage() {
  const { user } = useAuth();

  // Tabs: 'sales' or 'stock'
  const [activeTab, setActiveTab] = useState('sales');

  // List states
  const [sales, setSales] = useState([]);
  const [productStocks, setProductStocks] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form: New Sale
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [isPaid, setIsPaid] = useState(true);
  const [saleStatus, setSaleStatus] = useState('completed');
  const [saleNotes, setSaleNotes] = useState('');
  const [saleItems, setSaleItems] = useState([{ recipeId: '', quantity: 1, unitPrice: 0 }]);

  // Form: Adjust Stock
  const [adjustRecipeId, setAdjustRecipeId] = useState('');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('damage'); // 'damage' | 'consumption' | 'other'
  const [adjustNotes, setAdjustNotes] = useState('');

  // Saving states
  const [savingSale, setSavingSale] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesData, stocksData, recipesData, customersData] = await Promise.all([
        getSales(),
        getProductStock(),
        getRecipes(),
        getCustomers(),
      ]);
      setSales(salesData);
      setProductStocks(stocksData);
      setRecipes(recipesData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error al cargar datos de ventas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const customerName = s.customers?.name || s.customer_name || 'Cliente general';
      const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.sale_items?.some(item => item.recipes?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === '' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sales, searchQuery, statusFilter]);

  // Open Sale Modal
  const openNewSale = () => {
    setSelectedCustomerId('');
    setCustomCustomerName('');
    setSaleDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('efectivo');
    setIsPaid(true);
    setSaleStatus('completed');
    setSaleNotes('');
    setSaleItems([{ recipeId: '', quantity: 1, unitPrice: 0 }]);
    setSaleModalOpen(true);
  };

  // Open Adjust Modal
  const openAdjustStock = (recipeId = '') => {
    setAdjustRecipeId(recipeId);
    setAdjustQty('');
    setAdjustReason('damage');
    setAdjustNotes('');
    setAdjustModalOpen(true);
  };

  // Dynamic calculations for New Sale
  const handleItemChange = (index, field, value) => {
    const updated = [...saleItems];
    updated[index][field] = value;

    if (field === 'recipeId') {
      const recipe = recipes.find(r => r.id === value);
      const price = getRecipePricing(recipe).rounded_price ?? 0;
      updated[index].unitPrice = price;
    }

    setSaleItems(updated);
  };

  const addItemRow = () => {
    setSaleItems([...saleItems, { recipeId: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItemRow = (index) => {
    if (saleItems.length === 1) return;
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const saleTotal = useMemo(() => {
    return saleItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [saleItems]);

  const handleSaveSale = async (e) => {
    e.preventDefault();
    if (saleItems.some(i => !i.recipeId || i.quantity <= 0)) {
      alert('Por favor selecciona un producto y cantidad válida para todos los items.');
      return;
    }
    setSavingSale(true);
    try {
      let finalCustomerId = selectedCustomerId;
      let finalCustomerName = null;

      // Si hay nombre escrito pero no hay cliente seleccionado del dropdown
      if (!selectedCustomerId && customCustomerName.trim() && customCustomerName.trim() !== 'Cliente general') {
        // Auto-registrar: buscar por nombre o crear nuevo
        const customer = await getOrCreateCustomerByName(customCustomerName.trim());
        finalCustomerId = customer.id;
        finalCustomerName = null; // ya está vinculado al cliente
      } else if (!selectedCustomerId) {
        finalCustomerName = customCustomerName.trim() || 'Cliente general';
      }

      const saleData = {
        customerId: finalCustomerId || null,
        customerName: finalCustomerId ? null : finalCustomerName,
        saleDate,
        paymentMethod,
        isPaid,
        status: saleStatus,
        notes: saleNotes,
        total: saleTotal,
        userId: user?.id,
      };

      await createSale(saleData, saleItems);
      setSaleModalOpen(false);
      await loadData();
    } catch (error) {
      console.error(error);
      alert('Error al registrar la venta. Verifica que tengas suficiente stock de producto terminado.');
    } finally {
      setSavingSale(false);
    }
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    const qty = parseInt(adjustQty);
    if (!adjustRecipeId || isNaN(qty) || qty === 0) {
      alert('Por favor especifica un producto y una cantidad de ajuste válida (diferente de cero).');
      return;
    }
    setSavingAdjustment(true);
    try {
      await adjustProductStock(
        adjustRecipeId,
        qty,
        adjustReason,
        adjustNotes,
        user?.id
      );
      setAdjustModalOpen(false);
      await loadData();
    } catch (error) {
      console.error(error);
      alert('Error al registrar el ajuste de stock.');
    } finally {
      setSavingAdjustment(false);
    }
  };

  const togglePaymentStatus = async (sale) => {
    const nextPaid = !sale.is_paid;
    try {
      await updateSaleStatus(sale.id, sale.status, nextPaid);
      await loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleDeliveryStatus = async (sale) => {
    const nextStatus = sale.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateSaleStatus(sale.id, nextStatus, sale.is_paid);
      await loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteSale = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSale(deleteTarget.id, user?.id);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      console.error(error);
      alert('Error al eliminar la venta.');
    }
  };

  return (
    <div className="app-content sales-page-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>💰 Ventas y Stock de Productos</h1>
          <p>Registra ventas, controla el dinero recibido y ajusta las mermas o consumo de productos terminados.</p>
        </div>
        <div className="page-header-actions">
          {activeTab === 'sales' ? (
            <Button onClick={openNewSale}>+ Registrar venta</Button>
          ) : (
            <Button onClick={() => openAdjustStock()}>⚙️ Ajustar Stock</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          🛍️ Registro de Ventas
        </button>
        <button
          className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          🍰 Stock de Productos Listos
        </button>
      </div>

      {activeTab === 'sales' ? (
        <>
          {/* Filters */}
          <div className="sales-filters-row">
            <div className="filter-input-wrapper">
              <Input
                id="sale-search"
                placeholder="🔍 Buscar por cliente o producto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-select-wrapper">
              <Select
                id="sale-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Filtrar por entrega (Todos)</option>
                <option value="completed">✓ Entregados</option>
                <option value="pending">⏳ Pendientes</option>
              </Select>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
              <LoadingSpinner size="lg" text="Cargando ventas..." />
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">💰</span>
              <h3>No se encontraron ventas</h3>
              <p>Puedes agregar una nueva venta usando el botón superior.</p>
            </div>
          ) : (
            <div className="sales-list">
              {filteredSales.map((sale) => {
                const customerName = sale.customers?.name || sale.customer_name || 'Cliente general';
                return (
                  <Card key={sale.id} className="sale-card animate-fade-in-up">
                    <CardBody className="sale-card-body">
                      <div className="sale-card-header">
                        <div className="sale-customer-section">
                          <span className="sale-customer-name">👤 {customerName}</span>
                          <span className="sale-date-badge">{formatDate(sale.sale_date)}</span>
                        </div>
                        <div className="sale-price-section">
                          <span className="sale-total-price">{formatCurrency(sale.total)}</span>
                          <span className="sale-payment-method">💳 {sale.payment_method.toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="sale-products-list">
                        {(sale.sale_items ?? []).map((item) => (
                          <div key={item.id} className="sale-product-item">
                            <span>{item.recipes?.name ?? 'Receta eliminada'}</span>
                            <span className="sale-product-qty">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {sale.notes && (
                        <div className="sale-notes-box">
                          <strong>Notas: </strong> {sale.notes}
                        </div>
                      )}

                      <div className="sale-card-footer">
                        <div className="sale-badges-row">
                          <button
                            onClick={() => togglePaymentStatus(sale)}
                            className="badge-action-btn"
                            title="Haz clic para cambiar estado de pago"
                          >
                            <Badge variant={sale.is_paid ? 'success' : 'danger'}>
                              {sale.is_paid ? '✓ Pagado' : '⏳ Por Cobrar'}
                            </Badge>
                          </button>
                          <button
                            onClick={() => toggleDeliveryStatus(sale)}
                            className="badge-action-btn"
                            title="Haz clic para cambiar estado de entrega"
                          >
                            <Badge variant={sale.status === 'completed' ? 'info' : 'warning'}>
                              {sale.status === 'completed' ? '✓ Entregado' : '⏳ Pendiente'}
                            </Badge>
                          </button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon
                          onClick={() => setDeleteTarget(sale)}
                          title="Eliminar venta"
                        >
                          🗑️
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Stock tab */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
              <LoadingSpinner size="lg" text="Cargando stock de productos..." />
            </div>
          ) : productStocks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🍰</span>
              <h3>No hay stock registrado</h3>
              <p>El stock se crea automáticamente al registrar producciones completadas.</p>
            </div>
          ) : (
            <div className="stock-cards-grid">
              {productStocks.map((stock) => {
                const recipeName = stock.recipes?.name ?? 'Receta eliminada';
                const units = stock.available_units;
                return (
                  <Card key={stock.id} className="stock-card animate-fade-in-up">
                    <CardBody className="stock-card-body">
                      <div className="stock-card-details">
                        <span className="stock-product-name">🧁 {recipeName}</span>
                        <div className="stock-qty-display">
                          <span className={`stock-number ${units === 0 ? 'out' : ''}`}>
                            {units}
                          </span>
                          <span className="stock-unit-label">unidades listas</span>
                        </div>
                      </div>
                      <div className="stock-card-actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openAdjustStock(stock.recipe_id)}
                        >
                          Ajustar stock
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal: New Sale */}
      <Modal
        isOpen={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        title="💰 Registrar Nueva Venta"
        size="md"
      >
        <form onSubmit={handleSaveSale} className="sales-form">
          <div className="sales-form-row">
            <Field label="Cliente Registrado">
              <Select
                id="sale-cust-select"
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  if (e.target.value) setCustomCustomerName('');
                }}
              >
                <option value="">-- Cliente General / No registrado --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                ))}
              </Select>
            </Field>

            {!selectedCustomerId && (
              <Field label="Nombre del cliente (si no está registrado)">
                <Input
                  id="sale-cust-name-text"
                  placeholder="Ej: Laura Pérez"
                  value={customCustomerName}
                  onChange={(e) => setCustomCustomerName(e.target.value)}
                />
              </Field>
            )}
          </div>

          <div className="sales-form-row">
            <Field label="Fecha de la venta">
              <Input
                id="sale-date"
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </Field>

            <Field label="Medio de pago">
              <Select
                id="sale-pay-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="efectivo">💵 Efectivo</option>
                <option value="nequi">📱 Nequi</option>
                <option value="daviplata">📱 DaviPlata</option>
                <option value="transferencia">🏦 Transferencia Bancaria</option>
                <option value="otro">📋 Otro medio</option>
              </Select>
            </Field>
          </div>

          <div className="sale-items-section">
            <label className="section-label">Productos Vendidos</label>
            {saleItems.map((item, index) => (
              <div key={index} className="sale-item-row">
                <div style={{ flex: 2 }}>
                  <Select
                    value={item.recipeId}
                    onChange={(e) => handleItemChange(index, 'recipeId', e.target.value)}
                  >
                    <option value="">Selecciona un producto...</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </Select>
                </div>
                <div style={{ width: '80px' }}>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div style={{ width: '120px' }}>
                  <Input
                    type="number"
                    prefix="$"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeItemRow(index)}
                  disabled={saleItems.length === 1}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addItemRow}
              style={{ marginTop: 'var(--space-2)' }}
            >
              + Agregar otro producto
            </Button>
          </div>

          <div className="sale-toggles-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
              />
              ¿Ya pagó el cliente?
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={saleStatus === 'completed'}
                onChange={(e) => setSaleStatus(e.target.checked ? 'completed' : 'pending')}
              />
              ¿Ya fue entregado?
            </label>
          </div>

          <Field label="Notas o Comentarios">
            <Textarea
              id="sale-notes-textarea"
              placeholder="Ej: Entrega a domicilio en la tarde..."
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              rows={2}
            />
          </Field>

          <div className="sale-modal-summary">
            <span>Total de la Venta:</span>
            <span className="summary-total">{formatCurrency(saleTotal)}</span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <Button type="button" variant="secondary" onClick={() => setSaleModalOpen(false)} disabled={savingSale}>
              Cancelar
            </Button>
            <Button type="submit" loading={savingSale}>
              Registrar Venta
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Adjust Stock */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="⚙️ Ajustar Stock de Productos"
        size="md"
      >
        <form onSubmit={handleSaveAdjustment} className="adjust-form">
          <Field label="Selecciona el producto">
            <Select
              id="adj-recipe-select"
              value={adjustRecipeId}
              onChange={(e) => setAdjustRecipeId(e.target.value)}
            >
              <option value="">-- Elige un producto --</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </Field>

          <Field
            label="Cantidad de ajuste"
            hint="Usa números positivos para agregar stock (ej: 5) o negativos para restar (ej: -3 por merma)."
          >
            <Input
              id="adj-qty"
              type="number"
              placeholder="Ej: -5 o 5"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
            />
          </Field>

          <Field label="Motivo del ajuste">
            <Select
              id="adj-reason"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            >
              <option value="damage">🗑️ Se dañó / Merma</option>
              <option value="consumption">🥣 Consumo en pruebas / Muestra</option>
              <option value="production">🥣 Producción manual / Ajuste</option>
              <option value="other">📋 Otro motivo</option>
            </Select>
          </Field>

          <Field label="Notas explicativas">
            <Textarea
              id="adj-notes"
              placeholder="Escribe por qué se realiza el ajuste..."
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              rows={2}
            />
          </Field>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <Button type="button" variant="secondary" onClick={() => setAdjustModalOpen(false)} disabled={savingAdjustment}>
              Cancelar
            </Button>
            <Button type="submit" loading={savingAdjustment}>
              Guardar Ajuste
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Delete Sale */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="🗑️ Eliminar Venta"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteSale}>
              Sí, eliminar
            </Button>
          </>
        }
      >
        <p>¿Estás segura de eliminar esta venta?</p>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
          Al eliminarla, las unidades de producto vendidas se devolverán automáticamente al stock disponible.
        </p>
      </Modal>
    </div>
  );
}
