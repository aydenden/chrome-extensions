# Feature 35: Retry + 지수 백오프

## 개요

API 호출 실패 시 지수 백오프를 적용한 재시도 로직을 구현합니다.

## 범위

- retry 함수
- 지수 백오프 알고리즘
- 최대 재시도 횟수
- 재시도 가능 에러 판별

## 의존성

- Feature 34: Circuit Breaker 패턴

## 구현 상세

### spa/src/lib/resilience/retry.ts

```typescript
interface RetryOptions {
  /** 최대 재시도 횟수 */
  maxRetries: number;
  /** 기본 대기 시간 (ms) */
  baseDelay: number;
  /** 최대 대기 시간 (ms) */
  maxDelay: number;
  /** 지수 배수 */
  factor: number;
  /** 재시도 가능 여부 판별 함수 */
  retryable?: (error: unknown) => boolean;
  /** 재시도 콜백 */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  factor: 2,
};

/** 지수 백오프 계산 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number,
  factor: number,
  maxDelay: number
): number {
  // 지터 추가 (0.5 ~ 1.5 배)
  const jitter = 0.5 + Math.random();
  const delay = Math.min(baseDelay * Math.pow(factor, attempt) * jitter, maxDelay);
  return Math.floor(delay);
}

/** 기본 재시도 가능 에러 판별 */
function isRetryableError(error: unknown): boolean {
  // 네트워크 에러
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // 타임아웃 에러
  if (error instanceof Error && error.name === 'TimeoutError') {
    return true;
  }

  // Extension 연결 에러
  if (error instanceof Error && error.message.includes('Extension')) {
    return true;
  }

  // 5xx 서버 에러 (Ollama 등)
  if (error instanceof Error && /5\d{2}/.test(error.message)) {
    return true;
  }

  return false;
}

/** 재시도 래퍼 함수 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const retryable = opts.retryable ?? isRetryableError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 마지막 시도 또는 재시도 불가 에러
      if (attempt === opts.maxRetries || !retryable(error)) {
        throw error;
      }

      // 대기 시간 계산
      const delay = calculateBackoff(attempt, opts.baseDelay, opts.factor, opts.maxDelay);

      // 콜백 호출
      opts.onRetry?.(error, attempt + 1, delay);

      // 대기
      await sleep(delay);
    }
  }

  throw lastError;
}

/** 대기 함수 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** AbortSignal을 지원하는 재시도 */
export async function retryWithAbort<T>(
  fn: () => Promise<T>,
  signal: AbortSignal,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const retryable = opts.retryable ?? isRetryableError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    // 중단 확인
    if (signal.aborted) {
      throw new Error('Aborted');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxRetries || !retryable(error)) {
        throw error;
      }

      const delay = calculateBackoff(attempt, opts.baseDelay, opts.factor, opts.maxDelay);
      opts.onRetry?.(error, attempt + 1, delay);

      // 중단 가능한 대기
      await Promise.race([
        sleep(delay),
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
        }),
      ]);
    }
  }

  throw lastError;
}
```

### spa/src/lib/resilience/resilient-client.ts (확장)

```typescript
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { retry, type RetryOptions } from './retry';
import type { ExtensionClient, ExtensionMessage, ExtensionResponse } from '@/lib/extension-client';

interface ResilientClientOptions {
  circuitBreaker?: Partial<ConstructorParameters<typeof CircuitBreaker>[0]>;
  retry?: Partial<RetryOptions>;
}

/** Circuit Breaker + Retry가 적용된 Extension Client 래퍼 */
export class ResilientClient {
  private readonly client: ExtensionClient;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryOptions: Partial<RetryOptions>;

  constructor(client: ExtensionClient, options: ResilientClientOptions = {}) {
    this.client = client;
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.retryOptions = options.retry ?? {};
  }

  /** 메시지 전송 (Circuit Breaker + Retry 적용) */
  async send<T extends ExtensionMessage['type']>(
    type: T,
    payload?: Extract<ExtensionMessage, { type: T }>['payload']
  ): Promise<ExtensionResponse<T>> {
    return this.circuitBreaker.execute(() =>
      retry(
        () => this.client.send(type, payload),
        {
          ...this.retryOptions,
          onRetry: (error, attempt, delay) => {
            console.log(`Retry attempt ${attempt} after ${delay}ms:`, error);
          },
        }
      )
    );
  }

  // ... 나머지 메서드 동일
}
```

### spa/src/lib/resilience/timeout.ts

```typescript
/** 타임아웃 래퍼 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(message));
    }, timeoutMs);

    // Promise가 resolve되면 타이머 정리
    promise.finally(() => clearTimeout(timer));
  });

  return Promise.race([promise, timeoutPromise]);
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
```

## 완료 기준

- [ ] retry 함수: 지수 백오프
- [ ] calculateBackoff: 지터 포함
- [ ] 재시도 가능 에러 판별
- [ ] onRetry 콜백
- [ ] retryWithAbort: AbortSignal 지원
- [ ] withTimeout: 타임아웃 래퍼
- [ ] ResilientClient 통합

## 참조 문서

- spec/03-spa-structure.md Section 7.2 (Retry Backoff)
