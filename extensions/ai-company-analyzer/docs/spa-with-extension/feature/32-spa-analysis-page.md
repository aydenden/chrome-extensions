# Feature 32: 분석 진행 페이지

## 개요

AI 분석 진행 상황을 표시하고 제어하는 페이지입니다.

## 범위

- Analysis 페이지 컴포넌트
- 분석 진행률 표시
- 단계별 상태 (OCR → 분류 → 분석)
- 중단/재시작 기능

## 의존성

- Feature 25: Tesseract.js OCR Context
- Feature 31: AI Engine Context + 폴백

## 구현 상세

### spa/src/pages/Analysis.tsx

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '@/hooks/useCompanies';
import { useImages, useImageData } from '@/hooks/useImages';
import { useAI } from '@/contexts/AIContext';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';
import { getExtensionClient } from '@/lib/extension-client';
import { PageHeader } from '@/components/layout';
import { Button, Card, Spinner, ProgressBar } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ROUTES } from '@/lib/routes';

type AnalysisStep = 'init' | 'loading-images' | 'analyzing' | 'saving' | 'done' | 'error';

interface StepProgress {
  step: AnalysisStep;
  current: number;
  total: number;
  message: string;
}

export default function Analysis() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [stepProgress, setStepProgress] = useState<StepProgress>({
    step: 'init',
    current: 0,
    total: 0,
    message: '준비 중...',
  });
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const { data: company } = useCompany(companyId);
  const { data: images } = useImages(companyId);
  const { initialize, status: aiStatus, engineName } = useAI();
  const { analyzeBatch, progress: analysisProgress } = useAIAnalysis(company?.name || '');

  // AI 엔진 초기화
  useEffect(() => {
    if (aiStatus.type === 'idle') {
      initialize();
    }
  }, [aiStatus.type, initialize]);

  const startAnalysis = useCallback(async () => {
    if (!images || images.length === 0) {
      showToast('분석할 이미지가 없습니다.', 'error');
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setIsRunning(true);
    setResults([]);

    try {
      // Step 1: 이미지 데이터 로드
      setStepProgress({
        step: 'loading-images',
        current: 0,
        total: images.length,
        message: '이미지 로딩 중...',
      });

      const client = getExtensionClient();
      const imageDataList: Array<{ id: string; dataUrl: string }> = [];

      for (let i = 0; i < images.length; i++) {
        if (controller.signal.aborted) throw new Error('중단됨');

        setStepProgress({
          step: 'loading-images',
          current: i + 1,
          total: images.length,
          message: `이미지 로딩 중... (${i + 1}/${images.length})`,
        });

        const data = await client.send('GET_IMAGE_DATA', { imageId: images[i].id });
        imageDataList.push({ id: images[i].id, dataUrl: data.dataUrl });
      }

      // Step 2: AI 분석
      setStepProgress({
        step: 'analyzing',
        current: 0,
        total: images.length,
        message: 'AI 분석 시작...',
      });

      const analysisResults = await analyzeBatch(imageDataList);
      setResults(analysisResults);

      // Step 3: 결과 저장
      setStepProgress({
        step: 'saving',
        current: 0,
        total: analysisResults.length,
        message: '분석 결과 저장 중...',
      });

      await client.send('BATCH_SAVE_ANALYSIS', {
        companyId: companyId!,
        analyses: analysisResults.map(r => ({
          imageId: r.imageId,
          ocrText: r.ocrText,
          category: r.classification.category,
          subCategory: r.classification.subCategory,
          confidence: r.classification.confidence,
          analysis: r.analysis,
        })),
      });

      setStepProgress({
        step: 'done',
        current: analysisResults.length,
        total: analysisResults.length,
        message: '분석 완료!',
      });

      showToast(`${analysisResults.length}개 이미지 분석 완료`, 'success');
    } catch (error) {
      if ((error as Error).message === '중단됨') {
        setStepProgress({
          step: 'init',
          current: 0,
          total: 0,
          message: '분석이 중단되었습니다.',
        });
      } else {
        setStepProgress({
          step: 'error',
          current: 0,
          total: 0,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        showToast('분석 실패', 'error');
      }
    } finally {
      setIsRunning(false);
      setAbortController(null);
    }
  }, [images, companyId, analyzeBatch, showToast]);

  const stopAnalysis = useCallback(() => {
    abortController?.abort();
  }, [abortController]);

  const overallProgress = stepProgress.total > 0
    ? Math.round((stepProgress.current / stepProgress.total) * 100)
    : 0;

  return (
    <>
      <PageHeader
        title="AI 분석"
        subtitle={company?.name}
        backTo={companyId ? ROUTES.COMPANY_DETAIL(companyId) : ROUTES.HOME}
      />

      <div className="editorial-grid">
        <div className="col-span-12 lg:col-span-8">
          {/* AI 엔진 상태 */}
          <Card className="p-6 mb-6">
            <h3 className="headline text-lg mb-4">AI 엔진</h3>
            <div className="flex items-center gap-4">
              <span className={`w-3 h-3 rounded-full ${
                aiStatus.type === 'ready' ? 'bg-signal-positive' :
                aiStatus.type === 'loading' ? 'bg-highlight-yellow animate-pulse' :
                aiStatus.type === 'error' ? 'bg-signal-negative' :
                'bg-ink-muted'
              }`} />
              <span className="font-medium">{engineName || '초기화 중...'}</span>
              {aiStatus.type === 'loading' && (
                <span className="text-ink-muted text-sm">{aiStatus.message}</span>
              )}
            </div>
          </Card>

          {/* 분석 상태 */}
          <Card className="p-6 mb-6">
            <h3 className="headline text-lg mb-4">분석 진행</h3>

            {/* 진행률 */}
            <div className="mb-6">
              <ProgressBar value={overallProgress} />
            </div>

            {/* 단계 표시 */}
            <div className="space-y-3 mb-6">
              <StepIndicator
                label="이미지 로딩"
                status={getStepStatus('loading-images', stepProgress.step)}
              />
              <StepIndicator
                label="OCR + AI 분석"
                status={getStepStatus('analyzing', stepProgress.step)}
              />
              <StepIndicator
                label="결과 저장"
                status={getStepStatus('saving', stepProgress.step)}
              />
            </div>

            {/* 상태 메시지 */}
            <p className="text-ink-muted">{stepProgress.message}</p>

            {/* 컨트롤 버튼 */}
            <div className="mt-6 flex gap-4">
              {!isRunning && stepProgress.step !== 'done' && (
                <Button
                  onClick={startAnalysis}
                  disabled={aiStatus.type !== 'ready' || !images?.length}
                >
                  분석 시작
                </Button>
              )}
              {isRunning && (
                <Button variant="danger" onClick={stopAnalysis}>
                  중단
                </Button>
              )}
              {stepProgress.step === 'done' && (
                <Button
                  onClick={() => navigate(ROUTES.COMPANY_DETAIL(companyId!))}
                >
                  결과 보기
                </Button>
              )}
            </div>
          </Card>

          {/* 분석 결과 미리보기 */}
          {results.length > 0 && (
            <Card className="p-6">
              <h3 className="headline text-lg mb-4">분석 결과 ({results.length}개)</h3>
              <div className="space-y-4 max-h-96 overflow-auto">
                {results.map((result, i) => (
                  <div key={result.imageId} className="border-b border-border-subtle pb-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">이미지 {i + 1}</span>
                      <span className="text-xs px-2 py-1 bg-surface-sunken">
                        {result.classification.subCategory}
                      </span>
                    </div>
                    <p className="text-sm text-ink-muted line-clamp-2">
                      {result.analysis.summary}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* 사이드바: 이미지 목록 */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="p-6 sticky top-24">
            <h3 className="headline text-lg mb-4">분석 대상</h3>
            {images ? (
              <>
                <p className="text-ink-muted mb-4">
                  총 <span className="data-figure">{images.length}</span>개 이미지
                </p>
                <div className="max-h-64 overflow-auto space-y-2">
                  {images.map((img, i) => (
                    <div
                      key={img.id}
                      className={`text-sm px-3 py-2 ${
                        results.some(r => r.imageId === img.id)
                          ? 'bg-signal-positive/10 text-signal-positive'
                          : 'bg-surface-sunken'
                      }`}
                    >
                      이미지 {i + 1}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Spinner size="sm" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

// 단계 상태 계산
function getStepStatus(
  targetStep: AnalysisStep,
  currentStep: AnalysisStep
): 'pending' | 'active' | 'done' {
  const order: AnalysisStep[] = ['init', 'loading-images', 'analyzing', 'saving', 'done'];
  const targetIndex = order.indexOf(targetStep);
  const currentIndex = order.indexOf(currentStep);

  if (currentIndex > targetIndex) return 'done';
  if (currentIndex === targetIndex) return 'active';
  return 'pending';
}

// 단계 인디케이터
function StepIndicator({ label, status }: { label: string; status: 'pending' | 'active' | 'done' }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-6 h-6 flex items-center justify-center text-sm ${
        status === 'done' ? 'bg-signal-positive text-white' :
        status === 'active' ? 'bg-ink text-paper animate-pulse' :
        'bg-surface-sunken text-ink-muted'
      }`}>
        {status === 'done' ? '✓' : status === 'active' ? '...' : '○'}
      </span>
      <span className={status === 'pending' ? 'text-ink-muted' : 'text-ink'}>
        {label}
      </span>
    </div>
  );
}
```

## 완료 기준

- [ ] Analysis 페이지 레이아웃
- [ ] AI 엔진 상태 표시
- [ ] 단계별 진행률 (이미지 로딩 → OCR/분석 → 저장)
- [ ] ProgressBar 전체 진행률
- [ ] 분석 시작/중단 버튼
- [ ] 분석 결과 미리보기
- [ ] 분석 대상 이미지 목록

## 참조 문서

- spec/06-page-layouts.md Section 4 (분석 페이지)
