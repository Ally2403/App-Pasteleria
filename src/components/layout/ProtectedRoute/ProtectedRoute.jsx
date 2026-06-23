import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { PageLoader } from '../../ui/LoadingSpinner';

/**
 * Protege rutas que requieren autenticación.
 * Si no hay sesión → redirige a /login.
 * Si requiere un permiso específico y el usuario no lo tiene → redirige a /.
 *
 * @param {string} [permission] - Permiso requerido para acceder (opcional)
 */
export default function ProtectedRoute({ children, permission }) {
  const { isAuthenticated, loading, hasPermission } = useAuth();

  if (loading) return <PageLoader />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
