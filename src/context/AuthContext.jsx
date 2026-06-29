/**
 * AuthContext.jsx
 * Contexto global de autenticación + hook useAuth.
 * Provee el usuario, perfil y permisos a toda la app.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getCurrentSession, onAuthStateChange, signIn as authSignIn, signOut as authSignOut, getProfile } from '../services/auth.service';
import { hasPermission as checkPermission } from '../utils/permissions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar sesión al montar
  useEffect(() => {
    getCurrentSession().then(({ user, profile }) => {
      setUser(user);
      setProfile(profile);
      setLoading(false);
    });

    // Escuchar cambios de sesión (logout, refresh de token, etc.)
    const unsubscribe = onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const prof = await getProfile(session.user.id);
        setUser(session.user);
        setProfile(prof);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email, password) => {
    const result = await authSignIn(email, password);
    if (!result.error) {
      setUser(result.user);
      setProfile(result.profile);
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setProfile(null);
  }, []);

  /**
   * Verifica si el usuario actual tiene un permiso.
   * @param {string} permission - Constante de PERMISSIONS
   * @returns {boolean}
   */
  const hasPermission = useCallback(
    (permission) => checkPermission(profile?.role, permission),
    [profile]
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const prof = await getProfile(user.id);
    setProfile(prof);
  }, [user]);

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    isAdmin:   profile?.role === 'admin',
    isPartner: profile?.role === 'partner',
    isAuthenticated: !!user,
    loading,
    signIn,
    signOut,
    hasPermission,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para acceder al contexto de autenticación.
 * Debe usarse dentro de <AuthProvider>.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}
