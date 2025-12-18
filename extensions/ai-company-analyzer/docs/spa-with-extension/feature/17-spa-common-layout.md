# Feature 17: 공통 레이아웃 + 헤더

## 개요

SPA의 공통 레이아웃과 헤더 컴포넌트를 구현합니다.

## 범위

- Layout.tsx
- Header.tsx (로고, 상태 인디케이터)
- 12컬럼 Editorial Grid

## 의존성

- Feature 16: SPA Design System Foundation

## 구현 상세

### spa/src/components/layout/Header.tsx

```tsx
import { Link, useLocation } from 'react-router-dom';
import { useExtension } from '@/contexts/ExtensionContext';

interface StatusIndicatorProps {
  label: string;
  status: 'ready' | 'loading' | 'error' | 'idle';
}

function StatusIndicator({ label, status }: StatusIndicatorProps) {
  const statusColors = {
    ready: 'bg-signal-positive',
    loading: 'bg-highlight-yellow animate-pulse',
    error: 'bg-signal-negative',
    idle: 'bg-ink-muted',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  );
}

export default function Header() {
  const location = useLocation();
  const { isConnected } = useExtension();

  const isSettingsPage = location.pathname === '/settings';

  return (
    <header className="border-b-2 border-ink bg-paper sticky top-0 z-50">
      <div className="editorial-grid py-4">
        <div className="col-span-12 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="headline text-lg tracking-tight">
            AI COMPANY ANALYZER
          </Link>

          {/* Status + Settings */}
          <div className="flex items-center gap-6">
            {/* Status Indicators */}
            <div className="hidden sm:flex items-center gap-4">
              <StatusIndicator
                label="Extension"
                status={isConnected ? 'ready' : 'error'}
              />
            </div>

            {/* Settings Button */}
            <Link
              to="/settings"
              className={`w-8 h-8 flex items-center justify-center border-2 ${
                isSettingsPage
                  ? 'bg-ink text-paper'
                  : 'border-ink text-ink hover:bg-ink hover:text-paper'
              } transition-colors`}
              aria-label="설정"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
```

### spa/src/components/layout/Layout.tsx

```tsx
import { type ReactNode } from 'react';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="py-8">
        {children}
      </main>
    </div>
  );
}
```

### spa/src/components/layout/PageHeader.tsx

```tsx
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  backTo,
  actions,
}: PageHeaderProps) {
  return (
    <div className="editorial-grid mb-8">
      <div className="col-span-12">
        {backTo && (
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 text-ink-muted hover:text-ink mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">뒤로</span>
          </Link>
        )}

        <div className="flex items-start justify-between">
          <div>
            <h1 className="headline text-3xl sm:text-4xl">{title}</h1>
            {subtitle && (
              <p className="text-ink-muted mt-2">{subtitle}</p>
            )}
          </div>

          {actions && (
            <div className="flex items-center gap-3">
              {actions}
            </div>
          )}
        </div>

        <div className="mt-4 h-0.5 bg-ink" />
      </div>
    </div>
  );
}
```

### spa/src/components/layout/index.ts

```typescript
export { default as Layout } from './Layout';
export { default as Header } from './Header';
export { default as PageHeader } from './PageHeader';
```

### App.tsx에서 사용

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout';

function App() {
  return (
    <BrowserRouter basename="/ai-company-analyzer">
      <ExtensionProvider>
        <QueryClientProvider client={queryClient}>
          <Layout>
            <Routes>
              <Route path="/" element={<CompanyList />} />
              <Route path="/company/:companyId" element={<CompanyDetail />} />
              <Route path="/analysis/:companyId" element={<Analysis />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </QueryClientProvider>
      </ExtensionProvider>
    </BrowserRouter>
  );
}
```

## 완료 기준

- [ ] Header 컴포넌트: 로고, 상태 인디케이터, 설정 버튼
- [ ] Layout 컴포넌트: Header + main 영역
- [ ] PageHeader 컴포넌트: 페이지 제목, 뒤로가기, 액션 버튼
- [ ] 반응형 레이아웃 (모바일 대응)
- [ ] 설정 페이지 활성 상태 스타일

## 참조 문서

- spec/06-page-layouts.md Section 1 (공통 레이아웃)
- spec/05-design-system.md Section 5 (레이아웃 그리드)
