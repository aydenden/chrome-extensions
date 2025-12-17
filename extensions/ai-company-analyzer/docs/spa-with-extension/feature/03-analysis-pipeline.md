# 분석 파이프라인 기능 명세

## 1. 개요

SPA에서 Qwen3-0.6B LLM을 사용한 텍스트 분류 및 분석 파이프라인 명세.

## 2. 아키텍처

```
[OCR 텍스트]
    │
    ▼
[전처리]
    │ - 길이 제한
    │ - 특수문자 정리
    ▼
[분류 (Classification)]
    │ - Qwen3-0.6B
    │ - 카테고리 결정
    ▼
[분석 (Analysis)]
    │ - Qwen3-0.6B
    │ - 핵심 정보 요약
    ▼
[후처리]
    │ - <think> 태그 제거
    │ - 결과 정규화
    ▼
[결과 반환]
```

## 3. Qwen3 엔진

### 3.1 초기화

```typescript
// spa/src/ai/qwen3-engine.ts
import { pipeline, type TextGenerationPipeline } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/Qwen3-0.6B-ONNX';

let generator: TextGenerationPipeline | null = null;
let initPromise: Promise<void> | null = null;
let loadProgress = 0;

export interface InitOptions {
  onProgress?: (progress: number) => void;
}

export async function initQwen3(options?: InitOptions): Promise<void> {
  if (generator) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('Qwen3 초기화 시작...');

    generator = await pipeline('text-generation', MODEL_ID, {
      dtype: 'q4f16',
      device: 'webgpu',
      progress_callback: (p: any) => {
        if (p.progress !== undefined) {
          loadProgress = p.progress;
          options?.onProgress?.(p.progress);
        }
        console.log(`[Qwen3] ${p.status || 'Loading...'}`, p.progress ?? '');
      },
    }) as TextGenerationPipeline;

    console.log('Qwen3 초기화 완료');
    loadProgress = 1;
  })();

  return initPromise;
}

export function isQwen3Ready(): boolean {
  return generator !== null;
}

export function getQwen3Progress(): number {
  return loadProgress;
}
```

### 3.2 텍스트 생성

```typescript
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 256
): Promise<string> {
  if (!generator) {
    throw new Error('Qwen3가 초기화되지 않았습니다');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const output = await generator(messages, {
    max_new_tokens: maxTokens,
    do_sample: false,
    temperature: 0.1, // 낮은 온도로 일관성 확보
  });

  const content = (output as any)[0].generated_text.at(-1).content;
  return removeThinkingTags(content);
}

// Qwen3 thinking mode 태그 제거
function removeThinkingTags(text: string): string {
  // 완전한 <think>...</think> 태그 제거
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  // 불완전한 <think> 태그 제거
  cleaned = cleaned.replace(/<think>[\s\S]*/g, '').trim();
  return cleaned;
}
```

## 4. 프롬프트

### 4.1 분류 프롬프트

```typescript
// spa/src/ai/prompts.ts
export const CLASSIFY_SYSTEM = `You are a document classifier for Korean company data.
Classify the text into exactly one category.
Reply with ONLY the category name, nothing else.
Do not explain your reasoning.`;

export const CATEGORIES = [
  'revenue_trend',      // 매출 추이
  'balance_sheet',      // 재무상태표
  'income_statement',   // 손익계산서
  'employee_trend',     // 직원수 추이
  'review_positive',    // 긍정 리뷰
  'review_negative',    // 부정 리뷰
  'company_overview',   // 회사 개요
  'unknown',            // 분류 불가
] as const;

export type Category = (typeof CATEGORIES)[number];

export function buildClassifyPrompt(text: string): string {
  // 텍스트 길이 제한 (분류용)
  const truncated = text.length > 1500 ? text.slice(0, 1500) + '...' : text;

  return `Text:
${truncated}

Categories: ${CATEGORIES.join(', ')}

Category:`;
}
```

### 4.2 분석 프롬프트

```typescript
export const ANALYZE_SYSTEM = `You are a financial analyst.
Summarize the key information in Korean.
Be concise and focus on important numbers and facts.
Maximum 3-4 sentences.`;

export function buildAnalyzePrompt(text: string, category: Category): string {
  // 텍스트 길이 제한 (분석용)
  const truncated = text.length > 2500 ? text.slice(0, 2500) + '...' : text;

  const categoryHints: Record<Category, string> = {
    revenue_trend: '매출 금액, 증감률, 기간에 집중',
    balance_sheet: '자산, 부채, 자본 항목에 집중',
    income_statement: '수익, 비용, 이익에 집중',
    employee_trend: '직원수, 증감, 기간에 집중',
    review_positive: '긍정적인 포인트 요약',
    review_negative: '부정적인 포인트 요약',
    company_overview: '회사 기본 정보 요약',
    unknown: '주요 정보 요약',
  };

  return `Category: ${category}
Hint: ${categoryHints[category]}

Text:
${truncated}

요약:`;
}
```

## 5. 분석 파이프라인

### 5.1 단일 이미지 분석

```typescript
// spa/src/hooks/useAnalysis.ts
import { generateText } from '@/ai/qwen3-engine';
import {
  CLASSIFY_SYSTEM,
  ANALYZE_SYSTEM,
  buildClassifyPrompt,
  buildAnalyzePrompt,
  CATEGORIES,
  type Category,
} from '@/ai/prompts';

interface AnalysisResult {
  category: Category;
  analysis: string;
}

export async function analyzeText(rawText: string): Promise<AnalysisResult> {
  // 1. 분류
  const classifyPrompt = buildClassifyPrompt(rawText);
  const classifyResponse = await generateText(CLASSIFY_SYSTEM, classifyPrompt, 32);
  const category = parseCategory(classifyResponse);

  // 2. 분석
  const analyzePrompt = buildAnalyzePrompt(rawText, category);
  const analysis = await generateText(ANALYZE_SYSTEM, analyzePrompt, 256);

  return { category, analysis };
}

function parseCategory(response: string): Category {
  const cleaned = response.toLowerCase().trim();

  // 정확히 일치
  const exact = CATEGORIES.find((c) => cleaned === c);
  if (exact) return exact;

  // 포함 여부
  const partial = CATEGORIES.find((c) => cleaned.includes(c));
  if (partial) return partial;

  console.warn('[Analysis] 분류 실패:', response);
  return 'unknown';
}
```

### 5.2 React Hook

```typescript
// spa/src/hooks/useAnalysis.ts
import { useCallback, useState } from 'react';
import { isQwen3Ready } from '@/ai/qwen3-engine';

interface UseAnalysisOptions {
  onProgress?: (current: number, total: number) => void;
}

export function useAnalysis(options?: UseAnalysisOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (rawText: string): Promise<AnalysisResult> => {
      if (!isQwen3Ready()) {
        throw new Error('분석 엔진이 준비되지 않았습니다');
      }

      setIsProcessing(true);
      setError(null);

      try {
        return await analyzeText(rawText);
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const analyzeBatch = useCallback(
    async (
      texts: Array<{ id: string; rawText: string }>
    ): Promise<Array<{ id: string; result: AnalysisResult }>> => {
      setIsProcessing(true);
      const results = [];

      for (let i = 0; i < texts.length; i++) {
        const { id, rawText } = texts[i];
        options?.onProgress?.(i + 1, texts.length);

        try {
          const result = await analyzeText(rawText);
          results.push({ id, result });
        } catch (err) {
          results.push({
            id,
            result: { category: 'unknown' as Category, analysis: '' },
          });
        }
      }

      setIsProcessing(false);
      return results;
    },
    [options?.onProgress]
  );

  return {
    analyze,
    analyzeBatch,
    isProcessing,
    error,
    isReady: isQwen3Ready(),
  };
}
```

## 6. LLM Context

### 6.1 Provider

```typescript
// spa/src/contexts/LLMContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { initQwen3, isQwen3Ready, getQwen3Progress } from '@/ai/qwen3-engine';

interface LLMContextValue {
  isReady: boolean;
  isInitializing: boolean;
  progress: number;
  error: string | null;
}

const LLMContext = createContext<LLMContextValue | null>(null);

export function LLMProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsInitializing(true);

    initQwen3({
      onProgress: setProgress,
    })
      .then(() => {
        setIsReady(true);
        setIsInitializing(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsInitializing(false);
      });
  }, []);

  return (
    <LLMContext.Provider
      value={{ isReady, isInitializing, progress, error }}
    >
      {children}
    </LLMContext.Provider>
  );
}

export function useLLM() {
  const context = useContext(LLMContext);
  if (!context) {
    throw new Error('useLLM must be used within LLMProvider');
  }
  return context;
}
```

## 7. 전체 분석 흐름

### 7.1 Analysis 페이지

```typescript
// spa/src/pages/Analysis.tsx
export function Analysis() {
  const { companyId } = useParams<{ companyId: string }>();
  const { data: images } = useImages(companyId!);
  const { recognize, isReady: ocrReady } = useOCR();
  const { analyze, isReady: llmReady } = useAnalysis();
  const saveAnalysis = useSaveAnalysis();

  const [status, setStatus] = useState<'idle' | 'ocr' | 'analysis' | 'saving' | 'done'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });

  const pendingImages = useMemo(
    () => images?.filter((img) => !img.hasAnalysis) || [],
    [images]
  );

  const runAnalysis = async () => {
    if (!pendingImages.length) return;

    setProgress({ current: 0, total: pendingImages.length, phase: 'OCR' });
    setStatus('ocr');

    for (let i = 0; i < pendingImages.length; i++) {
      const img = pendingImages[i];

      // 1. 이미지 로드
      const imageData = await api.getImageData(img.id);
      const blob = base64ToBlob(imageData.base64, imageData.mimeType);

      // 2. OCR
      setProgress((p) => ({ ...p, current: i + 1, phase: 'OCR' }));
      setStatus('ocr');
      const rawText = await recognize(blob);

      // 3. 분석
      setStatus('analysis');
      setProgress((p) => ({ ...p, phase: '분석' }));
      const { category, analysis } = await analyze(rawText);

      // 4. 저장
      setStatus('saving');
      setProgress((p) => ({ ...p, phase: '저장' }));
      await saveAnalysis.mutateAsync({
        imageId: img.id,
        companyId: companyId!,
        category,
        rawText,
        analysis,
      });
    }

    setStatus('done');
  };

  const isReady = ocrReady && llmReady;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">이미지 분석</h1>

      {!isReady && <LoadingEngines />}

      {isReady && status === 'idle' && (
        <div className="space-y-4">
          <p>분석 대기 중인 이미지: {pendingImages.length}개</p>
          <Button onClick={runAnalysis} disabled={!pendingImages.length}>
            분석 시작
          </Button>
        </div>
      )}

      {status !== 'idle' && status !== 'done' && (
        <AnalysisProgress
          current={progress.current}
          total={progress.total}
          phase={progress.phase}
        />
      )}

      {status === 'done' && (
        <div className="text-green-600">
          ✅ 분석 완료! {progress.total}개 이미지 처리됨
        </div>
      )}
    </div>
  );
}
```

## 8. 에러 처리

### 8.1 LLM 에러

| 에러 | 원인 | 처리 |
|------|------|------|
| WebGPU 미지원 | 구형 브라우저 | 사용자 알림 |
| 모델 로드 실패 | 네트워크/메모리 | 재시도 |
| 생성 실패 | 입력 문제 | 기본값 반환 |
| 타임아웃 | 긴 입력 | 텍스트 잘라서 재시도 |

### 8.2 재시도 로직

```typescript
async function analyzeWithRetry(
  rawText: string,
  maxRetries = 3
): Promise<AnalysisResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 재시도 시 텍스트 더 줄임
      const maxLength = 2500 - attempt * 500;
      const truncated = rawText.slice(0, maxLength);

      return await analyzeText(truncated);
    } catch (error) {
      lastError = error as Error;
      console.warn(`분석 시도 ${attempt + 1}/${maxRetries} 실패:`, error);
    }
  }

  // 최종 실패 시 기본값
  return {
    category: 'unknown',
    analysis: '분석에 실패했습니다.',
  };
}
```

## 9. 성능 최적화

### 9.1 텍스트 길이 제한

```typescript
const MAX_CLASSIFY_LENGTH = 1500;  // 분류용
const MAX_ANALYZE_LENGTH = 2500;   // 분석용

// 긴 텍스트는 앞부분만 사용
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...(생략)';
}
```

### 9.2 배치 처리 최적화

```typescript
// OCR은 병렬, LLM은 순차 (GPU 사용)
async function processImages(images: ImageMetaDTO[]): Promise<void> {
  // OCR 병렬 처리 (Worker Pool)
  const ocrResults = await ocrBatch.processBatch(images);

  // LLM 순차 처리 (GPU 점유)
  for (const { imageId, text } of ocrResults) {
    await analyzeAndSave(imageId, text);
  }
}
```

## 10. 테스트 체크리스트

- [ ] Qwen3 모델 로드 (WebGPU)
- [ ] 한국어 텍스트 분류
- [ ] 영어 텍스트 분류
- [ ] 분석 요약 생성
- [ ] `<think>` 태그 제거
- [ ] 긴 텍스트 처리
- [ ] 에러 복구
- [ ] 배치 처리
