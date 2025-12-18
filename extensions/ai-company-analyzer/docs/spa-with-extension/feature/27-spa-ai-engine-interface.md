# Feature 27: AI Engine Strategy 인터페이스

## 개요

AI 분석 엔진의 공통 인터페이스를 Strategy 패턴으로 정의합니다.

## 범위

- AIEngine 인터페이스 정의
- 분류/분석 메시지 타입
- 엔진 상태 타입
- 팩토리 함수

## 의존성

- Feature 03: Shared Types + Zod 스키마

## 구현 상세

### spa/src/lib/ai/types.ts

```typescript
/** AI 엔진 상태 */
export type AIEngineStatus =
  | { type: 'idle' }
  | { type: 'loading'; progress: number; message: string }
  | { type: 'ready' }
  | { type: 'processing'; progress: number; message: string }
  | { type: 'error'; error: string };

/** 분류 결과 */
export interface ClassificationResult {
  category: string;
  subCategory: string;
  confidence: number;
  reasoning?: string;
}

/** 분석 결과 */
export interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  metrics?: Array<{
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'stable';
  }>;
  sentiment?: 'positive' | 'negative' | 'neutral';
  keywords: string[];
  raw?: string;
}

/** AI 엔진 인터페이스 */
export interface AIEngine {
  /** 엔진 이름 */
  readonly name: string;

  /** 현재 상태 */
  readonly status: AIEngineStatus;

  /** 엔진 초기화 */
  initialize(): Promise<void>;

  /** 이미지 분류 */
  classify(imageData: string, ocrText?: string): Promise<ClassificationResult>;

  /** 텍스트 분석 */
  analyze(text: string, context?: AnalysisContext): Promise<AnalysisResult>;

  /** 자유 형식 질의 */
  query(prompt: string): Promise<string>;

  /** 리소스 정리 */
  dispose(): Promise<void>;
}

/** 분석 컨텍스트 */
export interface AnalysisContext {
  companyName?: string;
  category?: string;
  previousAnalysis?: string[];
}

/** 엔진 옵션 */
export interface AIEngineOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}
```

### spa/src/lib/ai/engine-factory.ts

```typescript
import type { AIEngine } from './types';
import { getSettings } from '@/lib/settings';

type EngineType = 'qwen3' | 'ollama' | 'mock';

const engineCache = new Map<EngineType, AIEngine>();

/** AI 엔진 팩토리 */
export async function createAIEngine(type?: EngineType): Promise<AIEngine> {
  const engineType = type ?? getSettings().aiEngine;

  // 캐시된 엔진 반환
  if (engineCache.has(engineType)) {
    return engineCache.get(engineType)!;
  }

  let engine: AIEngine;

  switch (engineType) {
    case 'qwen3':
      const { Qwen3Engine } = await import('./engines/qwen3');
      engine = new Qwen3Engine();
      break;

    case 'ollama':
      const { OllamaEngine } = await import('./engines/ollama');
      const settings = getSettings();
      engine = new OllamaEngine(settings.ollamaEndpoint);
      break;

    case 'mock':
    default:
      const { MockEngine } = await import('./engines/mock');
      engine = new MockEngine();
      break;
  }

  engineCache.set(engineType, engine);
  return engine;
}

/** 캐시된 엔진 정리 */
export async function disposeAllEngines(): Promise<void> {
  for (const engine of engineCache.values()) {
    await engine.dispose();
  }
  engineCache.clear();
}
```

### spa/src/lib/ai/base-engine.ts

```typescript
import type { AIEngine, AIEngineStatus, ClassificationResult, AnalysisResult, AnalysisContext } from './types';

/** AI 엔진 베이스 클래스 */
export abstract class BaseAIEngine implements AIEngine {
  abstract readonly name: string;

  protected _status: AIEngineStatus = { type: 'idle' };

  get status(): AIEngineStatus {
    return this._status;
  }

  protected setStatus(status: AIEngineStatus): void {
    this._status = status;
    this.onStatusChange?.(status);
  }

  /** 상태 변경 콜백 (옵션) */
  onStatusChange?: (status: AIEngineStatus) => void;

  abstract initialize(): Promise<void>;
  abstract classify(imageData: string, ocrText?: string): Promise<ClassificationResult>;
  abstract analyze(text: string, context?: AnalysisContext): Promise<AnalysisResult>;
  abstract query(prompt: string): Promise<string>;
  abstract dispose(): Promise<void>;

  /** 헬퍼: JSON 파싱 */
  protected parseJSON<T>(text: string): T | null {
    try {
      // JSON 블록 추출
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : text;
      return JSON.parse(jsonStr.trim());
    } catch {
      return null;
    }
  }

  /** 헬퍼: 재시도 래퍼 */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (i < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }

    throw lastError;
  }
}
```

### spa/src/lib/ai/engines/mock.ts

```typescript
import { BaseAIEngine } from '../base-engine';
import type { ClassificationResult, AnalysisResult, AnalysisContext } from '../types';

/** 테스트용 Mock 엔진 */
export class MockEngine extends BaseAIEngine {
  readonly name = 'Mock';

  async initialize(): Promise<void> {
    this.setStatus({ type: 'loading', progress: 0, message: 'Mock 엔진 로딩...' });
    await new Promise(r => setTimeout(r, 500));
    this.setStatus({ type: 'ready' });
  }

  async classify(imageData: string, ocrText?: string): Promise<ClassificationResult> {
    this.setStatus({ type: 'processing', progress: 50, message: '분류 중...' });
    await new Promise(r => setTimeout(r, 300));
    this.setStatus({ type: 'ready' });

    return {
      category: 'COMPANY_INFO',
      subCategory: 'GENERAL',
      confidence: 0.85,
      reasoning: 'Mock 분류 결과',
    };
  }

  async analyze(text: string, context?: AnalysisContext): Promise<AnalysisResult> {
    this.setStatus({ type: 'processing', progress: 50, message: '분석 중...' });
    await new Promise(r => setTimeout(r, 500));
    this.setStatus({ type: 'ready' });

    return {
      summary: `${context?.companyName ?? '회사'}에 대한 Mock 분석 결과입니다.`,
      keyPoints: ['핵심 포인트 1', '핵심 포인트 2', '핵심 포인트 3'],
      keywords: ['키워드1', '키워드2', '키워드3'],
      sentiment: 'neutral',
    };
  }

  async query(prompt: string): Promise<string> {
    this.setStatus({ type: 'processing', progress: 50, message: '응답 생성 중...' });
    await new Promise(r => setTimeout(r, 300));
    this.setStatus({ type: 'ready' });

    return `Mock 응답: "${prompt}"에 대한 답변입니다.`;
  }

  async dispose(): Promise<void> {
    this.setStatus({ type: 'idle' });
  }
}
```

### spa/src/lib/ai/index.ts

```typescript
export * from './types';
export * from './engine-factory';
export * from './base-engine';
```

## 완료 기준

- [ ] AIEngine 인터페이스 정의
- [ ] AIEngineStatus 타입 (idle, loading, ready, processing, error)
- [ ] ClassificationResult, AnalysisResult 타입
- [ ] BaseAIEngine 추상 클래스
- [ ] 엔진 팩토리 함수
- [ ] Mock 엔진 구현

## 참조 문서

- spec/03-spa-structure.md Section 6 (AI 엔진)
