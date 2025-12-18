# Feature 05: External API 기본 구조 (PING, GET_STATS)

## 개요

Extension의 External API 기본 구조를 설정하고 PING, GET_STATS 엔드포인트를 구현합니다.

## 범위

- external-api.ts 기본 구조
- 보안 검증 로직 (sender.url 체크)
- PING, GET_STATS 엔드포인트

## 의존성

- Feature 04: Extension DB Setup

## 구현 상세

### extension/src/background/external-api.ts

```typescript
import type {
  MessageType,
  MessagePayload,
  MessageResponse,
  ApiResponse,
  ErrorCode,
} from '@shared/types';
import { getStats } from '@/lib/storage';

/** 허용된 Origin 목록 */
const ALLOWED_ORIGINS = [
  'https://username.github.io',  // GitHub Pages
  'http://localhost:5173',       // 개발용
  'http://127.0.0.1:5173',       // 개발용
];

/** Extension 버전 */
const EXTENSION_VERSION = '1.0.0';

/** Origin 검증 */
function isAllowedOrigin(senderUrl: string | undefined): boolean {
  if (!senderUrl) return false;

  try {
    const origin = new URL(senderUrl).origin;
    return ALLOWED_ORIGINS.some(allowed => {
      if (allowed.includes('localhost') || allowed.includes('127.0.0.1')) {
        return origin.startsWith('http://localhost:') ||
               origin.startsWith('http://127.0.0.1:');
      }
      return origin === allowed || origin.startsWith(allowed);
    });
  } catch {
    return false;
  }
}

/** 성공 응답 생성 */
function success<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

/** 에러 응답 생성 */
function error(code: ErrorCode, message: string): ApiResponse<never> {
  return { success: false, error: { code, message } };
}

/** 메시지 핸들러 타입 */
type MessageHandler<T extends MessageType> = (
  payload: MessagePayload[T]
) => Promise<MessageResponse[T]>;

/** 핸들러 레지스트리 */
const handlers: Partial<{ [K in MessageType]: MessageHandler<K> }> = {};

/** 핸들러 등록 */
export function registerHandler<T extends MessageType>(
  type: T,
  handler: MessageHandler<T>
): void {
  handlers[type] = handler as any;
}

/** External API 초기화 */
export function initExternalApi(): void {
  chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {
      // 1. Origin 검증
      if (!isAllowedOrigin(sender.url)) {
        sendResponse(error('UNAUTHORIZED', 'Origin not allowed'));
        return;
      }

      // 2. 메시지 타입 검증
      const { type, payload } = message as { type: MessageType; payload?: any };

      if (!type || !(type in handlers)) {
        sendResponse(error('INVALID_PAYLOAD', `Unknown message type: ${type}`));
        return;
      }

      // 3. 핸들러 실행
      const handler = handlers[type];
      if (handler) {
        handler(payload)
          .then(data => sendResponse(success(data)))
          .catch(err => {
            console.error(`[External API] ${type} error:`, err);
            sendResponse(error('INTERNAL_ERROR', err.message || 'Unknown error'));
          });
      }

      // 비동기 응답을 위해 true 반환
      return true;
    }
  );

  // 기본 핸들러 등록
  registerBasicHandlers();

  console.log('[External API] Initialized');
}

/** 기본 핸들러 등록 */
function registerBasicHandlers(): void {
  // PING
  registerHandler('PING', async () => ({
    version: EXTENSION_VERSION,
    timestamp: new Date().toISOString(),
  }));

  // GET_STATS
  registerHandler('GET_STATS', async () => {
    const stats = await getStats();
    return stats;
  });
}
```

### extension/src/background/index.ts 업데이트

```typescript
import { initExternalApi } from './external-api';

// Service Worker 초기화
console.log('AI Company Analyzer Extension loaded');

// External API 초기화
initExternalApi();

export {};
```

## 테스트

### SPA에서 연결 테스트

```typescript
// 개발 콘솔에서 테스트
const EXTENSION_ID = 'your-extension-id';

// PING 테스트
chrome.runtime.sendMessage(EXTENSION_ID, { type: 'PING' }, (response) => {
  console.log('PING response:', response);
  // { success: true, data: { version: '1.0.0', timestamp: '...' } }
});

// GET_STATS 테스트
chrome.runtime.sendMessage(EXTENSION_ID, { type: 'GET_STATS' }, (response) => {
  console.log('STATS response:', response);
  // { success: true, data: { totalCompanies: 0, totalImages: 0, ... } }
});
```

## 완료 기준

- [ ] chrome.runtime.onMessageExternal 리스너 등록됨
- [ ] 허용되지 않은 Origin에서 요청 시 UNAUTHORIZED 에러
- [ ] PING 요청 시 버전과 타임스탬프 응답
- [ ] GET_STATS 요청 시 통계 데이터 응답
- [ ] SPA에서 PING 테스트 성공

## 참조 문서

- spec/02-extension-api.md Section 2 (통신 프로토콜)
- spec/02-extension-api.md Section 5 (보안 검증)
