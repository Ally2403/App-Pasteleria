import './Input.css';

/**
 * Campo de formulario con label, error y hint.
 */
export function Field({ label, required, error, hint, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">⚠ {error}</span>}
    </div>
  );
}

/**
 * Input de texto con soporte para ícono y prefijo.
 */
export function Input({
  iconLeft,
  iconRight,
  prefix,
  error,
  className = '',
  ...props
}) {
  const hasIconLeft  = !!iconLeft;
  const hasIconRight = !!iconRight;
  const hasPrefix    = !!prefix;

  const inputClass = [
    'input',
    hasIconLeft || hasPrefix ? 'input-with-icon-left' : '',
    hasPrefix ? 'input-with-prefix' : '',
    hasIconRight ? 'input-with-icon-right' : '',
    error ? 'input-error' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className="input-wrapper">
      {hasPrefix && <span className="input-prefix">{prefix}</span>}
      {hasIconLeft && !hasPrefix && <span className="input-icon input-icon-left">{iconLeft}</span>}
      <input className={inputClass} {...props} />
      {hasIconRight && <span className="input-icon input-icon-right">{iconRight}</span>}
    </div>
  );
}

/**
 * Select con estilos del sistema.
 */
export function Select({ error, className = '', children, ...props }) {
  return (
    <div className="input-wrapper">
      <select
        className={`input select ${error ? 'input-error' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

/**
 * Textarea con estilos del sistema.
 */
export function Textarea({ error, className = '', ...props }) {
  return (
    <textarea
      className={`input textarea ${error ? 'input-error' : ''} ${className}`}
      {...props}
    />
  );
}

export default Input;
