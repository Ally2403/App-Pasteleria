import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getIngredients } from '../../services/ingredients.service';
import { getDetailedRecipes } from '../../services/recipes.service';
import { getProductionLogs } from '../../services/production.service';
import { getSalesStats, getRecentSales } from '../../services/sales.service';
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
  const [stats, setStats] = useState({ salesCount: 0, totalRevenue: 0, paidRevenue: 0, pendingRevenue: 0, byProduct: [] });
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const [recipesData, ingredientsData, logsData, statsData, recentSalesData] = await Promise.all([
          getDetailedRecipes(),
          getIngredients(),
          getProductionLogs(),
          getSalesStats(period),
          getRecentSales(5),
        ]);
        setRecipes(recipesData);
        setIngredients(ingredientsData);
        setProductionLogs(logsData.slice(0, 5));
        setStats(statsData);
        setRecentSales(recentSalesData);
      } else if (isPartner) {
        // Load partner's specific detailed recipes
        const recipesData = await getDetailedRecipes({ role, userId: user?.id });
        setRecipes(recipesData);

        // Load recent sales and stats for Jhon
        const recentSalesData = await getRecentSales(20); // Load more to filter in JS
        setRecentSales(recentSalesData);
      }
    } catch (error) {
      console.error('Error al cargar datos del Dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [role, user, isAdmin, isPartner, period]);

  // Recalculate stats when period changes (for admin) or compute partner stats
  const partnerStats = useMemo(() => {
    if (!isPartner) return null;

    // Create a map of recipe ID to partner profit per unit
    const recipeProfitMap = {};
    recipes.forEach((recipe) => {
      const summary = calcRecipeSummary({
        ingredients: recipe.recipe_ingredients.map((ri) => ({
          unitPrice: ri.ingredients?.unit_price ?? 0,
          quantityUsed: ri.quantity_used,
        })),
        extraCosts: recipe.recipe_extra_costs.map((rec) => ({
          quantity: rec.quantity,
          unitPrice: rec.unit_price,
          type: rec.type,
        })),
        unitsPerBatch: recipe.units_per_batch,
        profitPercentage: getRecipePricing(recipe).profit_percentage ?? 50,
        roundedPrice: getRecipePricing(recipe).rounded_price,
        hasPartner: recipe.has_partner,
      });

      recipeProfitMap[recipe.id] = {
        partnerProfitPerUnit: summary.partnerProfit / recipe.units_per_batch,
        unitCost: summary.unitCost,
        sellingPrice: summary.sellingPrice,
        recipeName: recipe.name,
      };
    });

    // Filter recent sales containing Jhon's partner products
    const jhonSales = recentSales.filter((sale) =>
      sale.sale_items?.some((item) => recipeProfitMap[item.recipes?.id])
    );

    // Compute Jhon's revenue and profit splits
    let totalJhonSalesRevenue = 0;
    let totalJhonProfit = 0;
    const byProductMap = {};

    jhonSales.forEach((sale) => {
      sale.sale_items?.forEach((item) => {
        const recipeId = item.recipes?.id;
        const profitInfo = recipeProfitMap[recipeId];
        if (!profitInfo) return;

        const itemRevenue = item.quantity * item.unit_price;
        const itemProfit = profitInfo.partnerProfitPerUnit * item.quantity;

        totalJhonSalesRevenue += itemRevenue;
        totalJhonProfit += itemProfit;

        if (!byProductMap[recipeId]) {
          byProductMap[recipeId] = {
            recipeName: profitInfo.recipeName,
            totalQty: 0,
            totalRevenue: 0,
            totalProfit: 0,
          };
        }
        byProductMap[recipeId].totalQty += item.quantity;
        byProductMap[recipeId].totalRevenue += itemRevenue;
        byProductMap[recipeId].totalProfit += itemProfit;
      });
    });

    return {
      salesCount: jhonSales.length,
      totalRevenue: totalJhonSalesRevenue,
      totalProfit: totalJhonProfit,
      recentSales: jhonSales.slice(0, 5),
      byProduct: Object.values(byProductMap).sort((a, b) => b.totalProfit - a.totalProfit),
      recipeProfitMap,
    };
  }, [recipes, recentSales, isPartner]);

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

  if (loading) {
    return (
      <div className="app-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-16)' }}>
        <LoadingSpinner size="lg" text="Cargando panel de control..." />
      </div>
    );
  }

  const periodLabel = {
    day: 'hoy',
    week: 'esta semana',
    month: 'este mes',
    year: 'este año',
  }[period];

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

      {/* Stats period selector for Admin */}
      {isAdmin && (
        <div className="period-selector-row">
          <span className="period-selector-label">Ver estadísticas de:</span>
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
        </div>
      )}

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
        </>
      )}

      {isPartner && partnerStats && (
        <>
          {/* Partner Stats Grid */}
          <div className="dashboard-grid">
            <StatCard
              label="Mis Ventas Totales"
              value={formatCurrency(partnerStats.totalRevenue)}
              sub="Venta acumulada de mis recetas"
            />
            <StatCard
              label="Mi Ganancia Acumulada 🤝"
              value={formatCurrency(partnerStats.totalProfit)}
              sub="50% de la utilidad neta de cada unidad"
              style={{ borderLeft: '4px solid var(--color-rose-500)', background: 'var(--color-rose-50)' }}
            />
            <StatCard
              label="Ventas Registradas"
              value={partnerStats.salesCount}
              sub="Lotes con mi participación"
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
        </>
      )}
    </div>
  );
}
