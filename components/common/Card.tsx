import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  id?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', onClick, style, id }, ref) => {
    const isClickable = !!onClick;

    const baseClasses = 'bg-white rounded-(--radius-card) shadow-card p-(--spacing-card) border border-gray-100 transition-all duration-300 ease-out';
    const interactiveClasses = isClickable
      ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-gray-200 active:scale-[0.99]'
      : '';

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (onClick && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onClick();
      }
    };

    const a11yProps = isClickable
      ? { role: 'button', tabIndex: 0, onKeyDown: handleKeyDown }
      : {};

    return (
      <div
        ref={ref}
        id={id}
        className={`${baseClasses} ${interactiveClasses} ${className}`}
        onClick={onClick}
        {...a11yProps}
        style={style}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';