# OCR 파이프라인 기능 명세

## 1. 개요

SPA에서 Tesseract.js를 사용한 OCR 처리 파이프라인 명세.

## 2. 아키텍처

```
[이미지 로드]
    │
    ▼
[전처리 (선택)]
    │ - 그레이스케일
    │ - 대비 조정
    │ - 노이즈 제거
    ▼
[Tesseract.js Worker Pool]
    │ - 4개 Worker 병렬 처리
    │ - 한국어 + 영어 인식
    ▼
[후처리]
    │ - 불필요한 공백 제거
    │ - 특수문자 정리
    ▼
[텍스트 반환]
```

## 3. Worker Pool 구현

### 3.1 초기화

```typescript
// spa/src/workers/ocr-pool.ts
import { createWorker, type Worker } from 'tesseract.js';

const POOL_SIZE = 4;
const LANGUAGES = 'kor+eng';

interface WorkerInfo {
  worker: Worker;
  busy: boolean;
}

class OCRWorkerPool {
  private workers: WorkerInfo[] = [];
  private queue: Array<{
    blob: Blob;
    resolve: (text: string) => void;
    reject: (error: Error) => void;
  }> = [];
  private initPromise: Promise<void> | null = null;

  async init(onProgress?: (current: number, total: number) => void): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit(onProgress);
    return this.initPromise;
  }

  private async doInit(onProgress?: (current: number, total: number) => void): Promise<void> {
    const initPromises = [];

    for (let i = 0; i < POOL_SIZE; i++) {
      initPromises.push(
        createWorker(LANGUAGES, 1, {
          logger: (m) => {
            // 로거는 첫 번째 Worker만
            if (i === 0 && m.progress) {
              console.log(`OCR Worker: ${m.status} (${Math.round(m.progress * 100)}%)`);
            }
          },
        }).then((worker) => {
          this.workers.push({ worker, busy: false });
          onProgress?.(this.workers.length, POOL_SIZE);
        })
      );
    }

    await Promise.all(initPromises);
    console.log(`OCR Worker Pool 준비 완료 (${POOL_SIZE} workers)`);
  }

  isReady(): boolean {
    return this.workers.length === POOL_SIZE;
  }

  async recognize(blob: Blob): Promise<string> {
    if (!this.isReady()) {
      throw new Error('OCR Worker Pool이 초기화되지 않았습니다');
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ blob, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    // 사용 가능한 Worker 찾기
    const available = this.workers.find((w) => !w.busy);
    if (!available || this.queue.length === 0) return;

    // 작업 가져오기
    const task = this.queue.shift()!;
    available.busy = true;

    try {
      const { data } = await available.worker.recognize(task.blob);
      task.resolve(data.text);
    } catch (error) {
      task.reject(error as Error);
    } finally {
      available.busy = false;
      // 다음 작업 처리
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  async terminate(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.worker.terminate()));
    this.workers = [];
    this.initPromise = null;
  }
}

// 싱글톤
export const ocrPool = new OCRWorkerPool();
```

### 3.2 React Context

```typescript
// spa/src/contexts/OCRContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { ocrPool } from '@/workers/ocr-pool';

interface OCRContextValue {
  isReady: boolean;
  isInitializing: boolean;
  initProgress: { current: number; total: number };
  recognize: (blob: Blob) => Promise<string>;
  error: string | null;
}

const OCRContext = createContext<OCRContextValue | null>(null);

export function OCRProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initProgress, setInitProgress] = useState({ current: 0, total: 4 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsInitializing(true);

    ocrPool
      .init((current, total) => setInitProgress({ current, total }))
      .then(() => {
        setIsReady(true);
        setIsInitializing(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsInitializing(false);
      });

    return () => {
      ocrPool.terminate();
    };
  }, []);

  const recognize = async (blob: Blob): Promise<string> => {
    if (!isReady) {
      throw new Error('OCR이 준비되지 않았습니다');
    }
    return ocrPool.recognize(blob);
  };

  return (
    <OCRContext.Provider
      value={{ isReady, isInitializing, initProgress, recognize, error }}
    >
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

## 4. 이미지 전처리

### 4.1 Canvas 기반 전처리

```typescript
// spa/src/lib/image-processing.ts
export async function preprocessImage(blob: Blob): Promise<Blob> {
  const img = await loadImage(blob);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  canvas.width = img.width;
  canvas.height = img.height;

  // 원본 그리기
  ctx.drawImage(img, 0, 0);

  // 그레이스케일 변환
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);

  // 대비 조정
  ctx.filter = 'contrast(1.2)';
  ctx.drawImage(canvas, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}
```

### 4.2 전처리 옵션

```typescript
interface PreprocessOptions {
  grayscale?: boolean;      // 그레이스케일 변환
  contrast?: number;        // 대비 (1.0 = 원본)
  brightness?: number;      // 밝기 (1.0 = 원본)
  sharpen?: boolean;        // 샤프닝
  threshold?: number;       // 이진화 (0-255, null = 사용 안함)
}

const defaultOptions: PreprocessOptions = {
  grayscale: true,
  contrast: 1.2,
  brightness: 1.0,
  sharpen: false,
  threshold: null,
};
```

## 5. 텍스트 후처리

### 5.1 기본 정리

```typescript
// spa/src/lib/text-processing.ts
export function cleanOCRText(text: string): string {
  return text
    // 연속 공백 제거
    .replace(/\s+/g, ' ')
    // 줄바꿈 정리
    .replace(/\n{3,}/g, '\n\n')
    // 앞뒤 공백 제거
    .trim();
}
```

### 5.2 한국어 특화 정리

```typescript
export function cleanKoreanOCRText(text: string): string {
  return text
    // 기본 정리
    .replace(/\s+/g, ' ')
    // 한글 + 숫자 사이 공백 제거 (예: "1 억" → "1억")
    .replace(/(\d)\s+(억|만|원|%)/g, '$1$2')
    // 괄호 정리
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    // 불필요한 특수문자 제거
    .replace(/[^\w\s가-힣.,\-()%억만원년월일]/g, '')
    .trim();
}
```

## 6. 배치 처리

### 6.1 여러 이미지 병렬 OCR

```typescript
// spa/src/hooks/useOCRBatch.ts
import { useCallback, useState } from 'react';
import { useOCR } from '@/contexts/OCRContext';

interface OCRBatchResult {
  imageId: string;
  text: string;
  error?: string;
}

export function useOCRBatch() {
  const { recognize, isReady } = useOCR();
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const processBatch = useCallback(
    async (
      images: Array<{ id: string; blob: Blob }>
    ): Promise<OCRBatchResult[]> => {
      if (!isReady) {
        throw new Error('OCR이 준비되지 않았습니다');
      }

      setIsProcessing(true);
      setProgress({ current: 0, total: images.length });

      const results: OCRBatchResult[] = [];

      // Worker Pool이 자동으로 병렬 처리
      const promises = images.map(async ({ id, blob }, index) => {
        try {
          const text = await recognize(blob);
          results.push({ imageId: id, text });
        } catch (error) {
          results.push({
            imageId: id,
            text: '',
            error: (error as Error).message,
          });
        }
        setProgress((p) => ({ ...p, current: p.current + 1 }));
      });

      await Promise.all(promises);

      setIsProcessing(false);
      return results;
    },
    [recognize, isReady]
  );

  return {
    processBatch,
    progress,
    isProcessing,
    isReady,
  };
}
```

## 7. 성능 최적화

### 7.1 이미지 크기 제한

```typescript
const MAX_IMAGE_DIMENSION = 2000; // 최대 2000px

export async function resizeIfNeeded(blob: Blob): Promise<Blob> {
  const img = await loadImage(blob);

  if (img.width <= MAX_IMAGE_DIMENSION && img.height <= MAX_IMAGE_DIMENSION) {
    return blob;
  }

  const scale = Math.min(
    MAX_IMAGE_DIMENSION / img.width,
    MAX_IMAGE_DIMENSION / img.height
  );

  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
```

### 7.2 언어팩 CDN 캐싱

```typescript
// Tesseract.js는 기본적으로 CDN에서 언어팩 로드
// Service Worker로 캐싱 가능

// spa/public/sw.js
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('tessdata')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) return response;

        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open('tessdata-v1').then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        });
      })
    );
  }
});
```

## 8. 에러 처리

### 8.1 에러 유형

| 에러 | 원인 | 처리 |
|------|------|------|
| Worker 초기화 실패 | 네트워크 문제 | 재시도 |
| 언어팩 로드 실패 | CDN 접근 불가 | 로컬 폴백 |
| 인식 실패 | 이미지 품질 | 전처리 후 재시도 |
| 메모리 부족 | 큰 이미지 | 리사이즈 후 재시도 |

### 8.2 재시도 로직

```typescript
async function recognizeWithRetry(
  blob: Blob,
  maxRetries = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 첫 시도 실패 시 전처리 적용
      const processedBlob = attempt > 0 ? await preprocessImage(blob) : blob;

      return await ocrPool.recognize(processedBlob);
    } catch (error) {
      lastError = error as Error;
      console.warn(`OCR 시도 ${attempt + 1}/${maxRetries} 실패:`, error);
    }
  }

  throw lastError;
}
```

## 9. UI 컴포넌트

### 9.1 OCR 진행 표시

```tsx
// spa/src/components/analysis/OCRProgress.tsx
interface OCRProgressProps {
  current: number;
  total: number;
  currentImageId?: string;
}

export function OCRProgress({ current, total, currentImageId }: OCRProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>OCR 처리 중...</span>
        <span>{current}/{total}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {currentImageId && (
        <p className="text-xs text-gray-500">
          처리 중: {currentImageId.slice(0, 8)}...
        </p>
      )}
    </div>
  );
}
```

## 10. 테스트 체크리스트

- [ ] Worker Pool 초기화 (4개)
- [ ] 한국어 텍스트 OCR
- [ ] 영어 텍스트 OCR
- [ ] 혼합 텍스트 OCR
- [ ] 병렬 처리 (4개 동시)
- [ ] 전처리 효과 확인
- [ ] 큰 이미지 리사이즈
- [ ] 에러 복구
