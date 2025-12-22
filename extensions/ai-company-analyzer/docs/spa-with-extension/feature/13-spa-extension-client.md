# Feature 13: Extension Client (DI 패턴)

## 개요

Extension 통신 클라이언트를 DI 패턴으로 구현합니다.

## 범위

- extension-client/types.ts (IExtensionHandler)
- chrome-handler.ts
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

### spa/src/lib/extension-client/client.ts

```typescript
import type { IExtensionHandler } from './types';
import { ChromeHandler } from './chrome-handler';

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

/** 자동 감지 초기화 */
export function autoInitExtensionClient(extensionId: string): void {
  // 브라우저 환경이 아니거나 chrome API가 없으면 초기화하지 않음
  if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
    console.warn('[Extension Client] Chrome API not available');
    return;
  }

  initChromeExtensionClient(extensionId);
}
```

### spa/src/lib/extension-client/index.ts

```typescript
export type { IExtensionHandler, ExtensionState } from './types';
export { ChromeHandler } from './chrome-handler';
export {
  initExtensionClient,
  getExtensionClient,
  initChromeExtensionClient,
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

## 완료 기준

- [x] ChromeHandler: Extension과 정상 통신
- [x] autoInitExtensionClient: Chrome API 없으면 초기화 스킵
- [x] DI 패턴으로 테스트 가능한 구조

## 참조 문서

- spec/03-spa-structure.md Section 7 (Extension Client DI 기반)
