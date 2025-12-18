# Feature 19: React Router 설정

## 개요

React Router를 설정하고 모든 라우트를 정의합니다.

## 범위

- App.tsx (BrowserRouter, Routes)
- 라우트 정의 (/, /company/:id, /analysis/:id, /settings)
- NotFound 페이지

## 의존성

- Feature 17: SPA Common Layout

## 구현 상세

### spa/src/App.tsx

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';
import { ExtensionProvider, useExtension } from '@/contexts/ExtensionContext';
import { ToastProvider } from '@/components/ui';
import { Layout } from '@/components/layout';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { ExtensionErrorBoundary } from '@/components/errors/ExtensionErrorBoundary';

import CompanyList from '@/pages/CompanyList';
import CompanyDetail from '@/pages/CompanyDetail';
import Analysis from '@/pages/Analysis';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';
import ExtensionRequired from '@/pages/ExtensionRequired';
import LoadingPage from '@/pages/LoadingPage';

function AppRoutes() {
  const { isConnected, isChecking } = useExtension();

  if (isChecking) {
    return <LoadingPage message="Extension 연결 확인 중..." />;
  }

  if (!isConnected) {
    return <ExtensionRequired />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<CompanyList />} />
        <Route path="/company/:companyId" element={<CompanyDetail />} />
        <Route path="/analysis/:companyId" element={<Analysis />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/ai-company-analyzer">
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ExtensionProvider>
            <ToastProvider>
              <ExtensionErrorBoundary fallback={<ExtensionRequired />}>
                <AppRoutes />
              </ExtensionErrorBoundary>
            </ToastProvider>
          </ExtensionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
```

### spa/src/pages/NotFound.tsx

```tsx
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="headline text-6xl mb-4">404</h1>
        <p className="text-xl text-ink-muted mb-8">
          페이지를 찾을 수 없습니다
        </p>
        <Link to="/">
          <Button variant="secondary">
            홈으로 돌아가기
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

### spa/src/pages/LoadingPage.tsx

```tsx
import { Spinner } from '@/components/ui';

interface LoadingPageProps {
  message?: string;
}

export default function LoadingPage({ message = '로딩 중...' }: LoadingPageProps) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-4" />
        <p className="text-ink-muted">{message}</p>
      </div>
    </div>
  );
}
```

### spa/src/components/errors/ErrorBoundary.tsx

```tsx
import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center">
          <div className="max-w-md text-center p-8">
            <h1 className="headline text-3xl mb-4">오류가 발생했습니다</h1>
            <p className="text-ink-muted mb-4">
              예기치 않은 오류가 발생했습니다.
            </p>
            {this.state.error && (
              <pre className="bg-surface-sunken p-4 text-sm text-left overflow-auto mb-6 font-mono">
                {this.state.error.message}
              </pre>
            )}
            <Button onClick={this.handleRetry}>
              다시 시도
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 라우트 상수 정의

```typescript
// spa/src/lib/routes.ts

export const ROUTES = {
  HOME: '/',
  COMPANY_DETAIL: (id: string) => `/company/${id}`,
  ANALYSIS: (id: string) => `/analysis/${id}`,
  SETTINGS: '/settings',
} as const;
```

### 사용 예시

```tsx
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';

function CompanyCard({ company }) {
  const navigate = useNavigate();

  return (
    <Card
      hoverable
      onClick={() => navigate(ROUTES.COMPANY_DETAIL(company.id))}
    >
      {/* ... */}
    </Card>
  );
}
```

## 완료 기준

- [ ] BrowserRouter with basename 설정
- [ ] 모든 라우트 정의 (/, /company/:companyId, /analysis/:companyId, /settings)
- [ ] NotFound (404) 페이지
- [ ] LoadingPage 컴포넌트
- [ ] ErrorBoundary 래퍼
- [ ] 라우트 네비게이션 동작 확인

## 참조 문서

- spec/03-spa-structure.md Section 3 (라우팅 구조)
