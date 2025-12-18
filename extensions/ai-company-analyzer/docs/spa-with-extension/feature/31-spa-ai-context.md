# Feature 31: AI Engine Context + 폴백

## 개요

AI 엔진을 React Context로 제공하고, Qwen3 → Ollama → Mock 폴백 체인을 구현합니다.

## 범위

- AIContext + Provider
- useAI 훅
- 자동 폴백 로직
- 엔진 상태 관리

## 의존성

- Feature 28: Qwen3 WebGPU 엔진
- Feature 29: Ollama 폴백 엔진

## 구현 상세

### spa/src/contexts/AIContext.tsx

```tsx
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AIEngine, AIEngineStatus, ClassificationResult, AnalysisResult, AnalysisContext } from '@/lib/ai/types';
import { createAIEngine, disposeAllEngines } from '@/lib/ai/engine-factory';
import { checkWebGPUSupport } from '@/lib/ai/webgpu-check';
import { checkOllamaStatus } from '@/lib/ai/ollama-utils';
import { getSettings } from '@/lib/settings';

interface AIContextValue {
  engine: AIEngine | null;
  status: AIEngineStatus;
  engineName: string;
  initialize: () => Promise<void>;
  classify: (imageData: string, ocrText?: string) => Promise<ClassificationResult>;
  analyze: (text: string, context?: AnalysisContext) => Promise<AnalysisResult>;
  query: (prompt: string) => Promise<string>;
  switchEngine: (type: 'qwen3' | 'ollama' | 'mock') => Promise<void>;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
  const [engine, setEngine] = useState<AIEngine | null>(null);
  const [status, setStatus] = useState<AIEngineStatus>({ type: 'idle' });
  const [engineName, setEngineName] = useState<string>('');

  const initializeWithFallback = useCallback(async () => {
    setStatus({ type: 'loading', progress: 0, message: '최적 엔진 선택 중...' });

    const settings = getSettings();
    const preferredEngine = settings.aiEngine;
    const engines: Array<'qwen3' | 'ollama' | 'mock'> = [];

    // 우선순위 설정
    if (preferredEngine === 'qwen3') {
      engines.push('qwen3', 'ollama', 'mock');
    } else {
      engines.push('ollama', 'qwen3', 'mock');
    }

    for (const engineType of engines) {
      try {
        // 사전 체크
        if (engineType === 'qwen3') {
          const webgpu = await checkWebGPUSupport();
          if (!webgpu.supported) {
            console.log('WebGPU not supported, skipping Qwen3');
            continue;
          }
        }

        if (engineType === 'ollama') {
          const ollama = await checkOllamaStatus(settings.ollamaEndpoint);
          if (!ollama.connected) {
            console.log('Ollama not available, skipping');
            continue;
          }
        }

        setStatus({
          type: 'loading',
          progress: 50,
          message: `${engineType} 엔진 초기화 중...`,
        });

        const newEngine = await createAIEngine(engineType);

        // 상태 변경 콜백 연결
        newEngine.onStatusChange = setStatus;

        await newEngine.initialize();

        setEngine(newEngine);
        setEngineName(newEngine.name);
        setStatus({ type: 'ready' });

        console.log(`AI Engine initialized: ${newEngine.name}`);
        return;
      } catch (error) {
        console.error(`${engineType} initialization failed:`, error);
        continue;
      }
    }

    // 모든 엔진 실패
    setStatus({
      type: 'error',
      error: '사용 가능한 AI 엔진이 없습니다.',
    });
  }, []);

  const switchEngine = useCallback(async (type: 'qwen3' | 'ollama' | 'mock') => {
    if (engine) {
      await engine.dispose();
    }

    setStatus({ type: 'loading', progress: 0, message: `${type} 엔진으로 전환 중...` });

    try {
      const newEngine = await createAIEngine(type);
      newEngine.onStatusChange = setStatus;
      await newEngine.initialize();

      setEngine(newEngine);
      setEngineName(newEngine.name);
      setStatus({ type: 'ready' });
    } catch (error) {
      setStatus({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }, [engine]);

  const classify = useCallback(async (imageData: string, ocrText?: string) => {
    if (!engine) throw new Error('AI 엔진이 초기화되지 않았습니다.');
    return engine.classify(imageData, ocrText);
  }, [engine]);

  const analyze = useCallback(async (text: string, context?: AnalysisContext) => {
    if (!engine) throw new Error('AI 엔진이 초기화되지 않았습니다.');
    return engine.analyze(text, context);
  }, [engine]);

  const query = useCallback(async (prompt: string) => {
    if (!engine) throw new Error('AI 엔진이 초기화되지 않았습니다.');
    return engine.query(prompt);
  }, [engine]);

  // 클린업
  useEffect(() => {
    return () => {
      disposeAllEngines();
    };
  }, []);

  return (
    <AIContext.Provider
      value={{
        engine,
        status,
        engineName,
        initialize: initializeWithFallback,
        classify,
        analyze,
        query,
        switchEngine,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within AIProvider');
  }
  return context;
}
```

### spa/src/hooks/useAIAnalysis.ts

```typescript
import { useState, useCallback } from 'react';
import { useAI } from '@/contexts/AIContext';
import { useOCR } from '@/contexts/OCRContext';
import type { AnalysisResult } from '@/lib/ai/types';

interface AnalysisProgress {
  step: 'idle' | 'ocr' | 'classify' | 'analyze' | 'done' | 'error';
  progress: number;
  message: string;
}

interface ImageAnalysis {
  imageId: string;
  ocrText: string;
  classification: {
    category: string;
    subCategory: string;
    confidence: number;
  };
  analysis: AnalysisResult;
}

export function useAIAnalysis(companyName: string) {
  const { classify, analyze, status: engineStatus } = useAI();
  const { recognize } = useOCR();
  const [progress, setProgress] = useState<AnalysisProgress>({
    step: 'idle',
    progress: 0,
    message: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const analyzeImage = useCallback(async (
    imageId: string,
    imageData: string
  ): Promise<ImageAnalysis> => {
    setIsProcessing(true);

    try {
      // Step 1: OCR
      setProgress({ step: 'ocr', progress: 25, message: '텍스트 추출 중...' });
      const ocrResult = await recognize(imageData);

      // Step 2: 분류
      setProgress({ step: 'classify', progress: 50, message: '이미지 분류 중...' });
      const classResult = await classify(imageData, ocrResult.text);

      // Step 3: 분석
      setProgress({ step: 'analyze', progress: 75, message: '내용 분석 중...' });
      const analysisResult = await analyze(ocrResult.text, {
        companyName,
        category: classResult.subCategory,
      });

      setProgress({ step: 'done', progress: 100, message: '완료' });

      return {
        imageId,
        ocrText: ocrResult.text,
        classification: {
          category: classResult.category,
          subCategory: classResult.subCategory,
          confidence: classResult.confidence,
        },
        analysis: analysisResult,
      };
    } catch (error) {
      setProgress({
        step: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [classify, analyze, recognize, companyName]);

  const analyzeBatch = useCallback(async (
    images: Array<{ id: string; dataUrl: string }>
  ): Promise<ImageAnalysis[]> => {
    const results: ImageAnalysis[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      setProgress({
        step: 'analyze',
        progress: Math.round((i / images.length) * 100),
        message: `이미지 ${i + 1}/${images.length} 분석 중...`,
      });

      try {
        const result = await analyzeImage(image.id, image.dataUrl);
        results.push(result);
      } catch (error) {
        console.error(`Image ${image.id} analysis failed:`, error);
        // 개별 실패는 스킵하고 계속
      }
    }

    return results;
  }, [analyzeImage]);

  return {
    analyzeImage,
    analyzeBatch,
    progress,
    isProcessing,
    engineStatus,
  };
}
```

## 완료 기준

- [ ] AIContext + Provider
- [ ] 자동 폴백: Qwen3 → Ollama → Mock
- [ ] useAI 훅: classify, analyze, query
- [ ] switchEngine: 엔진 전환
- [ ] 상태 관리: idle, loading, ready, processing, error
- [ ] useAIAnalysis: OCR + 분류 + 분석 통합 훅

## 참조 문서

- spec/03-spa-structure.md Section 6.4 (폴백 체인)
