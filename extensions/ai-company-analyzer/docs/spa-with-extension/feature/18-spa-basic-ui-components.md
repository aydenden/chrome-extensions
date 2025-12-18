# Feature 18: 기본 UI 컴포넌트

## 개요

재사용 가능한 기본 UI 컴포넌트를 구현합니다.

## 범위

- Button.tsx (샤프한 스타일)
- Card.tsx
- Modal.tsx
- Toast.tsx
- Spinner.tsx, ProgressBar.tsx

## 의존성

- Feature 16: SPA Design System Foundation

## 구현 상세

### spa/src/components/ui/Button.tsx

```tsx
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

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
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
```

### spa/src/components/ui/Card.tsx

```tsx
import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-surface-elevated border border-border-subtle',
          hoverable && 'hover:shadow-card transition-shadow cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
```

### spa/src/components/ui/Modal.tsx

```tsx
import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="bg-paper w-full max-w-lg shadow-modal"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-ink">
              <h2 className="headline text-lg">{title}</h2>
              <button
                onClick={onClose}
                className="text-ink-muted hover:text-ink text-2xl leading-none"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
          )}

          {/* Content */}
          <div className="px-6 py-4">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
```

### spa/src/components/ui/Spinner.tsx

```tsx
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <svg
      className={cn('animate-spin text-ink', sizes[size], className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
```

### spa/src/components/ui/ProgressBar.tsx

```tsx
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  showLabel?: boolean;
  className?: string;
}

export default function ProgressBar({ value, showLabel = true, className }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('w-full', className)}>
      <div className="h-2 bg-surface-sunken">
        <div
          className="h-full bg-ink transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-right">
          <span className="data-figure text-sm text-ink-muted">{percentage}%</span>
        </div>
      )}
    </div>
  );
}
```

### spa/src/components/ui/Toast.tsx

```tsx
import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const colors = {
    success: 'bg-signal-positive',
    error: 'bg-signal-negative',
    info: 'bg-ink',
  };

  return (
    <div
      className={`${colors[toast.type]} text-paper px-4 py-3 shadow-card flex items-center gap-3 min-w-[250px]`}
    >
      <span className="flex-1">{toast.message}</span>
      <button onClick={onClose} className="text-paper/70 hover:text-paper">
        ×
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
```

### spa/src/lib/utils.ts

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### spa/src/components/ui/index.ts

```typescript
export { default as Button } from './Button';
export { default as Card } from './Card';
export { default as Modal } from './Modal';
export { default as Spinner } from './Spinner';
export { default as ProgressBar } from './ProgressBar';
export { ToastProvider, useToast } from './Toast';
```

## 완료 기준

- [ ] Button: 4가지 variant (primary, secondary, danger, ghost)
- [ ] Button: 3가지 size, loading 상태
- [ ] Card: hoverable 옵션
- [ ] Modal: Portal, ESC 닫기, backdrop 클릭 닫기
- [ ] Spinner: 3가지 size
- [ ] ProgressBar: 퍼센트 표시
- [ ] Toast: 자동 사라짐, 3가지 타입

## 참조 문서

- spec/05-design-system.md Section 7 (적용 원칙)
