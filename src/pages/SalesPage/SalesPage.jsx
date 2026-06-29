import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getRecipes } from '../../services/recipes.service';
import { getCustomers, getOrCreateCustomerByName } from '../../services/customers.service';
import {
  getSales, createSale, updateSaleStatus, updateSalePayment, deleteSale
} from '../../services/sales.service';
import { getProductStockWithPending, adjustProductStock } from '../../services/product_stock.service';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getRecipePricing } from '../../utils/calculations';
import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input, Select, Textarea, SearchableSelect } from '../../components/ui/Input';
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
  const [paymentFilter, setPaymentFilter] = useState('');

  // Modals
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [abonoModalOpen, setAbonoModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [abonoTarget, setAbonoTarget] = useState(null);
  const [formError, setFormError] = useState(null);

  // Form: New Sale / Order
  const [saleType, setSaleType] = useState('immediate'); // 'immediate' | 'order'
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [saleStatus, setSaleStatus] = useState('completed');
  const [saleNotes, setSaleNotes] = useState('');
  const [saleItems, setSaleItems] = useState([{ recipeId: '', quantity: 1, unitPrice: 0 }]);

  // Form: Adjust Stock
  const [adjustRecipeId, setAdjustRecipeId] = useState('');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('damage');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Form: Abono
  const [abonoAmount, setAbonoAmount] = useState('');

  // Saving states
  const [savingSale, setSavingSale] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [savingAbono, setSavingAbono] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesData, stocksData, recipesData, customersData] = await Promise.all([
        getSales().catch(err => {
          console.error("Error al cargar getSales():", err);
          return [];
        }),
        getProductStockWithPending().catch(err => {
          console.error("Error al cargar getProductStockWithPending():", err);
          return [];
        }),
        getRecipes().catch(err => {
          console.error("Error al cargar getRecipes():", err);
          return [];
        }),
        getCustomers().catch(err => {
          console.error("Error al cargar getCustomers():", err);
          return [];
        }),
      ]);
      setSales(salesData);
      setProductStocks(stocksData);
      setRecipes(recipesData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error general al cargar datos de ventas:', error);
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
      const matchesSearch =
        customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.sale_items?.some(item => item.recipes?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === '' || s.status === statusFilter;
      
      let matchesPayment = true;
      if (paymentFilter === 'paid') {
        matchesPayment = s.is_paid;
      } else if (paymentFilter === 'pending') {
        matchesPayment = !s.is_paid;
      }

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [sales, searchQuery, statusFilter, paymentFilter]);

  // Today string for date comparisons
  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  // Open Sale Modal
  const openNewSale = () => {
    setSaleType('immediate');
    setSelectedCustomerId('');
    setCustomCustomerName('');
    setSaleDate(todayStr);
    setDeliveryDate(todayStr);
    setPaymentMethod('efectivo');
    setAmountPaid('');
    setSaleStatus('completed');
    setSaleNotes('');
    setSaleItems([{ recipeId: '', quantity: 1, unitPrice: 0 }]);
    setFormError(null);
    setSaleModalOpen(true);
  };

  // When sale type changes, auto-set status
  const handleSaleTypeChange = (newType) => {
    setSaleType(newType);
    setFormError(null);
    if (newType === 'order') {
      setSaleStatus('pending');
      setAmountPaid('');
    } else {
      setSaleStatus('completed');
    }
  };

  // Open Adjust Modal
  const openAdjustStock = (recipeId = '') => {
    setAdjustRecipeId(recipeId);
    setAdjustQty('');
    setAdjustReason('damage');
    setAdjustNotes('');
    setAdjustModalOpen(true);
  };

  // Open Abono Modal
  const openAbono = (sale) => {
    setAbonoTarget(sale);
    setAbonoAmount('');
    setAbonoModalOpen(true);
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
    setFormError(null); // limpiar error al editar
  };

  const addItemRow = () => {
    setSaleItems([...saleItems, { recipeId: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItemRow = (index) => {
    if (saleItems.length === 1) return;
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const saleTotal = useMemo(() => {
    return saleItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);
  }, [saleItems]);

  const handleSaveSale = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (saleItems.some(i => !i.recipeId || i.quantity === '' || Number(i.quantity) <= 0)) {
      setFormError('Por favor selecciona un producto y cantidad válida para todos los items.');
      return;
    }
    if (!saleDate) {
      setFormError('Por favor selecciona una fecha para la venta.');
      return;
    }
    // Para ventas inmediatas, la fecha no puede ser futura
    if (saleType === 'immediate' && saleDate > todayStr) {
      setFormError(`No se puede registrar una venta inmediata con fecha futura (${saleDate}).`);
      return;
    }
    // Para pedidos, la fecha de entrega es obligatoria
    if (saleType === 'order' && !deliveryDate) {
      setFormError('Por favor selecciona una fecha de entrega para el pedido.');
      return;
    }

    // Validar stock si es venta inmediata
    if (saleType === 'immediate') {
      for (const item of saleItems) {
        const stockData = productStocks.find(s => s.recipe_id === item.recipeId);
        const available = stockData?.available_units ?? 0;
        if (Number(item.quantity) > available) {
          const recipe = recipes.find(r => r.id === item.recipeId);
          setFormError(`No hay suficiente stock de producto terminado para "${recipe?.name}". Stock actual: ${available} unidades. Si es una venta a entregar después, usa el botón "Pedido a futuro" arriba.`);
          return;
        }
      }
    }

    setSavingSale(true);
    try {
      let finalCustomerId = selectedCustomerId;
      let finalCustomerName = null;

      if (!selectedCustomerId && customCustomerName.trim() && customCustomerName.trim() !== 'Cliente general') {
        const customer = await getOrCreateCustomerByName(customCustomerName.trim());
        finalCustomerId = customer.id;
        finalCustomerName = null;
      } else if (!selectedCustomerId) {
        finalCustomerName = customCustomerName.trim() || 'Cliente general';
      }

      const paid = parseFloat(amountPaid) || 0;

      const saleData = {
        customerId:     finalCustomerId || null,
        customerName:   finalCustomerId ? null : finalCustomerName,
        saleDate,
        deliveryDate:   saleType === 'order' ? deliveryDate : saleDate,
        saleType,
        paymentMethod,
        amountPaid:     paid,
        isPaid:         paid >= saleTotal,
        status:         saleType === 'order' ? 'pending' : saleStatus,
        notes:          saleNotes,
        total:          saleTotal,
        userId:         user?.id,
      };

      await createSale(saleData, saleItems);
      setSaleModalOpen(false);
      await loadData();
    } catch (error) {
      console.error(error);
      alert('Error al registrar la venta. Verifica los datos e intenta de nuevo.');
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
      await adjustProductStock(adjustRecipeId, qty, adjustReason, adjustNotes, user?.id);
      setAdjustModalOpen(false);
      await loadData();
    } catch (error) {
      console.error(error);
      alert('Error al registrar el ajuste de stock.');
    } finally {
      setSavingAdjustment(false);
    }
  };

  const handleSaveAbono = async (e) => {
    e.preventDefault();
    if (!abonoTarget) return;
    const nuevoAbono = parseFloat(abonoAmount);
    if (isNaN(nuevoAbono) || nuevoAbono <= 0) {
      alert('Por favor ingresa un monto de abono válido.');
      return;
    }
    const totalAbonado = (abonoTarget.amount_paid ?? 0) + nuevoAbono;
    if (totalAbonado > abonoTarget.total) {
      alert(`El abono excede el total de la venta (${formatCurrency(abonoTarget.total)}). El máximo a abonar es ${formatCurrency(abonoTarget.total - (abonoTarget.amount_paid ?? 0))}.`);
      return;
    }
    setSavingAbono(true);
    try {
      await updateSalePayment(abonoTarget.id, totalAbonado, abonoTarget.total);
      setAbonoModalOpen(false);
      setAbonoTarget(null);
      await loadData();
    } catch (error) {
      console.error(error);
      alert('Error al registrar el abono.');
    } finally {
      setSavingAbono(false);
    }
  };

  const togglePaymentStatus = async (sale) => {
    // Marcar como pagado completo o volver a 0
    const newAmountPaid = sale.is_paid ? 0 : sale.total;
    try {
      await updateSalePayment(sale.id, newAmountPaid, sale.total);
      await loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleDeliveryStatus = async (sale) => {
    const nextStatus = sale.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateSaleStatus(sale.id, nextStatus, sale.is_paid, user?.id);
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

  // Urgency tag for delivery dates
  const getDeliveryUrgency = (deliveryDateStr) => {
    if (!deliveryDateStr) return null;
    if (deliveryDateStr < todayStr) return 'overdue';
    if (deliveryDateStr === todayStr) return 'today';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    if (deliveryDateStr === tomorrowStr) return 'tomorrow';
    return null;
  };

  return (
    <div className="app-content sales-page-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>💰 Ventas y Stock de Productos</h1>
          <p>Registra ventas y pedidos, controla abonos y ajusta el stock de productos terminados.</p>
        </div>
        <div className="page-header-actions">
          {activeTab === 'sales' ? (
            <Button onClick={openNewSale}>+ Registrar venta / pedido</Button>
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
            <div className="filter-select-wrapper">
              <Select
                id="sale-payment-filter"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
              >
                <option value="">Filtrar por pago (Todos)</option>
                <option value="paid">✓ Pagados</option>
                <option value="pending">⏳ Falta por pagar</option>
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
              <p>Puedes agregar una nueva venta o pedido usando el botón superior.</p>
            </div>
          ) : (
            <div className="sales-list">
              {filteredSales.map((sale) => {
                const customerName = sale.customers?.name || sale.customer_name || 'Cliente general';
                const registeredBy = sale.profiles?.full_name;
                const amountPaidVal = sale.amount_paid ?? (sale.is_paid ? sale.total : 0);
                const remaining = sale.total - amountPaidVal;
                const isOrder = sale.sale_type === 'order';
                const urgency = isOrder && sale.status === 'pending'
                  ? getDeliveryUrgency(sale.delivery_date)
                  : null;

                return (
                  <Card
                    key={sale.id}
                    className={`sale-card animate-fade-in-up ${urgency === 'overdue' ? 'sale-card--overdue' : urgency === 'today' ? 'sale-card--today' : ''}`}
                  >
                    <CardBody className="sale-card-body">
                      <div className="sale-card-header">
                        <div className="sale-customer-section">
                          <span className="sale-customer-name">👤 {customerName}</span>
                          <div className="sale-dates-row">
                            <span className="sale-date-badge">📅 Pedido: {formatDate(sale.sale_date)}</span>
                            {isOrder && sale.delivery_date && (
                              <span className={`sale-delivery-badge ${urgency ? `sale-delivery-badge--${urgency}` : ''}`}>
                                🚚 Entrega: {formatDate(sale.delivery_date)}
                                {urgency === 'today' && ' ⚡ HOY'}
                                {urgency === 'tomorrow' && ' ⏰ Mañana'}
                                {urgency === 'overdue' && ' ⚠️ VENCIDO'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="sale-price-section">
                          <span className="sale-total-price">{formatCurrency(sale.total)}</span>
                          <span className="sale-payment-method">💳 {sale.payment_method.toUpperCase()}</span>
                          {/* Abono info */}
                          {!sale.is_paid && (
                            <div className="sale-abono-info">
                              <span className="sale-abono-paid">Abonado: {formatCurrency(amountPaidVal)}</span>
                              <span className="sale-abono-remaining">Resta: {formatCurrency(remaining)}</span>
                            </div>
                          )}
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

                      {/* Tipo de venta badge */}
                      {isOrder && (
                        <div className="sale-type-tag">
                          📦 Pedido a futuro
                        </div>
                      )}

                      {sale.notes && (
                        <div className="sale-notes-box">
                          <strong>Notas: </strong> {sale.notes}
                        </div>
                      )}

                      {/* Registrado por */}
                      {registeredBy && (
                        <div className="sale-registered-by">
                          👤 Registrado por: <strong>{registeredBy}</strong>
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
                              {sale.is_paid ? '✓ Pagado' : `⏳ Por Cobrar`}
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
                        <div className="sale-card-actions-right">
                          {!sale.is_paid && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openAbono(sale)}
                              title="Registrar abono"
                            >
                              💵 Abonar
                            </Button>
                          )}
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
            <>
              <div className="stock-legend">
                <span className="stock-legend-item stock-legend-available">🟢 Disponibles ahora</span>
                <span className="stock-legend-item stock-legend-pending">🟠 Por hacer (pedidos pendientes)</span>
              </div>
              <div className="stock-cards-grid">
                {productStocks.map((stock) => {
                  const recipeName = stock.recipes?.name ?? 'Receta eliminada';
                  const units = stock.available_units ?? 0;
                  const pending = stock.pending_units ?? 0;
                  return (
                    <Card key={stock.recipe_id} className="stock-card animate-fade-in-up">
                      <CardBody className="stock-card-body">
                        <div className="stock-card-details">
                          <span className="stock-product-name">🧁 {recipeName}</span>
                          <div className="stock-qty-display">
                            <div className="stock-qty-row">
                              <span className={`stock-number ${units === 0 ? 'out' : ''}`}>{units}</span>
                              <span className="stock-unit-label">unidades listas</span>
                            </div>
                            {pending > 0 && (
                              <div className="stock-qty-row stock-pending-row">
                                <span className="stock-number stock-number--pending">{pending}</span>
                                <span className="stock-unit-label">por hacer</span>
                              </div>
                            )}
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
            </>
          )}
        </>
      )}

      {/* ── Modal: New Sale / Order ── */}
      <Modal
        isOpen={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        title="💰 Registrar Venta o Pedido"
        size="md"
      >
        <form onSubmit={handleSaveSale} className="sales-form">

          {/* Tipo de venta */}
          <div className="sale-type-selector">
            <button
              type="button"
              className={`sale-type-btn ${saleType === 'immediate' ? 'active' : ''}`}
              onClick={() => handleSaleTypeChange('immediate')}
            >
              🛍️ Venta inmediata
              <span>Producto ya listo para entregar</span>
            </button>
            <button
              type="button"
              className={`sale-type-btn ${saleType === 'order' ? 'active' : ''}`}
              onClick={() => handleSaleTypeChange('order')}
            >
              📦 Pedido a futuro
              <span>El cliente pide con fecha de entrega</span>
            </button>
          </div>

          <div className="sales-form-row">
            <Field label="Cliente Registrado">
              <SearchableSelect
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  if (e.target.value) setCustomCustomerName('');
                }}
                options={[
                  { value: '', label: '-- Cliente General / No registrado --' },
                  ...customers.map((c) => ({
                    value: c.id,
                    label: `${c.name}${c.phone ? ` (${c.phone})` : ''}`,
                  })),
                ]}
                placeholder="Buscar cliente..."
              />
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
            <Field label={saleType === 'order' ? 'Fecha del pedido' : 'Fecha de la venta'}>
              <Input
                id="sale-date"
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </Field>

            {saleType === 'order' && (
              <Field label="📅 Fecha de entrega prometida">
                <Input
                  id="sale-delivery-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={saleDate}
                />
              </Field>
            )}

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
            <label className="section-label">Productos Vendidos / Pedidos</label>
            {saleItems.map((item, index) => (
              <div key={index} className="sale-item-row">
                <div style={{ flex: 2 }}>
                  <SearchableSelect
                    value={item.recipeId}
                    onChange={(e) => handleItemChange(index, 'recipeId', e.target.value)}
                    options={recipes.map((r) => ({ value: r.id, label: r.name }))}
                    placeholder="Buscar producto..."
                  />
                </div>
                <div style={{ width: '80px' }}>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value))}
                  />
                </div>
                <div style={{ width: '120px' }}>
                  <Input
                    type="number"
                    prefix="$"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value === '' ? '' : parseFloat(e.target.value))}
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

          {/* Abono / pago */}
          <div className="sale-payment-section">
            <Field
              label={saleType === 'order' ? 'Abono inicial del cliente (puede ser $0)' : 'Monto recibido'}
              hint={saleType === 'order'
                ? 'Puedes dejar $0 si el cliente aún no ha pagado nada. Puedes registrar abonos después.'
                : 'Si el cliente pagó completo, ingresa el total.'}
            >
              <Input
                id="sale-amount-paid"
                type="number"
                prefix="$"
                min="0"
                max={saleTotal}
                placeholder={`Máx: ${formatCurrency(saleTotal)}`}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </Field>
          </div>

          {saleType === 'immediate' && (
            <div className="sale-toggles-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={saleStatus === 'completed'}
                  onChange={(e) => setSaleStatus(e.target.checked ? 'completed' : 'pending')}
                />
                ¿Ya fue entregado?
              </label>
            </div>
          )}

          <Field label="Notas o Comentarios">
            <Textarea
              id="sale-notes-textarea"
              placeholder={saleType === 'order' ? 'Ej: El cliente quiere torta de chocolate con letras doradas...' : 'Ej: Entrega a domicilio en la tarde...'}
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              rows={2}
            />
          </Field>

          {formError && (
            <div className="sale-form-error-alert animate-fade-in">
              <span className="error-icon">⚠️</span>
              <p className="error-message">{formError}</p>
            </div>
          )}

          <div className="sale-modal-summary">
            <div className="sale-summary-row">
              <span>Total del pedido:</span>
              <span className="summary-total">{formatCurrency(saleTotal)}</span>
            </div>
            {amountPaid && parseFloat(amountPaid) > 0 && (
              <div className="sale-summary-row sale-summary-pending">
                <span>Queda por cobrar:</span>
                <span>{formatCurrency(Math.max(0, saleTotal - parseFloat(amountPaid)))}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <Button type="button" variant="secondary" onClick={() => setSaleModalOpen(false)} disabled={savingSale}>
              Cancelar
            </Button>
            <Button type="submit" loading={savingSale}>
              {saleType === 'order' ? '📦 Registrar Pedido' : '💰 Registrar Venta'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Adjust Stock ── */}
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

      {/* ── Modal: Registrar Abono ── */}
      <Modal
        isOpen={abonoModalOpen}
        onClose={() => { setAbonoModalOpen(false); setAbonoTarget(null); }}
        title="💵 Registrar Abono"
        size="sm"
      >
        {abonoTarget && (
          <form onSubmit={handleSaveAbono} className="adjust-form">
            <div className="abono-summary">
              <div className="abono-summary-row">
                <span>Total de la venta:</span>
                <strong>{formatCurrency(abonoTarget.total)}</strong>
              </div>
              <div className="abono-summary-row">
                <span>Ya abonado:</span>
                <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(abonoTarget.amount_paid ?? 0)}</strong>
              </div>
              <div className="abono-summary-row">
                <span>Falta por pagar:</span>
                <strong style={{ color: 'var(--color-danger)' }}>
                  {formatCurrency(abonoTarget.total - (abonoTarget.amount_paid ?? 0))}
                </strong>
              </div>
            </div>

            <Field
              label="Nuevo abono a registrar"
              hint="Se sumará al monto ya abonado."
            >
              <Input
                id="abono-amount"
                type="number"
                prefix="$"
                min="1"
                max={abonoTarget.total - (abonoTarget.amount_paid ?? 0)}
                placeholder={`Máx: ${formatCurrency(abonoTarget.total - (abonoTarget.amount_paid ?? 0))}`}
                value={abonoAmount}
                onChange={(e) => setAbonoAmount(e.target.value)}
                autoFocus
              />
            </Field>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <Button type="button" variant="secondary" onClick={() => { setAbonoModalOpen(false); setAbonoTarget(null); }} disabled={savingAbono}>
                Cancelar
              </Button>
              <Button type="submit" loading={savingAbono}>
                ✓ Guardar Abono
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Modal: Confirm Delete Sale ── */}
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
        {deleteTarget?.sale_type === 'immediate' && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            Al eliminarla, las unidades de producto vendidas se devolverán automáticamente al stock disponible.
          </p>
        )}
        {deleteTarget?.sale_type === 'order' && deleteTarget?.status === 'pending' && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            Este pedido aún no fue entregado, por lo que el stock no fue descontado y no se devolverá nada.
          </p>
        )}
      </Modal>
    </div>
  );
}
