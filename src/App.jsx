import { useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Sidebar, { MobileNavbar, MobileBottomNav } from './components/layout/Sidebar/Sidebar';
import { PERMISSIONS } from './utils/permissions';

// Importar Páginas
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import IngredientsPage from './pages/IngredientsPage';
import RecipesPage from './pages/RecipesPage';
import ProductionPage from './pages/ProductionPage';
import ShoppingPage from './pages/ShoppingPage';
import SalesPage from './pages/SalesPage';
import CustomersPage from './pages/CustomersPage';
import ProvidersPage from './pages/ProvidersPage';
import ExtraCostsPage from './pages/ExtraCostsPage';
import ProfilePage from './pages/ProfilePage/ProfilePage';
import BalancePage from './pages/BalancePage/BalancePage';

// Componente Layout que envuelve las páginas protegidas
function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      {/* Barra de navegación lateral */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Contenedor principal */}
      <div className="app-main">
        {/* Barra superior en móviles */}
        <MobileNavbar onMenuOpen={() => setSidebarOpen(true)} />
        
        {/* Aquí se renderizan las sub-rutas */}
        <Outlet />
        {/* Barra de navegación inferior — solo visible en móvil */}
        <MobileBottomNav />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta de Login pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rutas Privadas / Protegidas */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Inicio / Dashboard */}
            <Route index element={<DashboardPage />} />

            {/* Inventario de Ingredientes */}
            <Route
              path="ingredientes"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_INGREDIENTS}>
                  <IngredientsPage />
                </ProtectedRoute>
              }
            />

            {/* Catálogo de Recetas */}
            <Route
              path="recetas"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_RECIPES}>
                  <RecipesPage />
                </ProtectedRoute>
              }
            />

            {/* Registro de Producción */}
            <Route
              path="produccion"
              element={
                <ProtectedRoute permission={PERMISSIONS.MANAGE_PRODUCTION}>
                  <ProductionPage />
                </ProtectedRoute>
              }
            />

            {/* Lista de Compras */}
            <Route
              path="compras"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_SHOPPING_LIST}>
                  <ShoppingPage />
                </ProtectedRoute>
              }
            />

            {/* Registro de Ventas */}
            <Route
              path="ventas"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_SALES}>
                  <SalesPage />
                </ProtectedRoute>
              }
            />

            {/* Gestión de Clientes */}
            <Route
              path="clientes"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_CUSTOMERS}>
                  <CustomersPage />
                </ProtectedRoute>
              }
            />

            {/* Gestión de Proveedores */}
            <Route
              path="proveedores"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_PROVIDERS}>
                  <ProvidersPage />
                </ProtectedRoute>
              }
            />

            {/* Gestión de Otros Costos */}
            <Route
              path="costos-extra"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_EXTRA_COST_ITEMS}>
                  <ExtraCostsPage />
                </ProtectedRoute>
              }
            />

            {/* Perfil del Usuario */}
            <Route
              path="perfil"
              element={<ProfilePage />}
            />

            {/* Balance y Caja Mensual */}
            <Route
              path="balance"
              element={<BalancePage />}
            />
          </Route>

          {/* Redirección por defecto si la ruta no existe */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
