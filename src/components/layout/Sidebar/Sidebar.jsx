import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { PERMISSIONS } from '../../../utils/permissions';
import './Sidebar.css';

// ── Navegación por rol ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    section: 'Principal',
    items: [
      { to: '/',            icon: '🏠', label: 'Inicio',       permission: null },
      { to: '/ingredientes',icon: '📦', label: 'Ingredientes', permission: PERMISSIONS.VIEW_INGREDIENTS },
      { to: '/recetas',     icon: '🍰', label: 'Recetas',      permission: PERMISSIONS.VIEW_RECIPES },
    ],
  },
  {
    section: 'Operaciones',
    items: [
      { to: '/produccion',  icon: '🥣', label: 'Producción',      permission: PERMISSIONS.MANAGE_PRODUCTION },
      { to: '/compras',     icon: '🛒', label: 'Lista de compras', permission: PERMISSIONS.VIEW_SHOPPING_LIST },
    ],
  },
  {
    section: 'Ventas',
    items: [
      { to: '/ventas',    icon: '💰', label: 'Ventas',     permission: PERMISSIONS.VIEW_SALES },
      { to: '/clientes',  icon: '👥', label: 'Clientes',   permission: PERMISSIONS.VIEW_CUSTOMERS },
      { to: '/balance',   icon: '📊', label: 'Balance de caja', permission: null },
    ],
  },
  {
    section: 'Configuración',
    items: [
      { to: '/perfil',       icon: '👤', label: 'Mi Perfil',     permission: null },
      { to: '/proveedores',  icon: '🏪', label: 'Proveedores',   permission: PERMISSIONS.VIEW_PROVIDERS },
      { to: '/costos-extra', icon: '💸', label: 'Otros Costos',   permission: PERMISSIONS.VIEW_EXTRA_COST_ITEMS },
    ],
  },
];

// ── Accesos rápidos en barra inferior móvil (los 5 más usados) ────────────────
const BOTTOM_NAV_ITEMS = [
  { to: '/',          icon: '🏠', label: 'Inicio' },
  { to: '/ventas',    icon: '💰', label: 'Ventas' },
  { to: '/produccion',icon: '🥣', label: 'Producir' },
  { to: '/compras',   icon: '🛒', label: 'Compras' },
  { to: '/balance',   icon: '📊', label: 'Balance' },
];

// ── Componente Sidebar ────────────────────────────────────────────────────────
export default function Sidebar({ isOpen, onClose }) {
  const { profile, hasPermission, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = profile?.full_name
    ? profile.full_name.charAt(0).toUpperCase()
    : '?';

  const roleLabel = profile?.role === 'admin' ? 'Administradora' : 'Socio';

  return (
    <>
      {/* Overlay mobile */}
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className={`app-sidebar sidebar ${isOpen ? 'open' : ''}`}>
        {/* Branding */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">🎂</div>
          <div>
            <div className="sidebar-brand-name">Mi Pastelería</div>
            <div className="sidebar-brand-sub">Gestión de negocio</div>
          </div>
        </div>

        {/* Navegación */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((section) => {
            const visibleItems = section.items.filter(
              (item) => item.permission === null || hasPermission(item.permission)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.section}>
                <div className="sidebar-section-label">{section.section}</div>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? 'active' : ''}`
                    }
                    onClick={onClose}
                  >
                    <span className="nav-link-icon">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Footer: usuario + logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{profile?.full_name ?? 'Usuario'}</div>
            <div className="sidebar-user-role">{roleLabel}</div>
          </div>
          <button
            className="sidebar-logout-btn"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            🚪
          </button>
        </div>
      </aside>
    </>
  );
}

/**
 * Barra superior para mobile (hamburger + brand).
 */
export function MobileNavbar({ onMenuOpen }) {
  return (
    <header className="mobile-navbar">
      <div className="mobile-nav-brand">
        <span>🎂</span>
        <span>Mi Pastelería</span>
      </div>
      <button
        className="mobile-menu-btn"
        onClick={onMenuOpen}
        aria-label="Abrir menú"
      >
        ☰
      </button>
    </header>
  );
}

/**
 * Barra de navegación inferior fija para móvil — accesos rápidos.
 */
export function MobileBottomNav() {
  const location = useLocation();
  return (
    <nav className="mobile-bottom-nav">
      {BOTTOM_NAV_ITEMS.map((item) => {
        const isActive = item.to === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.to);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

