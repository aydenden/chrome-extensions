import { TimeoutError } from './timeout';

export interface RetryOptions {
  /** 최대 재시도 횟수 (기본: 3) */
  maxRetries?: number;
  /** 기본 대기 시간 ms (기본: 1000) */
  baseDelay?: number;
  /** 최대 대기 시간 ms (기본: 30000) */
  maxDelay?: number;
  /** 지수 배수 (기본: 2) */
  factor?: number;
  /** 재시도 가능 여부 판별 함수 */
  retryable?: (error: unknown) => boolean;
  /** 재시도 시 호출되는 콜백 */
  onRetry?: (error: unknown, attempt: number) => void;
}

/**
 * 지수 백오프 + 지터 계산
 * @param attempt 현재 시도 횟수 (0부터 시작)
 * @param baseDelay 기본 대기 시간
 * @param factor 지수 배수
 * @param maxDelay 최대 대기 시간
 * @returns 계산된 대기 시간 (ms)
 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number,
  factor: number,
  maxDelay: number
): number {
  // 지수 백오프 계산
  const exponentialDelay = baseDelay * Math.pow(factor, attempt);

  // maxDelay로 제한
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // 지터 적용 (0.5 ~ 1.5배)
  const jitter = 0.5 + Math.random();

  return Math.floor(cappedDelay * jitter);
}

/**
 * 재시도 가능한 에러인지 판별
 * - 네트워크 에러
 * - 타임아웃 에러
 * - Extension 연결 에러
 * - 5xx 서버 에러
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // TimeoutError
  if (error instanceof TimeoutError) {
    return true;
  }

  // Error 객체인 경우
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // 네트워크 관련 에러
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection')
    ) {
      return true;
    }

    // Extension 연결 에러
    if (
      message.includes('extension context invalidated') ||
      message.includes('receiving end does not exist') ||
      message.includes('message port closed')
    ) {
      return true;
    }

    // AbortError는 재시도하지 않음
    if (error.name === 'AbortError') {
      return false;
    }
  }

  // HTTP 응답 에러 (5xx)
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status >= 500 && error.status < 600;
  }

  return false;
}

/**
 * 재시도 래퍼 함수
 * @param fn 실행할 비동기 함수
 * @param options 재시도 옵션
 * @returns 재시도가 적용된 Promise
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    retryable = isRetryableError,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 마지막 시도였거나 재시도 불가능한 에러면 즉시 throw
      if (attempt === maxRetries || !retryable(error)) {
        throw error;
      }

      // 재시도 콜백 호출
      if (onRetry) {
        onRetry(error, attempt + 1);
      }

      // 백오프 대기
      const delay = calculateBackoff(attempt, baseDelay, factor, maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 이론적으로 도달 불가능하지만 TypeScript를 위해 추가
  throw lastError;
}

/**
 * AbortSignal 지원 재시도 함수
 * @param fn 실행할 비동기 함수 (AbortSignal 인자 받음)
 * @param signal AbortSignal
 * @param options 재시도 옵션
 * @returns 재시도가 적용된 Promise
 */
export async function retryWithAbort<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    retryable = isRetryableError,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // abort 체크
    if (signal.aborted) {
      const error = new Error('Request aborted');
      (error as any).cause = signal.reason;
      throw error;
    }

    try {
      return await fn(signal);
    } catch (error) {
      lastError = error;

      // abort된 경우 즉시 throw
      if (signal.aborted) {
        throw error;
      }

      // 마지막 시도였거나 재시도 불가능한 에러면 즉시 throw
      if (attempt === maxRetries || !retryable(error)) {
        throw error;
      }

      // 재시도 콜백 호출
      if (onRetry) {
        onRetry(error, attempt + 1);
      }

      // 백오프 대기 (abort 가능)
      const delay = calculateBackoff(attempt, baseDelay, factor, maxDelay);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);

        const abortHandler = () => {
          clearTimeout(timer);
          const error = new Error('Request aborted during retry backoff');
          (error as any).cause = signal.reason;
          reject(error);
        };

        if (signal.aborted) {
          clearTimeout(timer);
          const error = new Error('Request aborted during retry backoff');
          (error as any).cause = signal.reason;
          reject(error);
          return;
        }

        signal.addEventListener('abort', abortHandler, { once: true });
      });
    }
  }

  // 이론적으로 도달 불가능하지만 TypeScript를 위해 추가
  throw lastError;
}
