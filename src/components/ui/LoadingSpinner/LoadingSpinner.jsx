import './LoadingSpinner.css';

export default function LoadingSpinner({ size = 'md', text = '' }) {
  return (
    <div className={`spinner-wrapper spinner-${size}`}>
      <div className="spinner" />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
}

/**
 * Pantalla de carga completa (para cargas de página).
 */
export function PageLoader({ text = 'Cargando...' }) {
  return (
    <div className="page-loader">
      <div className="page-loader-inner">
        <span className="page-loader-emoji">🎂</span>
        <LoadingSpinner size="lg" />
        <p className="page-loader-text">{text}</p>
      </div>
    </div>
  );
}
