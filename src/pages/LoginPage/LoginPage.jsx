import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Input';
import './LoginPage.css';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate   = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await signIn(email.trim(), password);

    if (authError) {
      setError('Email o contraseña incorrectos. Intenta de nuevo.');
    } else {
      navigate('/');
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* Panel decorativo — solo desktop */}
      <div className="login-deco">
        <div className="login-deco-circles">
          <div className="login-deco-circle" />
          <div className="login-deco-circle" />
          <div className="login-deco-circle" />
        </div>
        <div className="login-deco-content">
          <span className="login-deco-emoji">🎂</span>
          <h1 className="login-deco-title">Mi Pastelería</h1>
          <p className="login-deco-sub">
            Gestiona tus ingredientes, recetas<br />y ganancias en un solo lugar 🌸
          </p>
        </div>
      </div>

      {/* Panel del formulario */}
      <div className="login-form-panel">
        <div className="login-form-inner">
          <div className="login-form-header">
            <span className="login-mobile-emoji">🎂</span>
            <h2 className="login-form-title">¡Hola, bienvenida! 👋</h2>
            <p className="login-form-subtitle">Inicia sesión para continuar</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="login-error" role="alert">
                ⚠️ {error}
              </div>
            )}

            <Field label="Correo electrónico" required>
              <Input
                id="login-email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                iconLeft="✉️"
                autoComplete="email"
                required
                disabled={loading}
              />
            </Field>

            <Field label="Contraseña" required>
              <Input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                iconLeft="🔒"
                iconRight={
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                }
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </Field>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              id="login-submit-btn"
            >
              {loading ? 'Entrando...' : 'Entrar 🌸'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
