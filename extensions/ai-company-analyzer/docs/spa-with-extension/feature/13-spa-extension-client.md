# Feature 13: Extension Client (DI 패턴)

## 개요

Extension 통신 클라이언트를 DI 패턴으로 구현합니다.

## 범위

- extension-client/types.ts (IExtensionHandler)
- chrome-handler.ts
- mock-handler.ts
- client.ts (팩토리)

## 의존성

- Feature 03: Shared Types

## 구현 상세

### spa/src/lib/extension-client/types.ts

```typescript
import type { MessageType, MessagePayload, MessageResponse } from '@shared/types';

/** Extension Handler 인터페이스 */
export interface IExtensionHandler {
  send<T extends MessageType>(
    type: T,
    payload?: MessagePayload[T]
  ): Promise<MessageResponse[T]>;
}

/** Extension 연결 상태 */
export interface ExtensionState {
  isConnected: boolean;
  isChecking: boolean;
  version?: string;
  error?: string;
}
```

### spa/src/lib/extension-client/chrome-handler.ts

```typescript
import type { IExtensionHandler } from './types';
import type { MessageType, MessagePayload, MessageResponse, ApiResponse } from '@shared/types';
import { ExtensionError } from '@shared/types';

export class ChromeHandler implements IExtensionHandler {
  constructor(private extensionId: string) {}

  async send<T extends MessageType>(
    type: T,
    payload?: MessagePayload[T]
  ): Promise<MessageResponse[T]> {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime?.sendMessage) {
        reject(new ExtensionError('Chrome runtime not available'));
        return;
      }

      chrome.runtime.sendMessage(
        this.extensionId,
        { type, payload },
        (response: ApiResponse<MessageResponse[T]>) => {
          if (chrome.runtime.lastError) {
            reject(new ExtensionError(
              chrome.runtime.lastError.message || 'Extension communication failed'
            ));
            return;
          }

          if (!response) {
            reject(new ExtensionError('No response from extension'));
            return;
          }

          if (!response.success) {
            reject(new ExtensionError(
              response.error?.message || 'Unknown error'
            ));
            return;
          }

          resolve(response.data as MessageResponse[T]);
        }
      );
    });
  }
}
```

### spa/src/lib/extension-client/mock-handler.ts

```typescript
import type { IExtensionHandler } from './types';
import type { MessageType, MessagePayload, MessageResponse } from '@shared/types';

/** Mock 데이터 생성 헬퍼 */
const mockCompany = (id = 'mock-company-1') => ({
  id,
  name: '(주)테스트 회사',
  url: 'https://example.com',
  siteType: 'WANTED' as const,
  dataSources: ['WANTED'] as const[],
  imageCount: 3,
  analyzedCount: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const mockImageMeta = (id = 'mock-image-1') => ({
  id,
  companyId: 'mock-company-1',
  mimeType: 'image/png',
  size: 100000,
  width: 800,
  height: 600,
  category: 'revenue_trend' as const,
  hasRawText: true,
  hasAnalysis: true,
  createdAt: new Date().toISOString(),
});

const mockImageData = () => ({
  id: 'mock-image-1',
  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  mimeType: 'image/png',
  category: 'revenue_trend' as const,
  rawText: '테스트 OCR 결과',
  analysis: '테스트 분석 결과',
});

/** Mock Handler */
export class MockHandler implements IExtensionHandler {
  private delay: number;

  constructor(options?: { delay?: number }) {
    this.delay = options?.delay ?? 100;
  }

  async send<T extends MessageType>(
    type: T,
    payload?: MessagePayload[T]
  ): Promise<MessageResponse[T]> {
    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, this.delay));

    const handlers: Record<MessageType, () => any> = {
      GET_COMPANIES: () => [mockCompany()],
      GET_COMPANY: () => mockCompany(),
      DELETE_COMPANY: () => ({ deletedImages: 3 }),
      GET_IMAGES: () => [mockImageMeta()],
      GET_IMAGE_DATA: () => mockImageData(),
      GET_IMAGE_THUMBNAIL: () => ({
        base64: mockImageData().base64,
        mimeType: 'image/jpeg',
        width: 200,
        height: 150,
      }),
      DELETE_IMAGE: () => null,
      SAVE_ANALYSIS: () => ({ updatedAt: new Date().toISOString() }),
      BATCH_SAVE_ANALYSIS: () => ({ savedCount: 1, failedIds: [] }),
      PING: () => ({
        version: '1.0.0-mock',
        timestamp: new Date().toISOString(),
      }),
      GET_STATS: () => ({
        totalCompanies: 10,
        totalImages: 50,
        analyzedImages: 30,
        storageUsed: 1024000,
      }),
    };

    return handlers[type]();
  }
}

/** 실패 시뮬레이션 Mock Handler */
export class FailingMockHandler implements IExtensionHandler {
  constructor(private failingTypes: MessageType[]) {}

  async send<T extends MessageType>(
    type: T,
    payload?: MessagePayload[T]
  ): Promise<MessageResponse[T]> {
    if (this.failingTypes.includes(type)) {
      throw new Error(`Mock failure for ${type}`);
    }
    return new MockHandler().send(type, payload);
  }
}
```

### spa/src/lib/extension-client/client.ts

```typescript
import type { IExtensionHandler } from './types';
import { ChromeHandler } from './chrome-handler';
import { MockHandler } from './mock-handler';

let handler: IExtensionHandler | null = null;

/** 클라이언트 초기화 */
export function initExtensionClient(h: IExtensionHandler): void {
  handler = h;
}

/** 클라이언트 가져오기 */
export function getExtensionClient(): IExtensionHandler {
  if (!handler) {
    throw new Error('Extension client not initialized. Call initExtensionClient first.');
  }
  return handler;
}

/** 기본 Chrome Handler로 초기화 */
export function initChromeExtensionClient(extensionId: string): void {
  initExtensionClient(new ChromeHandler(extensionId));
}

/** Mock Handler로 초기화 */
export function initMockExtensionClient(options?: { delay?: number }): void {
  initExtensionClient(new MockHandler(options));
}

/** 자동 감지 초기화 */
export function autoInitExtensionClient(extensionId: string): void {
  // 브라우저 환경이 아니거나 chrome API가 없으면 Mock 사용
  if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
    console.log('[Extension Client] Chrome API not available, using mock');
    initMockExtensionClient();
    return;
  }

  initChromeExtensionClient(extensionId);
}
```

### spa/src/lib/extension-client/index.ts

```typescript
export type { IExtensionHandler, ExtensionState } from './types';
export { ChromeHandler } from './chrome-handler';
export { MockHandler, FailingMockHandler } from './mock-handler';
export {
  initExtensionClient,
  getExtensionClient,
  initChromeExtensionClient,
  initMockExtensionClient,
  autoInitExtensionClient,
} from './client';
```

## 사용 예시

### 앱 초기화

```typescript
// src/main.tsx
import { autoInitExtensionClient } from '@/lib/extension-client';

const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID;

autoInitExtensionClient(EXTENSION_ID);
```

### 컴포넌트에서 사용

```typescript
import { getExtensionClient } from '@/lib/extension-client';

async function loadCompanies() {
  const client = getExtensionClient();
  const companies = await client.send('GET_COMPANIES');
  return companies;
}
```

### 테스트에서 사용

```typescript
import { initExtensionClient, MockHandler, FailingMockHandler } from '@/lib/extension-client';

beforeEach(() => {
  initExtensionClient(new MockHandler());
});

test('에러 시나리오', () => {
  initExtensionClient(new FailingMockHandler(['GET_COMPANIES']));
  // ...
});
```

## 완료 기준

- [ ] ChromeHandler: Extension과 정상 통신
- [ ] MockHandler: Mock 데이터 반환
- [ ] FailingMockHandler: 특정 API 실패 시뮬레이션
- [ ] autoInitExtensionClient: 환경에 따라 자동 선택
- [ ] 테스트에서 DI로 Mock 주입 가능

## 참조 문서

- spec/03-spa-structure.md Section 7 (Extension Client DI 기반)
