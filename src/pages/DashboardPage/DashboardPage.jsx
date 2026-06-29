import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getIngredients } from '../../services/ingredients.service';
import { getDetailedRecipes } from '../../services/recipes.service';
import { getProductionLogs } from '../../services/production.service';
import { getSalesStats, getRecentSales, getUpcomingDeliveries, getSales } from '../../services/sales.service';
import { calcRecipeSummary, getRecipePricing } from '../../utils/calculations';
import { formatCurrency, formatDateTime, formatDate } from '../../utils/formatters';
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Badge from '../../components/ui/Badge';
import './DashboardPage.css';

export default function DashboardPage() {
  const { user, profile, role, isAdmin, isPartner } = useAuth();
  const navigate = useNavigate();

  // State
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [productionLogs, setProductionLogs] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [upcomingDeliveries, setUpcomingDeliveries] = useState([]);
  const [partnerPeriodSales, setPartnerPeriodSales] = useState([]);
  const [stats, setStats] = useState({ salesCount: 0, totalRevenue: 0, paidRevenue: 0, pendingRevenue: 0, byProduct: [] });

  const [loading, setLoading] = useState(true);

  // Date Filter States
  const [filterType, setFilterType] = useState('predefined'); // 'predefined' | 'custom-day' | 'custom-month' | 'custom-range'
  const [period, setPeriod] = useState('month'); // 'day' | 'week' | 'month' | 'year'
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7));
  const [rangeStart, setRangeStart] = useState(new Date().toISOString().split('T')[0]);
  const [rangeEnd, setRangeEnd] = useState(new Date().toISOString().split('T')[0]);

  // Compute config dynamically for getSalesStats
  const periodConfig = useMemo(() => {
    if (filterType === 'predefined') {
      return period;
    }
    if (filterType === 'custom-day') {
      return { startDate: selectedDay, endDate: selectedDay };
    }
    if (filterType === 'custom-month') {
      const [year, month] = selectedMonth.split('-');
      if (!year || !month) return period;
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      return { startDate, endDate };
    }
    if (filterType === 'custom-range') {
      if (rangeStart > rangeEnd) {
        return null; // Invalid range
      }
      return { startDate: rangeStart, endDate: rangeEnd };
    }
    return period;
  }, [filterType, period, selectedDay, selectedMonth, rangeStart, rangeEnd]);

  const loadDashboardData = async () => {
    if (!periodConfig) return; // Wait for valid range
    setLoading(true);
    try {
      if (isAdmin) {
        const [recipesData, ingredientsData, logsData, statsData, recentSalesData, deliveriesData] = await Promise.all([
          getDetailedRecipes(),
          getIngredients(),
          getProductionLogs(),
          getSalesStats(periodConfig),
          getRecentSales(5),
          getUpcomingDeliveries(14),
        ]);
        setRecipes(recipesData);
        setIngredients(ingredientsData);
        setProductionLogs(logsData.slice(0, 5));
        setStats(statsData);
        setRecentSales(recentSalesData);
        setUpcomingDeliveries(deliveriesData);
      } else if (isPartner) {
        const filters = typeof periodConfig === 'object' ? periodConfig : {};
        const [recipesData, recentSalesData, deliveriesData, salesData] = await Promise.all([
          getDetailedRecipes({ role, userId: user?.id }),
          getRecentSales(20),
          getUpcomingDeliveries(14),
          getSales(filters).catch(() => []),
        ]);
        setRecipes(recipesData);
        setRecentSales(recentSalesData);
        setUpcomingDeliveries(deliveriesData);
        setPartnerPeriodSales(salesData);
      }
    } catch (error) {
      console.error('Error al cargar datos del Dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [role, user, isAdmin, isPartner, periodConfig]);

  // Recalculate partner stats based on current period stats
  const partnerStats = useMemo(() => {
    if (!isPartner) return null;

    // Create a map of recipe ID to partner profit per unit
    const recipeProfitMap = {};
    recipes.forEach((recipe) => {
      const summary = calcRecipeSummary({
        ingredients: (recipe.recipe_ingredients ?? []).map((ri) => ({
          unitPrice: ri.ingredients?.unit_price ?? 0,
          quantityUsed: ri.quantity_used,
        })),
        extraCosts: (recipe.recipe_extra_costs ?? []).map((rec) => ({
          quantity: rec.quantity,
          unitPrice: rec.unit_price,
          type: rec.type,
        })),
        unitsPerBatch: recipe.units_per_batch,
        profitPercentage: getRecipePricing(recipe).profit_percentage ?? 50,
        roundedPrice: getRecipePricing(recipe).rounded_price,
        hasPartner: recipe.has_partner,
      });

      const units = recipe.units_per_batch || 1;
      recipeProfitMap[recipe.id] = {
        partnerProfitPerUnit: summary.partnerProfit / units,
        unitCost: summary.unitCost,
        sellingPrice: summary.sellingPrice,
        recipeName: recipe.name,
      };
    });

    // Sum partner sales in the current period sales
    let totalJhonSalesRevenue = 0;
    let paidRevenue = 0;
    let totalJhonProfit = 0;
    let salesCount = 0;
    const byProductMap = {};

    partnerPeriodSales.forEach((sale) => {
      const totalAmount = sale.total ?? 0;
      const amountPaid = sale.amount_paid ?? (sale.is_paid ? totalAmount : 0);
      const paymentFactor = totalAmount > 0 ? (amountPaid / totalAmount) : 0;

      (sale.sale_items ?? []).forEach((item) => {
        const recipeId = item.recipes?.id || item.recipe_id;
        const profitInfo = recipeProfitMap[recipeId];
        if (!profitInfo) return; // Only count Jhon's partner recipes

        const itemQty = item.quantity ?? 0;
        const itemRevenue = item.subtotal ?? (itemQty * (item.unit_price ?? 0));
        const itemProfit = profitInfo.partnerProfitPerUnit * itemQty;

        totalJhonSalesRevenue += itemRevenue;
        paidRevenue += itemRevenue * paymentFactor;
        totalJhonProfit += itemProfit;
        salesCount += itemQty;

        if (!byProductMap[recipeId]) {
          byProductMap[recipeId] = {
            recipeName: profitInfo.recipeName,
            totalQty: 0,
            totalRevenue: 0,
            totalProfit: 0,
          };
        }
        byProductMap[recipeId].totalQty += itemQty;
        byProductMap[recipeId].totalRevenue += itemRevenue;
        byProductMap[recipeId].totalProfit += itemProfit;
      });
    });

    // Filter recent sales containing Jhon's partner products
    const jhonSales = recentSales.filter((sale) =>
      sale.sale_items?.some((item) => recipeProfitMap[item.recipes?.id || item.recipe_id])
    );

    return {
      salesCount,
      totalRevenue: totalJhonSalesRevenue,
      paidRevenue,
      pendingRevenue: Math.max(0, totalJhonSalesRevenue - paidRevenue),
      totalProfit: totalJhonProfit,
      recentSales: jhonSales.slice(0, 5),
      byProduct: Object.values(byProductMap).sort((a, b) => b.totalProfit - a.totalProfit),
      recipeProfitMap,
    };
  }, [recipes, recentSales, partnerPeriodSales, isPartner]);

  // Ingredients with low stock
  const lowStockIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const stock = ing.inventory?.[0]?.current_stock ?? 0;
      if (ing.unit === 'gr' || ing.unit === 'ml') {
        return stock < 200;
      }
      return stock < 5;
    });
  }, [ingredients]);

  // Desglose de ganancias por socio (solo admin)
  const profitBreakdown = useMemo(() => {
    if (!isAdmin || !recipes.length || !stats.byProduct.length) {
      return { ceciliaTotal: 0, jhonTotal: 0, totalProfit: 0 };
    }

    // Mapa de ganancia por unidad por receta
    const recipeProfitMap = {};
    recipes.forEach((recipe) => {
      const summary = calcRecipeSummary({
        ingredients: (recipe.recipe_ingredients ?? []).map((ri) => ({
          unitPrice:    ri.ingredients?.unit_price ?? 0,
          quantityUsed: ri.quantity_used,
        })),
        extraCosts: (recipe.recipe_extra_costs ?? []).map((rec) => ({
          quantity:  rec.quantity,
          unitPrice: rec.unit_price,
          type:      rec.type,
        })),
        unitsPerBatch:    recipe.units_per_batch,
        profitPercentage: getRecipePricing(recipe).profit_percentage ?? 50,
        roundedPrice:     getRecipePricing(recipe).rounded_price,
        hasPartner:       recipe.has_partner,
      });

      const units = recipe.units_per_batch || 1;
      recipeProfitMap[recipe.id] = {
        ownerProfitPerUnit:   summary.ownerProfit   / units,
        partnerProfitPerUnit: summary.partnerProfit / units,
        hasPartner:           recipe.has_partner,
      };
    });

    // Sumar ganancias usando las ventas del periodo
    let ceciliaTotal = 0;
    let jhonTotal    = 0;
    stats.byProduct.forEach((prod) => {
      const info = recipeProfitMap[prod.recipeId];
      if (!info) return;
      ceciliaTotal += info.ownerProfitPerUnit   * prod.totalQty;
      jhonTotal    += info.partnerProfitPerUnit * prod.totalQty;
    });

    return { ceciliaTotal, jhonTotal, totalProfit: ceciliaTotal + jhonTotal };
  }, [isAdmin, recipes, stats.byProduct]);

  const periodLabel = useMemo(() => {
    if (filterType === 'predefined') {
      return {
        day: 'hoy',
        week: 'esta semana',
        month: 'este mes',
        year: 'este año',
      }[period] || 'este mes';
    }
    if (filterType === 'custom-day') {
      return `día ${formatDate(selectedDay)}`;
    }
    if (filterType === 'custom-month') {
      const [year, month] = selectedMonth.split('-');
      if (!year || !month) return 'mes seleccionado';
      const monthNames = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      const mIdx = parseInt(month, 10) - 1;
      return `${monthNames[mIdx] || month} de ${year}`;
    }
    if (filterType === 'custom-range') {
      return `del ${formatDate(rangeStart)} al ${formatDate(rangeEnd)}`;
    }
    return 'período seleccionado';
  }, [filterType, period, selectedDay, selectedMonth, rangeStart, rangeEnd]);

  if (loading) {
    return (
      <div className="app-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-16)' }}>
        <LoadingSpinner size="lg" text="Cargando panel de control..." />
      </div>
    );
  }

  return (
    <div className="app-content dashboard-container animate-fade-in">
      {/* Welcome header */}
      <div className="dashboard-welcome">
        <div className="dashboard-welcome-left">
          <h1>¡Hola, {profile?.full_name ?? 'Usuario'}! 🌸</h1>
          <p>
            {isAdmin
              ? 'Bienvenida a tu panel de administración. Aquí tienes un resumen del estado de tu negocio.'
              : 'Bienvenido socio. Aquí puedes ver el progreso de tus ventas y tus ganancias acumuladas.'}
          </p>
        </div>
        <div className="dashboard-welcome-icon">🎂</div>
      </div>

      {/* Advanced Date Filters for Everyone */}
      <div className="filter-section-container">
        <div className="filter-type-selector">
          <span className="filter-label">Filtrar estadísticas por:</span>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filterType === 'predefined' ? 'active' : ''}`}
              onClick={() => setFilterType('predefined')}
            >
              Período Predefinido
            </button>
            <button
              className={`filter-btn ${filterType === 'custom-day' ? 'active' : ''}`}
              onClick={() => setFilterType('custom-day')}
            >
              Día Específico
            </button>
            <button
              className={`filter-btn ${filterType === 'custom-month' ? 'active' : ''}`}
              onClick={() => setFilterType('custom-month')}
            >
              Mes Específico
            </button>
            <button
              className={`filter-btn ${filterType === 'custom-range' ? 'active' : ''}`}
              onClick={() => setFilterType('custom-range')}
            >
              Rango Personalizado
            </button>
          </div>
        </div>

        <div className="filter-inputs-row">
          {filterType === 'predefined' && (
            <div className="period-buttons">
              {['day', 'week', 'month', 'year'].map((p) => (
                <button
                  key={p}
                  className={`period-btn ${period === p ? 'active' : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === 'day' ? 'Día' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
                </button>
              ))}
            </div>
          )}

          {filterType === 'custom-day' && (
            <div className="filter-input-group">
              <label htmlFor="dashboard-day">Seleccionar Día:</label>
              <input
                id="dashboard-day"
                type="date"
                className="filter-date-input"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              />
            </div>
          )}

          {filterType === 'custom-month' && (
            <div className="filter-input-group">
              <label htmlFor="dashboard-month">Seleccionar Mes:</label>
              <input
                id="dashboard-month"
                type="month"
                className="filter-date-input"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          )}

          {filterType === 'custom-range' && (
            <div className="filter-range-inputs">
              <div className="filter-input-group">
                <label htmlFor="dashboard-range-start">Desde:</label>
                <input
                  id="dashboard-range-start"
                  type="date"
                  className="filter-date-input"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
              </div>
              <div className="filter-input-group">
                <label htmlFor="dashboard-range-end">Hasta:</label>
                <input
                  id="dashboard-range-end"
                  type="date"
                  className="filter-date-input"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </div>
              {rangeStart > rangeEnd && (
                <span className="filter-error-msg">
                  ⚠️ La fecha 'Desde' no puede ser mayor que 'Hasta'.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <>
          {/* Admin Stats Grid */}
          <div className="dashboard-grid">
            <StatCard
              label={`Ventas Totales (${periodLabel})`}
              value={formatCurrency(stats.totalRevenue)}
              sub={`${stats.salesCount} ventas registradas`}
            />
            <StatCard
              label={`Recaudado (${periodLabel})`}
              value={formatCurrency(stats.paidRevenue)}
              sub="Dinero ya recibido"
              style={{ borderLeft: '4px solid var(--color-success)' }}
            />
            <StatCard
              label={`Por Cobrar (${periodLabel})`}
              value={formatCurrency(stats.pendingRevenue)}
              sub="Ventas pendientes de pago"
              style={{ borderLeft: '4px solid var(--color-warning)' }}
            />
          </div>

          {/* Desglose de ganancias por socio */}
          <div className="dashboard-grid" style={{ marginTop: 'var(--space-3)' }}>
            <StatCard
              label={`Ganancia Neta Total (${periodLabel})`}
              value={formatCurrency(profitBreakdown.totalProfit)}
              sub="Suma de ganancias Cecilia + Jhon"
              style={{ borderLeft: '4px solid var(--color-rose-500)' }}
            />
            <StatCard
              label={`🌸 Ganancia de Cecilia (${periodLabel})`}
              value={formatCurrency(profitBreakdown.ceciliaTotal)}
              sub="Su mitad + mano de obra íntegra"
              style={{ borderLeft: '4px solid var(--color-primary)', background: 'var(--color-peach-50)' }}
            />
            <StatCard
              label={`🤝 Ganancia de Jhon (${periodLabel})`}
              value={formatCurrency(profitBreakdown.jhonTotal)}
              sub="50% de la utilidad en sus recetas"
              style={{ borderLeft: '4px solid #7c3aed', background: '#faf5ff' }}
            />
          </div>

          <div className="dashboard-row">
            {/* Sales by Product */}
            <Card style={{ flex: 2 }}>
              <CardHeader>
                <h3>📈 Ventas por Producto ({periodLabel})</h3>
              </CardHeader>
              <CardBody>
                {stats.byProduct.length === 0 ? (
                  <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No se registran ventas de productos en este período.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th style={{ textAlign: 'center' }}>Unidades</th>
                          <th style={{ textAlign: 'right' }}>Total Ventas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.byProduct.map((prod) => (
                          <tr key={prod.recipeId}>
                            <td>{prod.recipeName}</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{prod.totalQty}</td>
                            <td style={{ textAlign: 'right', color: 'var(--color-rose-600)', fontWeight: 'bold' }}>
                              {formatCurrency(prod.totalRevenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Quick Actions */}
            <div className="dashboard-actions" style={{ flex: 1 }}>
              <h3 style={{ marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                Acciones Rápidas
              </h3>
              
              <div className="action-card" onClick={() => navigate('/ventas')}>
                <div className="action-card-icon">💰</div>
                <div className="action-card-details">
                  <span className="action-card-title">Registrar Venta</span>
                  <span className="action-card-desc">Crea una nueva venta y descuenta stock</span>
                </div>
              </div>

              <div className="action-card" onClick={() => navigate('/produccion')}>
                <div className="action-card-icon">🥣</div>
                <div className="action-card-details">
                  <span className="action-card-title">Registrar Producción</span>
                  <span className="action-card-desc">Registra un lote de brownies o tortas horneadas</span>
                </div>
              </div>

              <div className="action-card" onClick={() => navigate('/compras')}>
                <div className="action-card-icon">🛒</div>
                <div className="action-card-details">
                  <span className="action-card-title">¿Qué debo comprar?</span>
                  <span className="action-card-desc">Genera lista de compras según recetas</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-row" style={{ marginTop: 'var(--space-4)' }}>
            {/* Recent Sales */}
            <Card style={{ flex: 1 }}>
              <CardHeader>
                <h3>🛍️ Ventas Recientes</h3>
              </CardHeader>
              <CardBody>
                {recentSales.length === 0 ? (
                  <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No hay ventas recientes registradas.
                  </div>
                ) : (
                  <div className="recent-logs-list">
                    {recentSales.map((sale) => {
                      const cust = sale.customers?.name || sale.customer_name || 'Cliente general';
                      return (
                        <div key={sale.id} className="recent-log-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/ventas')}>
                          <div className="recent-log-info">
                            <span className="recent-log-recipe-name">👤 {cust}</span>
                            <span className="recent-log-date">{formatDate(sale.sale_date)}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="recent-log-units-qty" style={{ fontSize: 'var(--font-size-base)' }}>
                              {formatCurrency(sale.total)}
                            </div>
                            <Badge variant={sale.is_paid ? 'success' : 'danger'}>
                              {sale.is_paid ? 'Pagado' : 'Por Cobrar'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Stock Alerts & Production */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Ingredients alerts */}
              <Card>
                <CardHeader>
                  <h3>⚠️ Stock de Ingredientes Bajo</h3>
                </CardHeader>
                <CardBody>
                  {lowStockIngredients.length === 0 ? (
                    <div style={{ color: 'var(--color-success)', fontWeight: 'semibold', padding: 'var(--space-4)', textAlign: 'center' }}>
                      ✓ Todos los ingredientes tienen stock suficiente.
                    </div>
                  ) : (
                    <div className="low-stock-list">
                      {lowStockIngredients.map((ing) => {
                        const invData = ing.inventory;
                        const stock = (Array.isArray(invData) ? invData[0] : invData)?.current_stock ?? 0;
                        return (
                          <div key={ing.id} className="low-stock-item" style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                            <span>{ing.name}</span>
                            <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>
                              {stock} {ing.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Recent Productions */}
              <Card>
                <CardHeader>
                  <h3>🥣 Producciones Recientes</h3>
                </CardHeader>
                <CardBody>
                  {productionLogs.length === 0 ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No se han registrado producciones.
                    </div>
                  ) : (
                    <div className="recent-logs-list">
                      {productionLogs.map((log) => (
                        <div key={log.id} className="recent-log-item">
                          <div className="recent-log-info">
                            <span className="recent-log-recipe-name">{log.recipes?.name}</span>
                            <span className="recent-log-date">{formatDateTime(log.date)}</span>
                          </div>
                          <div className="recent-log-units">
                            <span className="recent-log-units-qty">+{log.units_produced} unid.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>

          {/* ── Próximas Entregas (admin) ── */}
          <UpcomingDeliveriesSection deliveries={upcomingDeliveries} navigate={navigate} />
        </>
      )}

       {isPartner && partnerStats && (
        <>
          {/* Partner Stats Grid */}
          <div className="dashboard-grid">
            <StatCard
              label={`Mis Ventas Totales (${periodLabel})`}
              value={formatCurrency(partnerStats.totalRevenue)}
              sub="Venta total de mis recetas en este período"
            />
            <StatCard
              label={`Dinero Recibido (${periodLabel})`}
              value={formatCurrency(partnerStats.paidRevenue)}
              sub="Ya abonado/pagado por clientes"
              style={{ borderLeft: '4px solid var(--color-success)' }}
            />
            <StatCard
              label={`Por Cobrar (${periodLabel})`}
              value={formatCurrency(partnerStats.pendingRevenue)}
              sub="Saldos pendientes de pago"
              style={{ borderLeft: '4px solid var(--color-warning)' }}
            />
          </div>

          <div className="dashboard-grid" style={{ marginTop: 'var(--space-3)' }}>
            <StatCard
              label={`Mi Ganancia (${periodLabel}) 🤝`}
              value={formatCurrency(partnerStats.totalProfit)}
              sub="50% de la utilidad neta de cada unidad"
              style={{ borderLeft: '4px solid var(--color-rose-500)', background: 'var(--color-rose-50)' }}
            />
            <StatCard
              label={`Porciones Vendidas (${periodLabel})`}
              value={partnerStats.salesCount}
              sub="Cantidad total de unidades vendidas"
            />
          </div>

          <div className="dashboard-row" style={{ marginTop: 'var(--space-4)' }}>
            {/* Jhon's recipes and profit splits */}
            <Card style={{ flex: 1.5 }}>
              <CardHeader>
                <h3>🍰 Mis Recetas y Ganancia por Unidad</h3>
              </CardHeader>
              <CardBody>
                {recipes.length === 0 ? (
                  <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No tienes recetas asignadas actualmente.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Receta</th>
                          <th style={{ textAlign: 'right' }}>Precio Venta</th>
                          <th style={{ textAlign: 'right' }}>Mi Ganancia / Unidad</th>
                          <th style={{ textAlign: 'right' }}>Mi Ganancia / Tanda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipes.map((recipe) => {
                          const profitInfo = partnerStats.recipeProfitMap[recipe.id];
                          if (!profitInfo) return null;

                          return (
                            <tr key={recipe.id}>
                              <td style={{ fontWeight: 'bold' }}>{recipe.name}</td>
                              <td style={{ textAlign: 'right' }}>
                                {formatCurrency(profitInfo.sellingPrice)}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 'bold' }}>
                                {formatCurrency(profitInfo.partnerProfitPerUnit)}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--color-rose-600)', fontWeight: 'bold' }}>
                                {formatCurrency(profitInfo.partnerProfitPerUnit * recipe.units_per_batch)}
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

            {/* Jhon's recent sales */}
            <Card style={{ flex: 1 }}>
              <CardHeader>
                <h3>🛍️ Ventas Recientes de mis Productos</h3>
              </CardHeader>
              <CardBody>
                {partnerStats.recentSales.length === 0 ? (
                  <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No se registran ventas recientes de tus productos.
                  </div>
                ) : (
                  <div className="recent-logs-list">
                    {partnerStats.recentSales.map((sale) => {
                      const cust = sale.customers?.name || sale.customer_name || 'Cliente general';
                      return (
                        <div key={sale.id} className="recent-log-item">
                          <div className="recent-log-info">
                            <span className="recent-log-recipe-name">👤 {cust}</span>
                            <span className="recent-log-date">{formatDate(sale.sale_date)}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="recent-log-units-qty" style={{ fontSize: 'var(--font-size-base)', fontWeight: 'bold' }}>
                              {formatCurrency(sale.total)}
                            </div>
                            <Badge variant={sale.is_paid ? 'success' : 'danger'}>
                              {sale.is_paid ? 'Pagado' : 'Por Cobrar'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* ── Próximas Entregas (partner) ── */}
          <UpcomingDeliveriesSection deliveries={upcomingDeliveries} navigate={navigate} />
        </>
      )}
    </div>
  );
}

// ── Componente: Próximas Entregas ─────────────────────────────────────────────
function UpcomingDeliveriesSection({ deliveries, navigate }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const getUrgencyInfo = (deliveryDate) => {
    if (!deliveryDate) return null;
    if (deliveryDate < todayStr) return { label: '⚠️ VENCIDO', cls: 'urgency-overdue' };
    if (deliveryDate === todayStr) return { label: '⚡ HOY', cls: 'urgency-today' };
    if (deliveryDate === tomorrowStr) return { label: '⏰ Mañana', cls: 'urgency-tomorrow' };
    return null;
  };

  return (
    <Card style={{ marginTop: 'var(--space-4)' }}>
      <CardHeader>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>📦 Próximas Entregas (próximos 14 días)</h3>
          <button
            className="upcoming-view-all-btn"
            onClick={() => navigate('/ventas')}
          >
            Ver todos →
          </button>
        </div>
      </CardHeader>
      <CardBody>
        {deliveries.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            ✓ No hay pedidos pendientes de entrega en los próximos 14 días.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="dashboard-table upcoming-table">
              <thead>
                <tr>
                  <th>Entrega</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Abonado</th>
                  <th style={{ textAlign: 'right' }}>Por Cobrar</th>
                  <th>Registró</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => {
                  const cust = delivery.customers?.name || delivery.customer_name || 'Cliente general';
                  const amountPaid = delivery.amount_paid ?? 0;
                  const remaining = delivery.total - amountPaid;
                  const urgency = getUrgencyInfo(delivery.delivery_date);
                  const registeredBy = delivery.profiles?.full_name;
                  return (
                    <tr
                      key={delivery.id}
                      className={`upcoming-row ${urgency?.cls ?? ''}`}
                      onClick={() => navigate('/ventas')}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 'bold' }}>{formatDate(delivery.delivery_date)}</span>
                          {urgency && (
                            <span className={`urgency-tag ${urgency.cls}`}>{urgency.label}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>👤 {cust}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {(delivery.sale_items ?? []).map((item) => (
                            <span key={item.id} style={{ fontSize: 'var(--font-size-sm)' }}>
                              {item.recipes?.name ?? '?'} ×{item.quantity}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-rose-600)' }}>
                        {formatCurrency(delivery.total)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 'bold' }}>
                        {amountPaid > 0 ? formatCurrency(amountPaid) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: remaining > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 'bold' }}>
                        {remaining > 0 ? formatCurrency(remaining) : '✓ Pagado'}
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        {registeredBy ?? '—'}
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
  );
}
