import { NavLink, useNavigate } from 'react-router-dom';
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
    ],
  },
  {
    section: 'Configuración',
    items: [
      { to: '/proveedores',  icon: '🏪', label: 'Proveedores',   permission: PERMISSIONS.VIEW_PROVIDERS },
      { to: '/costos-extra', icon: '💸', label: 'Otros Costos',   permission: PERMISSIONS.VIEW_EXTRA_COST_ITEMS },
    ],
  },
];

// ── Componente ────────────────────────────────────────────────────────────────
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
