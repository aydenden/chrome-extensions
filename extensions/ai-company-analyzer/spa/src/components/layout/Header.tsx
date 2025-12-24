import { Link, useLocation } from 'react-router-dom';
import { useOllama } from '@/contexts/OllamaContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { cn } from '@/lib/utils';

type StatusType = 'ready' | 'loading' | 'error' | 'idle';

interface StatusIndicatorProps {
  label: string;
  status: StatusType;
}

const statusStyles: Record<StatusType, string> = {
  ready: 'bg-signal-positive',
  loading: 'bg-highlight-yellow animate-pulse',
  error: 'bg-signal-negative',
  idle: 'bg-ink-muted',
};

function StatusIndicator({ label, status }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-ink-muted hidden md:inline">{label}</span>
      <div className={cn('w-2 h-2 rounded-full', statusStyles[status])} />
    </div>
  );
}

interface HeaderProps {
  isConnected?: boolean;
}

export default function Header({ isConnected = false }: HeaderProps) {
  const location = useLocation();
  const isSettingsPage = location.pathname === '/settings';
  const { isConnected: ollamaConnected, isChecking: ollamaChecking } = useOllama();
  const { status, overallProgress } = useAnalysis();

  // 분석 진행 중인지 확인
  const isAnalyzing = status.step !== 'idle' && status.step !== 'done' && status.step !== 'error';

  return (
    <header className="border-b-2 border-ink bg-paper sticky top-0 z-50">
      <div className="editorial-grid py-4">
        <div className="col-span-12 flex items-center justify-between">
          <Link to="/" className="headline text-lg tracking-tight">AI COMPANY ANALYZER</Link>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-4">
              <StatusIndicator label="Extension" status={isConnected ? 'ready' : 'error'} />
              <StatusIndicator
                label="Ollama"
                status={ollamaChecking ? 'loading' : ollamaConnected ? 'ready' : 'error'}
              />
              {isAnalyzing && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-highlight-yellow/20 rounded">
                  <div className="w-2 h-2 rounded-full bg-highlight-yellow animate-pulse" />
                  <span className="text-xs font-semibold">
                    분석 중 {overallProgress > 0 ? `${Math.round(overallProgress)}%` : ''}
                  </span>
                </div>
              )}
            </div>
            <Link
              to="/settings"
              className={`w-8 h-8 flex items-center justify-center rounded-sm ${
                isSettingsPage ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/10'
              } transition-colors`}
              aria-label="설정"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
