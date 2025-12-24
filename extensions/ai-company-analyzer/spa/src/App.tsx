import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query/client';
import { ExtensionProvider, useExtension } from '@/contexts/ExtensionContext';
import { OllamaProvider } from '@/contexts/OllamaContext';
import { AnalysisProvider } from '@/contexts/AnalysisContext';
import { ToastProvider } from '@/components/ui';
import { Layout } from '@/components/layout';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { ExtensionErrorBoundary } from '@/components/errors/ExtensionErrorBoundary';
import { EXTENSION_ID } from '@shared/constants';

import CompanyList from '@/pages/CompanyList';
import CompanyDetail from '@/pages/CompanyDetail';
import Analysis from '@/pages/Analysis';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';
import ExtensionRequired from '@/pages/ExtensionRequired';
import OllamaRequired from '@/pages/OllamaRequired';
import LoadingPage from '@/pages/LoadingPage';

function AppRoutes() {
  const { isConnected, isChecking } = useExtension();

  // 최초 연결 확인 중에만 로딩 표시 (이미 연결된 상태에서 재확인 시에는 현재 화면 유지)
  if (isChecking && !isConnected) return <LoadingPage message="Extension 연결 확인 중..." />;
  if (!isConnected) return <ExtensionRequired />;

  return (
    <Layout isConnected={isConnected}>
      <Routes>
        <Route path="/" element={<CompanyList />} />
        <Route path="/company/:companyId" element={<CompanyDetail />} />
        <Route path="/analysis/:companyId" element={<Analysis />} />
        <Route path="/ollama-required/:companyId" element={<OllamaRequired />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/chrome-extensions/ai-company-analyzer/">
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ExtensionProvider>
            <OllamaProvider>
              <AnalysisProvider extensionId={EXTENSION_ID}>
                <ToastProvider>
                  <ExtensionErrorBoundary fallback={<ExtensionRequired />}>
                    <AppRoutes />
                  </ExtensionErrorBoundary>
                </ToastProvider>
              </AnalysisProvider>
            </OllamaProvider>
          </ExtensionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
