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

    // 최대 3회 재시도 (Extension Service Worker 재시작 대기)
    const maxRetries = 3;
    const retryDelay = 500; // 500ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = getExtensionClient();
        const response = await client.send('PING');
        setState({ isConnected: true, isChecking: false, version: response.version });
        return true;
      } catch (error) {
        // 마지막 시도가 아니면 대기 후 재시도
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        // 마지막 시도 실패
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState({ isConnected: false, isChecking: false, error: message });
        return false;
      }
    }
    return false;
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
