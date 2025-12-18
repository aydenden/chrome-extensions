import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('bg-surface-elevated border border-border-subtle', hoverable && 'hover:shadow-card transition-shadow cursor-pointer', className)}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';
export default Card;
