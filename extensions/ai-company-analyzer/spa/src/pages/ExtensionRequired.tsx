import { useState } from 'react';
import { useExtension } from '@/contexts/ExtensionContext';
import Button from '@/components/ui/Button';

const RELEASES_URL = 'https://github.com/aydenden/chrome-extensions/releases/latest';
const CHROME_EXTENSIONS_URL = 'chrome://extensions';

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

export default function ExtensionRequired() {
  const { error, isChecking, retry } = useExtension();
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(CHROME_EXTENSIONS_URL);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleOpenReleases = () => {
    window.open(RELEASES_URL, '_blank', 'noopener,noreferrer');
  };

  const steps: InstallStep[] = [
    {
      number: 1,
      title: 'Extension 다운로드',
      description: 'GitHub Releases에서 최신 버전의 ZIP 파일을 다운로드하세요.',
      action: {
        label: '다운로드 페이지 열기',
        onClick: handleOpenReleases,
        variant: 'primary',
      },
    },
    {
      number: 2,
      title: '압축 해제',
      description: '다운로드한 ZIP 파일을 원하는 위치에 압축 해제하세요. dist 폴더가 생성됩니다.',
    },
    {
      number: 3,
      title: 'Chrome 확장프로그램 열기',
      description: 'Chrome 주소창에 아래 URL을 입력하세요.',
      code: CHROME_EXTENSIONS_URL,
      action: {
        label: copiedUrl ? '복사됨!' : 'URL 복사',
        onClick: handleCopyUrl,
        variant: 'secondary',
      },
    },
    {
      number: 4,
      title: '개발자 모드 활성화',
      description: '확장프로그램 페이지 우측 상단의 "개발자 모드" 토글을 켜세요.',
    },
    {
      number: 5,
      title: '확장프로그램 로드',
      description: '"압축해제된 확장 프로그램을 로드합니다" 버튼을 클릭하고, 압축 해제한 dist 폴더를 선택하세요.',
    },
  ];

  return (
    <div className="min-h-screen bg-paper">
      {/* Decorative Header Bar */}
      <div className="h-2 bg-ink" />

      <div className="editorial-grid py-12 md:py-16">
        {/* Header Section */}
        <header className="col-span-12 mb-12 md:mb-16">
          <p className="label text-ink-muted mb-4">INSTALLATION GUIDE</p>
          <h1 className="headline text-[clamp(2.5rem,5vw,4rem)] text-ink mb-4">
            Extension 설치가
            <br />
            필요합니다
          </h1>
          <p className="subhead text-[clamp(1.1rem,2vw,1.5rem)] text-ink-soft max-w-xl">
            AI Company Analyzer를 사용하려면 Chrome Extension을 먼저 설치해주세요.
            아래 단계를 따라 진행하면 됩니다.
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
              <p className="label text-ink-muted mb-4">CONNECTION STATUS</p>

              <div className="flex items-center gap-3 mb-6">
                <div
                  className={`
                    w-3 h-3 rounded-full
                    ${isChecking ? 'bg-highlight-yellow animate-pulse' : 'bg-signal-negative'}
                  `}
                />
                <span className="font-semibold text-ink">
                  {isChecking ? '연결 확인 중...' : '연결 안됨'}
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
                onClick={retry}
                disabled={isChecking}
                loading={isChecking}
              >
                {isChecking ? '확인 중...' : '설치 완료 확인'}
              </Button>

              <p className="text-xs text-ink-muted mt-4 text-center">
                Extension 설치 후 위 버튼을 클릭하세요
              </p>
            </div>

            {/* Help Box */}
            <div className="mt-6 p-4 bg-highlight-mint/20 border-l-2 border-signal-positive">
              <p className="text-sm text-ink-soft">
                <span className="font-semibold text-ink">도움이 필요하신가요?</span>
                <br />
                <a
                  href="https://github.com/aydenden/chrome-extensions/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-signal-neutral hover:underline"
                >
                  GitHub Issues
                </a>
                에서 문의해주세요.
              </p>
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
