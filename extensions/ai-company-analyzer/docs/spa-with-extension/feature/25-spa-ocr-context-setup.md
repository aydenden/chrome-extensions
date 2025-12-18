# Feature 25: Tesseract.js OCR Context

## 개요

Tesseract.js를 활용한 OCR 기능을 Context로 제공합니다.

## 범위

- OCRContext + Provider
- useOCR 훅
- Worker 초기화 및 관리
- 진행률 콜백

## 의존성

- Feature 14: SPA Extension Context

## 구현 상세

### spa/src/contexts/OCRContext.tsx

```tsx
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import Tesseract, { type Worker, type RecognizeResult } from 'tesseract.js';
import { getSettings } from '@/lib/settings';

interface OCRProgress {
  status: 'idle' | 'loading' | 'recognizing' | 'done' | 'error';
  progress: number; // 0-100
  message: string;
}

interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

interface OCRContextValue {
  recognize: (imageData: string) => Promise<OCRResult>;
  progress: OCRProgress;
  isReady: boolean;
}

const OCRContext = createContext<OCRContextValue | null>(null);

export function OCRProvider({ children }: { children: ReactNode }) {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState<OCRProgress>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  const initWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;

    setProgress({ status: 'loading', progress: 0, message: 'OCR 엔진 로딩 중...' });

    const settings = getSettings();
    const lang = settings.ocrLanguage;

    const worker = await Tesseract.createWorker(lang, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setProgress({
            status: 'recognizing',
            progress: Math.round((m.progress || 0) * 100),
            message: '텍스트 인식 중...',
          });
        }
      },
    });

    workerRef.current = worker;
    setIsReady(true);
    setProgress({ status: 'idle', progress: 0, message: '' });

    return worker;
  }, []);

  const recognize = useCallback(async (imageData: string): Promise<OCRResult> => {
    try {
      const worker = await initWorker();

      setProgress({ status: 'recognizing', progress: 0, message: '텍스트 인식 시작...' });

      const result: RecognizeResult = await worker.recognize(imageData);

      setProgress({ status: 'done', progress: 100, message: '완료' });

      return {
        text: result.data.text,
        confidence: result.data.confidence,
        words: result.data.words.map(word => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox,
        })),
      };
    } catch (error) {
      setProgress({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'OCR 실패',
      });
      throw error;
    }
  }, [initWorker]);

  return (
    <OCRContext.Provider value={{ recognize, progress, isReady }}>
      {children}
    </OCRContext.Provider>
  );
}

export function useOCR() {
  const context = useContext(OCRContext);
  if (!context) {
    throw new Error('useOCR must be used within OCRProvider');
  }
  return context;
}
```

### spa/src/hooks/useOCRBatch.ts

```typescript
import { useState, useCallback } from 'react';
import { useOCR } from '@/contexts/OCRContext';

interface BatchProgress {
  total: number;
  completed: number;
  current: string;
}

interface BatchResult {
  imageId: string;
  text: string;
  confidence: number;
  error?: string;
}

export function useOCRBatch() {
  const { recognize } = useOCR();
  const [progress, setProgress] = useState<BatchProgress>({ total: 0, completed: 0, current: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const processBatch = useCallback(async (
    images: Array<{ id: string; dataUrl: string }>
  ): Promise<BatchResult[]> => {
    setIsProcessing(true);
    setProgress({ total: images.length, completed: 0, current: '' });

    const results: BatchResult[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      setProgress({
        total: images.length,
        completed: i,
        current: `이미지 ${i + 1}/${images.length} 처리 중...`,
      });

      try {
        const result = await recognize(image.dataUrl);
        results.push({
          imageId: image.id,
          text: result.text,
          confidence: result.confidence,
        });
      } catch (error) {
        results.push({
          imageId: image.id,
          text: '',
          confidence: 0,
          error: error instanceof Error ? error.message : 'OCR 실패',
        });
      }
    }

    setProgress({ total: images.length, completed: images.length, current: '완료' });
    setIsProcessing(false);

    return results;
  }, [recognize]);

  return { processBatch, progress, isProcessing };
}
```

### spa/src/lib/ocr-utils.ts

```typescript
/** OCR 결과 텍스트 정제 */
export function cleanOCRText(text: string): string {
  return text
    // 연속 공백 제거
    .replace(/\s+/g, ' ')
    // 앞뒤 공백 제거
    .trim()
    // 깨진 문자 제거
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ.,!?@#$%^&*()\-+=\[\]{}|;:'\"<>/\\]/g, '')
    // 빈 라인 제거
    .replace(/^\s*[\r\n]/gm, '');
}

/** 신뢰도 기반 텍스트 필터링 */
export function filterByConfidence(
  words: Array<{ text: string; confidence: number }>,
  minConfidence: number = 60
): string {
  return words
    .filter(w => w.confidence >= minConfidence)
    .map(w => w.text)
    .join(' ');
}
```

## 완료 기준

- [ ] OCRContext + Provider
- [ ] Worker 초기화 (언어 설정 반영)
- [ ] recognize 함수: 단일 이미지 OCR
- [ ] 진행률 콜백 (loading, recognizing, done, error)
- [ ] useOCRBatch: 배치 처리
- [ ] 텍스트 정제 유틸리티

## 참조 문서

- spec/03-spa-structure.md Section 5 (OCR 파이프라인)
