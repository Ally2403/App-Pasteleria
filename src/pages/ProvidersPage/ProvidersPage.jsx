import { useState, useEffect } from 'react';
import { getProviders, deleteProvider } from '../../services/providers.service';
import { getIngredients } from '../../services/ingredients.service';
import { getExtraCostItems } from '../../services/extra_costs.service';
import { formatCurrency } from '../../utils/formatters';
import { Card, CardBody } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import './ProvidersPage.css';

export default function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [extraCosts, setExtraCosts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [providersData, ingredientsData, costsData] = await Promise.all([
        getProviders(),
        getIngredients(),
        getExtraCostItems(),
      ]);
      setProviders(providersData);
      setIngredients(ingredientsData);
      setExtraCosts(costsData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = providers.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProvider(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      alert('No se pudo eliminar el proveedor. Es posible que esté asociado a algún ingrediente activo.');
      console.error(error);
    }
  };

  return (
    <div className="app-content animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>🏪 Proveedores</h1>
          <p>Visualiza los proveedores del negocio y sus ingredientes comprados.</p>
        </div>
      </div>

      <div className="search-bar">
        <Input
          id="provider-search"
          placeholder="🔍 Buscar proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <LoadingSpinner size="lg" text="Cargando proveedores..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🏪</span>
          <h3>{search ? 'Sin resultados' : '¡Aún no hay proveedores!'}</h3>
          <p>
            {search
              ? `No encontramos nada para "${search}"`
              : 'Los proveedores se registran automáticamente cuando agregas ingredientes y defines de dónde provienen.'}
          </p>
        </div>
      ) : (
        <div className="providers-grid">
          {filtered.map((provider) => {
            const providerIngs = ingredients.filter(
              (ing) => ing.provider?.trim().toLowerCase() === provider.name.trim().toLowerCase()
            );
            const providerCosts = extraCosts.filter(
              (c) => c.provider?.trim().toLowerCase() === provider.name.trim().toLowerCase()
            );

            return (
              <Card hoverable key={provider.id} className="provider-card animate-fade-in-up">
                <CardBody className="provider-card-body-container">
                  <div className="provider-card-header-row">
                    <div className="provider-info">
                      <span className="provider-icon">🏪</span>
                      <div className="provider-details">
                        <span className="provider-name">{provider.name}</span>
                        <span className="provider-date">
                          Registrado: {new Date(provider.created_at).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon
                      onClick={() => setDeleteTarget(provider)}
                      title="Eliminar proveedor"
                    >
                      🗑️
                    </Button>
                  </div>

                  <div className="provider-ingredients-section">
                    <span className="section-title">🛒 Ingredientes comprados aquí:</span>
                    {providerIngs.length === 0 ? (
                      <span className="no-ingredients">Ninguno registrado aún</span>
                    ) : (
                      <div className="provider-ingredients-tags">
                        {providerIngs.map((ing) => (
                          <span key={ing.id} className="ingredient-tag">
                            {ing.name} ({formatCurrency(ing.price)})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {providerCosts.length > 0 && (
                    <div className="provider-ingredients-section" style={{ marginTop: 'var(--space-3)' }}>
                      <span className="section-title">💸 Otros costos comprados aquí:</span>
                      <div className="provider-ingredients-tags">
                        {providerCosts.map((c) => (
                          <span key={c.id} className="ingredient-tag" style={{ background: 'var(--color-peach-100)', color: 'var(--color-text-secondary)' }}>
                            {c.name} ({formatCurrency(c.unit_price)}/ud)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Confirmar eliminación */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="🗑️ Eliminar proveedor"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Sí, eliminar
            </Button>
          </>
        }
      >
        <p>¿Estás segura de eliminar al proveedor <strong>{deleteTarget?.name}</strong>?</p>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
          Solo puedes eliminar proveedores que no estén asociados a ningún ingrediente.
        </p>
      </Modal>
    </div>
  );
}
