import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getExtensionClient } from '@/lib/extension-client';

interface ExtensionState {
  isConnected: boolean;
  isChecking: boolean;
  version?: string;
  error?: string;
}

interface ExtensionContextValue extends ExtensionState {
  checkConnection: () => Promise<boolean>;
  retry: () => void;
}

const ExtensionContext = createContext<ExtensionContextValue | null>(null);

interface ExtensionProviderProps {
  children: ReactNode;
  checkInterval?: number;
}

export function ExtensionProvider({ children, checkInterval = 30000 }: ExtensionProviderProps) {
  const [state, setState] = useState<ExtensionState>({ isConnected: false, isChecking: true });

  const checkConnection = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isChecking: true, error: undefined }));
    try {
      const client = getExtensionClient();
      const response = await client.send('PING');
      setState({ isConnected: true, isChecking: false, version: response.version });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState({ isConnected: false, isChecking: false, error: message });
      return false;
    }
  }, []);

  const retry = useCallback(() => { checkConnection(); }, [checkConnection]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  useEffect(() => {
    if (!state.isConnected) return;
    const interval = setInterval(checkConnection, checkInterval);
    return () => clearInterval(interval);
  }, [state.isConnected, checkConnection, checkInterval]);

  useEffect(() => {
    const handleFocus = () => { checkConnection(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkConnection]);

  return (
    <ExtensionContext.Provider value={{ ...state, checkConnection, retry }}>
      {children}
    </ExtensionContext.Provider>
  );
}

export function useExtension(): ExtensionContextValue {
  const context = useContext(ExtensionContext);
  if (!context) throw new Error('useExtension must be used within ExtensionProvider');
  return context;
}

export function useRequireExtension(): ExtensionContextValue & { isReady: boolean } {
  const extension = useExtension();
  const isReady = extension.isConnected && !extension.isChecking;
  return { ...extension, isReady };
}
