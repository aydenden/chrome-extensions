# Feature 14: Extension 연결 상태 Context

## 개요

Extension 연결 상태를 관리하는 React Context를 구현합니다.

## 범위

- ExtensionContext.tsx
- useExtension() 훅
- 연결 상태 체크 (PING)
- ExtensionErrorBoundary

## 의존성

- Feature 13: SPA Extension Client

## 구현 상세

### spa/src/contexts/ExtensionContext.tsx

```typescript
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { getExtensionClient, type ExtensionState } from '@/lib/extension-client';
import { ExtensionError } from '@shared/types';

interface ExtensionContextValue extends ExtensionState {
  checkConnection: () => Promise<boolean>;
  retry: () => void;
}

const ExtensionContext = createContext<ExtensionContextValue | null>(null);

interface ExtensionProviderProps {
  children: ReactNode;
  checkInterval?: number; // 연결 체크 간격 (ms)
}

export function ExtensionProvider({
  children,
  checkInterval = 30000, // 기본 30초
}: ExtensionProviderProps) {
  const [state, setState] = useState<ExtensionState>({
    isConnected: false,
    isChecking: true,
  });

  const checkConnection = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isChecking: true, error: undefined }));

    try {
      const client = getExtensionClient();
      const response = await client.send('PING');

      setState({
        isConnected: true,
        isChecking: false,
        version: response.version,
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      setState({
        isConnected: false,
        isChecking: false,
        error: message,
      });

      return false;
    }
  }, []);

  const retry = useCallback(() => {
    checkConnection();
  }, [checkConnection]);

  // 초기 연결 체크
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // 주기적 연결 체크
  useEffect(() => {
    if (!state.isConnected) return;

    const interval = setInterval(checkConnection, checkInterval);
    return () => clearInterval(interval);
  }, [state.isConnected, checkConnection, checkInterval]);

  // 포커스 시 연결 체크
  useEffect(() => {
    const handleFocus = () => {
      checkConnection();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkConnection]);

  return (
    <ExtensionContext.Provider
      value={{
        ...state,
        checkConnection,
        retry,
      }}
    >
      {children}
    </ExtensionContext.Provider>
  );
}

/** Extension Context Hook */
export function useExtension(): ExtensionContextValue {
  const context = useContext(ExtensionContext);

  if (!context) {
    throw new Error('useExtension must be used within ExtensionProvider');
  }

  return context;
}

/** Extension 연결 필요 여부 체크 Hook */
export function useRequireExtension(): ExtensionContextValue & { isReady: boolean } {
  const extension = useExtension();
  const isReady = extension.isConnected && !extension.isChecking;

  return { ...extension, isReady };
}
```

### spa/src/components/errors/ExtensionErrorBoundary.tsx

```typescript
import React, { Component, type ReactNode } from 'react';
import { ExtensionError } from '@shared/types';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ExtensionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    // ExtensionError만 이 경계에서 처리
    if (error instanceof ExtensionError) {
      return { hasError: true, error };
    }
    // 다른 에러는 상위 경계로 전파
    throw error;
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}
```

### spa/src/pages/ExtensionRequired.tsx

```tsx
import { useExtension } from '@/contexts/ExtensionContext';

export default function ExtensionRequired() {
  const { error, isChecking, retry } = useExtension();

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="max-w-md text-center p-8">
        <h1 className="text-3xl font-bold mb-4">Extension 연결 필요</h1>

        <p className="text-ink-muted mb-6">
          AI Company Analyzer Extension이 설치되어 있지 않거나
          연결할 수 없습니다.
        </p>

        {error && (
          <p className="text-signal-negative mb-4 text-sm">
            오류: {error}
          </p>
        )}

        <div className="space-y-4">
          <button
            onClick={retry}
            disabled={isChecking}
            className="w-full px-6 py-3 bg-ink text-paper font-semibold"
          >
            {isChecking ? '연결 확인 중...' : '다시 시도'}
          </button>

          <a
            href="chrome://extensions"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-signal-neutral underline"
          >
            Extension 설치하러 가기
          </a>
        </div>
      </div>
    </div>
  );
}
```

### spa/src/App.tsx에서 사용

```tsx
import { ExtensionProvider, useExtension } from '@/contexts/ExtensionContext';
import { ExtensionErrorBoundary } from '@/components/errors/ExtensionErrorBoundary';
import ExtensionRequired from '@/pages/ExtensionRequired';

function AppContent() {
  const { isConnected, isChecking } = useExtension();

  if (isChecking) {
    return <LoadingPage message="Extension 연결 확인 중..." />;
  }

  if (!isConnected) {
    return <ExtensionRequired />;
  }

  return <RouterProvider router={router} />;
}

function App() {
  return (
    <ExtensionProvider>
      <ExtensionErrorBoundary fallback={<ExtensionRequired />}>
        <AppContent />
      </ExtensionErrorBoundary>
    </ExtensionProvider>
  );
}
```

## 완료 기준

- [ ] 초기 로드 시 Extension 연결 체크
- [ ] 연결 성공 시 version 정보 표시
- [ ] 연결 실패 시 에러 메시지 및 재시도 버튼
- [ ] 주기적 연결 상태 체크
- [ ] 창 포커스 시 연결 재확인
- [ ] ExtensionErrorBoundary에서 ExtensionError 캐치

## 참조 문서

- spec/03-spa-structure.md Section 4.2 (클라이언트 상태)
- spec/01-architecture.md Section 9 (에러 처리)
