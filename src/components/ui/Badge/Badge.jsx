import './Badge.css';

/**
 * Badge / etiqueta de estado.
 * @param {'success'|'warning'|'error'|'info'|'rose'|'neutral'} variant
 */
export default function Badge({ children, variant = 'rose', className = '' }) {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {children}
    </span>
  );
}
