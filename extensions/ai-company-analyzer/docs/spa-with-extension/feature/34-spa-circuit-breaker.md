# Feature 34: Circuit Breaker 패턴

## 개요

Extension API 호출 실패에 대응하는 Circuit Breaker 패턴을 구현합니다.

## 범위

- CircuitBreaker 클래스
- 상태 관리 (CLOSED, OPEN, HALF_OPEN)
- 실패 카운트 및 타임아웃
- Extension Client 통합

## 의존성

- Feature 13: Extension Client (DI 패턴)

## 구현 상세

### spa/src/lib/resilience/circuit-breaker.ts

```typescript
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  /** 회로 개방 전 허용 실패 횟수 */
  failureThreshold: number;
  /** 회로 개방 유지 시간 (ms) */
  resetTimeout: number;
  /** HALF_OPEN 상태에서 허용할 요청 수 */
  halfOpenRequests: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30초
  halfOpenRequests: 3,
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** 현재 상태 조회 */
  getState(): CircuitState {
    this.updateState();
    return this.state;
  }

  /** 상태 정보 조회 */
  getStatus(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /** 요청 실행 래퍼 */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.updateState();

    if (this.state === 'OPEN') {
      throw new CircuitOpenError('Circuit breaker is OPEN');
    }

    if (this.state === 'HALF_OPEN') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts > this.options.halfOpenRequests) {
        // 허용 요청 수 초과
        throw new CircuitOpenError('Circuit breaker is HALF_OPEN, too many attempts');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /** 성공 처리 */
  private onSuccess(): void {
    this.successCount++;

    if (this.state === 'HALF_OPEN') {
      // HALF_OPEN에서 성공 → CLOSED
      this.reset();
    }
  }

  /** 실패 처리 */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // HALF_OPEN에서 실패 → OPEN
      this.state = 'OPEN';
      this.halfOpenAttempts = 0;
    } else if (this.failureCount >= this.options.failureThreshold) {
      // 임계치 초과 → OPEN
      this.state = 'OPEN';
    }
  }

  /** 상태 업데이트 (타임아웃 체크) */
  private updateState(): void {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.options.resetTimeout) {
        // 타임아웃 경과 → HALF_OPEN
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
      }
    }
  }

  /** 회로 리셋 */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
  }

  /** 강제로 회로 개방 */
  trip(): void {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
  }
}

/** Circuit Open 에러 */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}
```

### spa/src/lib/resilience/resilient-client.ts

```typescript
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import type { ExtensionClient, ExtensionMessage, ExtensionResponse } from '@/lib/extension-client';

interface ResilientClientOptions {
  circuitBreaker?: Partial<ConstructorParameters<typeof CircuitBreaker>[0]>;
}

/** Circuit Breaker가 적용된 Extension Client 래퍼 */
export class ResilientClient {
  private readonly client: ExtensionClient;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(client: ExtensionClient, options: ResilientClientOptions = {}) {
    this.client = client;
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
  }

  /** 메시지 전송 (Circuit Breaker 적용) */
  async send<T extends ExtensionMessage['type']>(
    type: T,
    payload?: Extract<ExtensionMessage, { type: T }>['payload']
  ): Promise<ExtensionResponse<T>> {
    return this.circuitBreaker.execute(() => this.client.send(type, payload));
  }

  /** Circuit Breaker 상태 조회 */
  getCircuitStatus() {
    return this.circuitBreaker.getStatus();
  }

  /** 수동 리셋 */
  resetCircuit() {
    this.circuitBreaker.reset();
  }

  /** 회로가 열려있는지 확인 */
  isCircuitOpen(): boolean {
    return this.circuitBreaker.getState() === 'OPEN';
  }
}
```

### spa/src/lib/resilience/index.ts

```typescript
export { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
export { ResilientClient } from './resilient-client';
```

### 사용 예시

```typescript
import { getExtensionClient } from '@/lib/extension-client';
import { ResilientClient, CircuitOpenError } from '@/lib/resilience';

const baseClient = getExtensionClient();
const client = new ResilientClient(baseClient, {
  circuitBreaker: {
    failureThreshold: 3,
    resetTimeout: 10000, // 10초
  },
});

async function fetchData() {
  try {
    const data = await client.send('GET_COMPANIES');
    return data;
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // 회로가 열려있음 - 폴백 또는 캐시된 데이터 반환
      console.log('Circuit is open, using cached data');
      return getCachedData();
    }
    throw error;
  }
}
```

## 완료 기준

- [ ] CircuitBreaker 클래스
- [ ] 3가지 상태: CLOSED, OPEN, HALF_OPEN
- [ ] 실패 임계치 도달 시 OPEN
- [ ] 타임아웃 후 HALF_OPEN 전환
- [ ] HALF_OPEN에서 성공 시 CLOSED, 실패 시 OPEN
- [ ] CircuitOpenError 예외
- [ ] ResilientClient 래퍼
- [ ] 상태 조회 및 수동 리셋

## 참조 문서

- spec/03-spa-structure.md Section 7.1 (Circuit Breaker)
