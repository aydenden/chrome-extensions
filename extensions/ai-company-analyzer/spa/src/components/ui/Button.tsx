import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold transition-colors border-2';
    const variants = {
      primary: 'bg-ink text-paper border-ink hover:bg-ink-soft disabled:bg-ink-muted disabled:border-ink-muted',
      secondary: 'bg-transparent text-ink border-ink hover:bg-ink hover:text-paper disabled:text-ink-muted disabled:border-ink-muted',
      danger: 'bg-signal-negative text-white border-signal-negative hover:bg-red-700 hover:border-red-700',
      ghost: 'bg-transparent text-ink border-transparent hover:bg-surface-sunken',
    };
    const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-base', lg: 'px-6 py-3 text-lg' };

    return (
      <button ref={ref} className={cn(baseStyles, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
export default Button;
