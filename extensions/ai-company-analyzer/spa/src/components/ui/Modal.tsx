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
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="bg-paper w-full max-w-lg shadow-modal" role="dialog" aria-modal="true">
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-ink">
              <h2 className="headline text-lg">{title}</h2>
              <button onClick={onClose} className="text-ink-muted hover:text-ink text-2xl leading-none" aria-label="닫기">×</button>
            </div>
          )}
          <div className="px-6 py-4">{children}</div>
          {footer && <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-3">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}
