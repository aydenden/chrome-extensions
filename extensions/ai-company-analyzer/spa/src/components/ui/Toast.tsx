import { useState, createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; type: ToastType; message: string; }
interface ToastContextValue { showToast: (message: string, type?: ToastType) => void; }

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 3000);
  };

  const removeToast = (id: string) => { setToasts(prev => prev.filter(t => t.id !== id)); };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map(toast => <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />)}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const colors = { success: 'bg-signal-positive', error: 'bg-signal-negative', info: 'bg-ink' };
  return (
    <div className={`${colors[toast.type]} text-paper px-4 py-3 shadow-card flex items-center gap-3 min-w-[250px]`}>
      <span className="flex-1">{toast.message}</span>
      <button onClick={onClose} className="text-paper/70 hover:text-paper">×</button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
