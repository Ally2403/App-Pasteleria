import './Button.css';

/**
 * Componente Button reutilizable.
 *
 * @param {'primary'|'secondary'|'ghost'|'danger'|'success'} variant
 * @param {'sm'|'md'|'lg'} size
 * @param {boolean} fullWidth
 * @param {boolean} loading
 * @param {boolean} icon - Solo ícono (cuadrado)
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon = false,
  className = '',
  disabled,
  ...props
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    size === 'lg' ? 'btn-lg' : '',
    fullWidth ? 'btn-full' : '',
    loading ? 'btn-loading' : '',
    icon ? 'btn-icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {children}
    </button>
  );
}
