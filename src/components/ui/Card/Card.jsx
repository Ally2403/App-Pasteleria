
import './Card.css';

export function Card({ children, hoverable = false, highlighted = false, className = '', ...props }) {
  const classes = [
    'card',
    hoverable ? 'card-hoverable' : '',
    highlighted ? 'card-highlighted' : '',
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes} {...props}>{children}</div>;
}

export function CardHeader({ children, className = '' }) {
  return <div className={`card-header ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return <div className={`card-footer ${className}`}>{children}</div>;
}

/**
 * Tarjeta de estadística/métrica.
 */
export function StatCard({ label, value, sub, className = '' }) {
  return (
    <div className={`card card-stat ${className}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default Card;
