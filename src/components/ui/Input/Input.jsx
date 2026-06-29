import { useState, useRef, useEffect } from 'react';
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

/**
 * Selector con buscador integrado.
 */
export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Buscar...',
  error,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    if (!isOpen) {
      setSearch(selectedOption ? selectedOption.label : '');
    }
  }, [value, selectedOption, isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    (opt.label ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (option) => {
    onChange({ target: { value: option.value } });
    setSearch(option.label);
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
    setSearch('');
  };

  return (
    <div ref={wrapperRef} className={`searchable-select-wrapper ${className}`}>
      <input
        type="text"
        className={`input searchable-select-input ${error ? 'input-error' : ''}`}
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={handleFocus}
      />
      {isOpen && (
        <ul className="searchable-select-dropdown">
          {filteredOptions.length === 0 ? (
            <li className="searchable-select-no-results">Sin resultados</li>
          ) : (
            filteredOptions.map((opt) => (
              <li
                key={opt.value}
                className={`searchable-select-option ${String(opt.value) === String(value) ? 'selected' : ''}`}
                onClick={() => handleSelect(opt)}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default Input;
