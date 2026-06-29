import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfileData, updateUserAuth } from '../../services/auth.service';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();

  // Estados del formulario de datos personales
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [updatingInfo, setUpdatingInfo] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState('');
  const [infoError, setInfoError] = useState('');

  // Estados del formulario de contraseña
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Estados del formulario de correo
  const [newEmail, setNewEmail] = useState(user?.email ?? '');
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    setInfoSuccess('');
    setInfoError('');

    if (!fullName.trim()) {
      setInfoError('Por favor escribe tu nombre completo.');
      return;
    }

    setUpdatingInfo(true);
    try {
      await updateProfileData(user.id, fullName.trim());
      await refreshProfile();
      setInfoSuccess('✓ Nombre actualizado correctamente.');
    } catch (err) {
      console.error(err);
      setInfoError('Error al actualizar tus datos personales.');
    } finally {
      setUpdatingInfo(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (!newPassword) {
      setPasswordError('Escribe la nueva contraseña.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }

    setUpdatingPassword(true);
    try {
      await updateUserAuth({ password: newPassword });
      setPasswordSuccess('✓ Contraseña actualizada correctamente.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setPasswordError('Error al actualizar la contraseña. Vuelve a iniciar sesión e inténtalo.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailSuccess('');
    setEmailError('');

    if (!newEmail.trim() || newEmail.trim() === user?.email) {
      setEmailError('Escribe un correo electrónico diferente.');
      return;
    }

    setUpdatingEmail(true);
    try {
      await updateUserAuth({ email: newEmail.trim() });
      setEmailSuccess('✓ Se ha enviado un correo de confirmación a tu nueva dirección para confirmar el cambio.');
    } catch (err) {
      console.error(err);
      setEmailError('Error al actualizar el correo electrónico.');
    } finally {
      setUpdatingEmail(false);
    }
  };

  return (
    <div className="app-content profile-page animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>👤 Mi Perfil</h1>
          <p>Gestiona tu información personal y tus credenciales de acceso a la aplicación.</p>
        </div>
      </div>

      <div className="profile-grid">
        {/* Sección: Información General */}
        <div className="profile-section-col">
          <Card>
            <CardHeader>
              <h3>📋 Datos del Perfil</h3>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleUpdateInfo} className="profile-form">
                <Field label="Cargo / Rol asignado">
                  <div className="profile-role-badge">
                    {profile?.role === 'admin' ? '🌸 Administradora' : '🤝 Socio de negocio'}
                  </div>
                </Field>

                <Field label="Nombre Completo">
                  <Input
                    id="profile-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: Cecilia Ruiz"
                  />
                </Field>

                {infoError && <div className="profile-error">{infoError}</div>}
                {infoSuccess && <div className="profile-success">{infoSuccess}</div>}

                <Button type="submit" loading={updatingInfo} style={{ marginTop: 'var(--space-2)' }}>
                  Guardar Datos
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card style={{ marginTop: 'var(--space-4)' }}>
            <CardHeader>
              <h3>📧 Cambiar Correo Electrónico</h3>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleUpdateEmail} className="profile-form">
                <Field label="Correo Actual / Nuevo Correo">
                  <Input
                    id="profile-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                  />
                </Field>

                {emailError && <div className="profile-error">{emailError}</div>}
                {emailSuccess && <div className="profile-success">{emailSuccess}</div>}

                <Button type="submit" variant="secondary" loading={updatingEmail} style={{ marginTop: 'var(--space-2)' }}>
                  Actualizar Correo
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Sección: Cambiar Contraseña */}
        <div className="profile-section-col">
          <Card>
            <CardHeader>
              <h3>🔑 Cambiar Contraseña</h3>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleUpdatePassword} className="profile-form">
                <Field label="Nueva Contraseña">
                  <Input
                    id="profile-new-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </Field>

                <Field label="Confirmar Nueva Contraseña">
                  <Input
                    id="profile-confirm-password"
                    type="password"
                    placeholder="Repite la contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </Field>

                {passwordError && <div className="profile-error">{passwordError}</div>}
                {passwordSuccess && <div className="profile-success">{passwordSuccess}</div>}

                <Button type="submit" loading={updatingPassword} style={{ marginTop: 'var(--space-2)' }}>
                  ✓ Cambiar Contraseña
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
