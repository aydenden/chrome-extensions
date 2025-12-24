import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOllama } from '@/contexts/OllamaContext';
import { ROUTES } from '@/lib/routes';
import Button from '@/components/ui/Button';

const OLLAMA_URL = 'https://ollama.com';
const OLLAMA_PULL_CMD = 'ollama pull qwen2-vl:4b';
const OLLAMA_LIST_CMD = 'ollama list';
const OLLAMA_ORIGINS_CMD = "launchctl setenv OLLAMA_ORIGINS 'chrome-extension://opndpciajcchajfpcafiglahllclcgam'";
const OLLAMA_RESTART_CMD = 'pkill ollama && ollama serve';

interface InstallStep {
  number: number;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  code?: string;
}

export default function OllamaRequired() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { isConnected, isChecking, error, checkConnection, endpoint } = useOllama();

  const [copiedPull, setCopiedPull] = useState(false);
  const [copiedList, setCopiedList] = useState(false);
  const [copiedOrigins, setCopiedOrigins] = useState(false);
  const [copiedRestart, setCopiedRestart] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 5초 자동 체크
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      checkConnection();
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkConnection]);

  // 연결 성공 시 분석 페이지로 이동
  useEffect(() => {
    if (isConnected && companyId) {
      navigate(ROUTES.ANALYSIS(companyId));
    }
  }, [isConnected, companyId, navigate]);

  const handleOpenOllama = () => {
    window.open(OLLAMA_URL, '_blank', 'noopener,noreferrer');
  };

  const handleCopyPull = async () => {
    await navigator.clipboard.writeText(OLLAMA_PULL_CMD);
    setCopiedPull(true);
    setTimeout(() => setCopiedPull(false), 2000);
  };

  const handleCopyList = async () => {
    await navigator.clipboard.writeText(OLLAMA_LIST_CMD);
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 2000);
  };

  const handleCopyOrigins = async () => {
    await navigator.clipboard.writeText(OLLAMA_ORIGINS_CMD);
    setCopiedOrigins(true);
    setTimeout(() => setCopiedOrigins(false), 2000);
  };

  const handleCopyRestart = async () => {
    await navigator.clipboard.writeText(OLLAMA_RESTART_CMD);
    setCopiedRestart(true);
    setTimeout(() => setCopiedRestart(false), 2000);
  };

  const handleRetry = () => {
    checkConnection();
  };

  const steps: InstallStep[] = [
    {
      number: 1,
      title: 'Ollama 설치',
      description: '로컬에서 AI 모델을 실행하려면 Ollama를 먼저 설치해주세요.',
      action: {
        label: '다운로드 페이지 열기',
        onClick: handleOpenOllama,
        variant: 'primary',
      },
    },
    {
      number: 2,
      title: 'Vision 모델 다운로드',
      description: '터미널에서 아래 명령어를 실행하여 Vision 모델을 다운로드하세요.',
      code: OLLAMA_PULL_CMD,
      action: {
        label: copiedPull ? '복사됨!' : '복사',
        onClick: handleCopyPull,
        variant: 'secondary',
      },
    },
    {
      number: 3,
      title: '설치 확인',
      description: '모델이 정상적으로 설치되었는지 확인하세요.',
      code: OLLAMA_LIST_CMD,
      action: {
        label: copiedList ? '복사됨!' : '복사',
        onClick: handleCopyList,
        variant: 'secondary',
      },
    },
    {
      number: 4,
      title: 'Extension 연결 설정 (macOS)',
      description: 'Extension이 Ollama에 접근할 수 있도록 환경변수를 설정하세요.',
      code: OLLAMA_ORIGINS_CMD,
      action: {
        label: copiedOrigins ? '복사됨!' : '복사',
        onClick: handleCopyOrigins,
        variant: 'secondary',
      },
    },
    {
      number: 5,
      title: 'Ollama 재시작',
      description: '환경변수 적용을 위해 Ollama를 재시작하세요.',
      code: OLLAMA_RESTART_CMD,
      action: {
        label: copiedRestart ? '복사됨!' : '복사',
        onClick: handleCopyRestart,
        variant: 'secondary',
      },
    },
  ];

  return (
    <div className="min-h-screen bg-paper">
      {/* Decorative Header Bar */}
      <div className="h-2 bg-ink" />

      <div className="editorial-grid py-12 md:py-16">
        {/* Header Section */}
        <header className="col-span-12 mb-12 md:mb-16">
          <p className="label text-ink-muted mb-4">OLLAMA SETUP</p>
          <h1 className="headline text-[clamp(2.5rem,5vw,4rem)] text-ink mb-4">
            Ollama 설정이
            <br />
            필요합니다
          </h1>
          <p className="subhead text-[clamp(1.1rem,2vw,1.5rem)] text-ink-soft max-w-xl">
            AI 분석을 수행하려면 Ollama와 Vision 모델이 필요합니다.
            아래 단계를 따라 설정해주세요.
          </p>
        </header>

        {/* Steps Section */}
        <main className="col-span-12 lg:col-span-8">
          <div className="space-y-0">
            {steps.map((step, index) => (
              <article
                key={step.number}
                className={`
                  relative py-8
                  ${index !== steps.length - 1 ? 'border-b border-border-subtle' : ''}
                `}
              >
                {/* Step Number */}
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <span className="data-figure text-[clamp(2rem,4vw,3rem)] text-ink-muted leading-none">
                      {String(step.number).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 pt-1">
                    <h2 className="headline text-xl md:text-2xl text-ink mb-2">
                      {step.title}
                    </h2>
                    <p className="text-ink-soft mb-4 max-w-lg">
                      {step.description}
                    </p>

                    {/* Code Block */}
                    {step.code && (
                      <div className="inline-flex items-center gap-3 bg-surface-sunken px-4 py-2 mb-4 font-mono text-sm text-ink border-l-2 border-ink">
                        <code>{step.code}</code>
                      </div>
                    )}

                    {/* Action Button */}
                    {step.action && (
                      <div>
                        <Button
                          variant={step.action.variant}
                          size="md"
                          onClick={step.action.onClick}
                        >
                          {step.action.label}
                          {step.action.variant === 'primary' && (
                            <svg
                              className="ml-2 w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>

        {/* Sidebar - Connection Status */}
        <aside className="col-span-12 lg:col-span-4 lg:pl-8">
          <div className="lg:sticky lg:top-8">
            <div className="bg-surface-elevated border-2 border-ink p-6">
              <p className="label text-ink-muted mb-4">OLLAMA STATUS</p>

              <div className="flex items-center gap-3 mb-6">
                <div
                  className={`
                    w-3 h-3 rounded-full
                    ${isChecking ? 'bg-highlight-yellow animate-pulse' : isConnected ? 'bg-signal-positive' : 'bg-signal-negative'}
                  `}
                />
                <span className="font-semibold text-ink">
                  {isChecking ? '연결 확인 중...' : isConnected ? '연결됨' : '연결 안됨'}
                </span>
              </div>

              {error && (
                <div className="bg-highlight-coral/30 border-l-2 border-signal-negative p-3 mb-6">
                  <p className="text-sm text-ink-soft">
                    <span className="font-semibold text-signal-negative">오류:</span>{' '}
                    {error}
                  </p>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleRetry}
                disabled={isChecking}
                loading={isChecking}
              >
                {isChecking ? '확인 중...' : '연결 확인'}
              </Button>

              <p className="text-xs text-ink-muted mt-4 text-center">
                5초마다 자동으로 연결을 확인합니다
              </p>
            </div>

            {/* Help Box */}
            <div className="mt-6 p-4 bg-highlight-mint/20 border-l-2 border-signal-positive">
              <p className="text-sm text-ink-soft">
                <span className="font-semibold text-ink">Ollama 실행 확인</span>
                <br />
                Ollama 설치 후 터미널에서{' '}
                <code className="font-mono bg-surface-sunken px-1">ollama serve</code>
                를 실행하거나 앱을 실행해주세요.
              </p>
            </div>

            {/* Settings Link Box */}
            <div className="mt-6 p-4 bg-surface-sunken border-l-2 border-ink-muted">
              <p className="text-sm text-ink-soft mb-2">
                <span className="font-semibold text-ink">엔드포인트 변경</span>
                <br />
                현재: <code className="font-mono bg-surface-elevated px-1">{endpoint}</code>
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(ROUTES.SETTINGS)}
              >
                설정으로 이동
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8">
        <div className="editorial-grid">
          <div className="col-span-12 text-center">
            <p className="text-sm text-ink-muted">
              AI Company Analyzer — 기업 정보 수집 및 AI 분석
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
