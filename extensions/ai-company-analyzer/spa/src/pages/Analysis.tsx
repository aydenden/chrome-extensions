import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import Spinner from '@/components/ui/Spinner';
import { useOllama } from '@/contexts/OllamaContext';
import { useImages } from '@/hooks/useImages';
import { useCompany } from '@/hooks/useCompanies';
import { getExtensionClient } from '@/lib/extension-client';
import { CATEGORY_LABELS } from '@shared/constants/categories';
import type { ImageSubCategory } from '@shared/constants/categories';
import { optimizeImageForVLM } from '@/lib/image';

type AnalysisStep = 'init' | 'loading-images' | 'analyzing' | 'saving' | 'done' | 'error';

interface StepProgress {
  step: AnalysisStep;
  current: number;
  total: number;
  message: string;
}

interface AnalysisResultItem {
  imageId: string;
  category: ImageSubCategory;
  rawText: string;
  analysis: string;
}

export default function Analysis() {
  const { companyId } = useParams<{ companyId: string }>();
  const client = getExtensionClient();

  // Hooks
  const { analyzeImage, isConnected: ollamaConnected, selectedModel, endpoint } = useOllama();
  const { data: company } = useCompany(companyId);
  const { data: images } = useImages(companyId);

  // 세션 종료 시 모델 언로드 (VRAM 해제)
  useEffect(() => {
    const handleUnload = () => {
      if (!selectedModel) return;
      // Beacon API로 비동기 요청 (탭 닫힘에도 전송 보장)
      navigator.sendBeacon(
        `${endpoint}/api/chat`,
        JSON.stringify({ model: selectedModel, messages: [], keep_alive: 0 })
      );
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [endpoint, selectedModel]);

  // State
  const [stepProgress, setStepProgress] = useState<StepProgress>({
    step: 'init',
    current: 0,
    total: 0,
    message: '분석 대기 중...',
  });
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<AnalysisResultItem[]>([]);
  const [completedImageIds, setCompletedImageIds] = useState<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  // JSON Schema for structured output (모델 무관 일관된 출력 보장)
  const ANALYSIS_SCHEMA = {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['revenue_trend', 'balance_sheet', 'income_statement',
               'employee_trend', 'review_positive', 'review_negative',
               'company_overview', 'unknown']
      },
      summary: { type: 'string' },
      keyPoints: { type: 'array', items: { type: 'string' } },
      sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
      extractedText: { type: 'string' }
    },
    required: ['category', 'summary', 'keyPoints', 'sentiment', 'extractedText']
  };

  // 통합 프롬프트 (분류 + 분석을 1단계로)
  const UNIFIED_ANALYSIS_PROMPT = `{{COMPANY_NAME}} 회사 스크린샷을 분석하세요.

카테고리:
- revenue_trend: 매출/수익 추이 그래프
- balance_sheet: 재무상태표
- income_statement: 손익계산서
- employee_trend: 직원수/입퇴사 추이
- review_positive: 긍정적 리뷰
- review_negative: 부정적 리뷰
- company_overview: 회사 개요/소개
- unknown: 분류 불가

이미지에서 텍스트와 수치를 추출하고, 적절한 카테고리를 선택하세요.`;

  // JSON 파싱 헬퍼
  const parseJSON = (text: string): any => {
    try {
      return JSON.parse(text);
    } catch {
      // JSON이 아닌 경우 기본값 반환
      return null;
    }
  };

  // 전체 진행률 계산
  const calculateOverallProgress = (): number => {
    if (stepProgress.total === 0) return 0;

    const stepWeights = {
      'init': 0,
      'loading-images': 10,
      'analyzing': 80,
      'saving': 10,
      'done': 100,
      'error': 0,
    };

    const baseProgress = stepWeights[stepProgress.step] || 0;
    if (stepProgress.step === 'analyzing' && stepProgress.total > 0) {
      return baseProgress + ((stepProgress.current / stepProgress.total) * 80);
    }
    return baseProgress;
  };

  // 분석 시작
  const startAnalysis = async () => {
    console.log('[Analysis] startAnalysis called', { ollamaConnected, selectedModel, imagesCount: images?.length });

    if (!images || images.length === 0) {
      alert('분석할 이미지가 없습니다.');
      return;
    }

    if (!ollamaConnected || !selectedModel) {
      alert('Ollama가 연결되지 않았거나 모델이 선택되지 않았습니다.');
      return;
    }

    console.log('[Analysis] setIsRunning(true)');
    setIsRunning(true);
    setResults([]);
    setCompletedImageIds(new Set());
    abortControllerRef.current = new AbortController();

    try {
      // Step 1: 이미지 데이터 로드
      setStepProgress({ step: 'loading-images', current: 0, total: images.length, message: '이미지 데이터 로드 중...' });

      const imageDataList: Array<{ id: string; base64: string }> = [];
      for (let i = 0; i < images.length; i++) {
        if (abortControllerRef.current.signal.aborted) throw new Error('중단됨');

        const imageData = await client.send('GET_IMAGE_DATA', { imageId: images[i].id });

        // VLM 최적화: 32배수 정렬 + JPEG 압축 (페이로드 50~100배 감소)
        const optimizedBase64 = await optimizeImageForVLM(imageData.base64);

        imageDataList.push({
          id: imageData.id,
          base64: optimizedBase64,
        });
        setStepProgress({ step: 'loading-images', current: i + 1, total: images.length, message: `이미지 ${i + 1}/${images.length} 최적화 중...` });
      }

      // Step 2: Ollama로 직접 분석 (OCR 없이)
      setStepProgress({ step: 'analyzing', current: 0, total: images.length, message: 'AI 분석 시작...' });

      const analysisResults: AnalysisResultItem[] = [];

      // 최적화 옵션: 낮은 temperature + 출력 토큰 제한 + structured output
      const analysisOptions = { temperature: 0.3, num_predict: 1024, format: ANALYSIS_SCHEMA };

      for (let i = 0; i < imageDataList.length; i++) {
        if (abortControllerRef.current.signal.aborted) throw new Error('중단됨');

        const { id, base64 } = imageDataList[i];

        // 통합 분석 (분류 + 분석을 1단계로, /no_think로 thinking 비활성화)
        const prompt = UNIFIED_ANALYSIS_PROMPT.replace('{{COMPANY_NAME}}', company?.name || '');
        const result = await analyzeImage(base64, prompt, analysisOptions);
        const analysis = parseJSON(result);

        // 유효한 카테고리인지 확인
        const validCategories: ImageSubCategory[] = [
          'revenue_trend', 'balance_sheet', 'income_statement',
          'employee_trend', 'review_positive', 'review_negative',
          'company_overview', 'unknown'
        ];
        const category = validCategories.includes(analysis?.category)
          ? analysis.category as ImageSubCategory
          : 'unknown';

        const resultItem: AnalysisResultItem = {
          imageId: id,
          category,
          rawText: analysis?.extractedText || '',
          analysis: JSON.stringify(analysis, null, 2),
        };

        analysisResults.push(resultItem);

        setStepProgress({
          step: 'analyzing',
          current: i + 1,
          total: images.length,
          message: `AI 분석 ${i + 1}/${images.length} (${id.substring(0, 8)}...)`,
        });

        // 실시간으로 완료된 이미지 표시
        setCompletedImageIds(prev => new Set([...prev, id]));
      }

      setResults(analysisResults);
      setCompletedImageIds(new Set(analysisResults.map(r => r.imageId)));

      // Step 3: 결과 저장
      setStepProgress({ step: 'saving', current: 0, total: 1, message: '분석 결과 저장 중...' });

      const saveResult = await client.send('BATCH_SAVE_ANALYSIS', {
        results: analysisResults,
      });

      if (saveResult.failedIds.length > 0) {
        console.warn('일부 저장 실패:', saveResult.failedIds);
      }

      setStepProgress({ step: 'done', current: analysisResults.length, total: analysisResults.length, message: `분석 완료! (${saveResult.savedCount}개 저장)` });
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      setStepProgress({ step: 'error', current: 0, total: 0, message });
      console.error('분석 실패:', error);
    } finally {
      console.log('[Analysis] finally block - setIsRunning(false)');
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  // 분석 중단
  const stopAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsRunning(false);
      setStepProgress({ step: 'error', current: 0, total: 0, message: '사용자가 중단함' });
    }
  };

  const overallProgress = calculateOverallProgress();

  // 디버깅: 렌더 시 상태 확인
  console.log('[Analysis] render', {
    ollamaConnected,
    selectedModel,
    isRunning,
    resultsCount: results.length,
    completedCount: completedImageIds.size,
    imagesCount: images?.length,
  });

  return (
    <>
      <PageHeader title="AI 분석" subtitle={company?.name || `ID: ${companyId}`} backTo={`/company/${companyId}`} />

      <div className="editorial-grid gap-6">
        {/* Ollama 상태 카드 */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="p-6">
            <h2 className="headline text-xl mb-4">Ollama</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-ink-muted mb-1">연결 상태</div>
                <div className="flex items-center gap-2">
                  {ollamaConnected && <div className="w-2 h-2 rounded-full bg-signal-positive" />}
                  {!ollamaConnected && <div className="w-2 h-2 rounded-full bg-signal-negative" />}
                  <span className="text-sm">{ollamaConnected ? '연결됨' : '연결 안됨'}</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-ink-muted mb-1">선택된 모델</div>
                <div className="data-figure">{selectedModel || '미선택'}</div>
              </div>
              {!ollamaConnected && (
                <div className="mt-4 p-3 bg-surface-sunken text-sm text-ink-muted">
                  설정 페이지에서 Ollama를 연결하세요.
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 분석 진행 카드 */}
        <div className="col-span-12 lg:col-span-8">
          <Card className="p-6">
            <h2 className="headline text-xl mb-4">분석 진행</h2>

            {/* 전체 진행률 */}
            <div className="mb-6">
              <div className="text-sm text-ink-muted mb-2">전체 진행률</div>
              <ProgressBar value={overallProgress} />
            </div>

            {/* 단계 표시 */}
            <div className="space-y-3 mb-6">
              <StepIndicator
                label="1. 이미지 로딩"
                isActive={stepProgress.step === 'loading-images'}
                isDone={['analyzing', 'saving', 'done'].includes(stepProgress.step)}
                isError={stepProgress.step === 'error' && stepProgress.message.includes('로드')}
              />
              <StepIndicator
                label="2. AI 분석 (분류 + 분석)"
                isActive={stepProgress.step === 'analyzing'}
                isDone={['saving', 'done'].includes(stepProgress.step)}
                isError={stepProgress.step === 'error' && stepProgress.message.includes('분석')}
              />
              <StepIndicator
                label="3. 결과 저장"
                isActive={stepProgress.step === 'saving'}
                isDone={stepProgress.step === 'done'}
                isError={stepProgress.step === 'error' && stepProgress.message.includes('저장')}
              />
            </div>

            {/* 상태 메시지 */}
            <div className="bg-surface-sunken p-4 mb-4">
              <div className="flex items-center gap-2">
                {isRunning && <Spinner size="sm" />}
                <span className="text-sm text-ink-muted">{stepProgress.message}</span>
              </div>
            </div>

            {/* 시작/중단 버튼 */}
            <div className="flex gap-3">
              {!isRunning ? (
                <Button
                  onClick={startAnalysis}
                  disabled={!ollamaConnected || !selectedModel || !images || images.length === 0}
                  className="flex-1"
                >
                  분석 시작
                </Button>
              ) : (
                <Button onClick={stopAnalysis} variant="danger" className="flex-1">
                  중단
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* 분석 대상 이미지 목록 (사이드바) */}
        {images && images.length > 0 && (
          <div className="col-span-12">
            <Card className="p-6">
              <h2 className="headline text-xl mb-4">분석 대상 ({images.length}개)</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {images.map((image) => {
                  const isCompleted = completedImageIds.has(image.id);
                  return (
                    <div
                      key={image.id}
                      className={`p-3 border-2 transition-colors ${
                        isCompleted
                          ? 'border-signal-positive bg-green-50'
                          : 'border-border-subtle bg-surface-elevated'
                      }`}
                    >
                      <div className="text-xs text-ink-muted mb-1">
                        {image.category ? CATEGORY_LABELS[image.category] : '미분류'}
                      </div>
                      <div className="text-xs text-ink-muted">
                        {(image.size / 1024).toFixed(1)} KB
                      </div>
                      {isCompleted && (
                        <div className="mt-2 text-xs text-signal-positive font-semibold">완료</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* 분석 결과 미리보기 */}
        {results.length > 0 && (
          <div className="col-span-12">
            <Card className="p-6">
              <h2 className="headline text-xl mb-4">분석 결과 ({results.length}개)</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {results.map((result, idx) => (
                  <div key={result.imageId} className="p-4 bg-surface-sunken">
                    <div className="text-sm font-semibold text-ink mb-2">
                      {idx + 1}. {CATEGORY_LABELS[result.category]}
                    </div>
                    <div className="text-xs text-ink-muted mb-2">추출된 텍스트: {result.rawText.substring(0, 100)}...</div>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-ink-muted hover:text-ink">분석 내용 보기</summary>
                      <pre className="mt-2 p-2 bg-paper overflow-x-auto text-xs">{result.analysis}</pre>
                    </details>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

// 단계 표시 컴포넌트
function StepIndicator({ label, isActive, isDone, isError }: {
  label: string;
  isActive: boolean;
  isDone: boolean;
  isError: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
        isError ? 'bg-signal-negative text-white' :
        isDone ? 'bg-signal-positive text-white' :
        isActive ? 'bg-ink text-paper' :
        'bg-surface-sunken text-ink-muted'
      }`}>
        {isError ? '!' : isDone ? '✓' : isActive ? '...' : ''}
      </div>
      <span className={`text-sm ${isActive ? 'text-ink font-semibold' : 'text-ink-muted'}`}>
        {label}
      </span>
    </div>
  );
}
