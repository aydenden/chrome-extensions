# ADR-0001: Extension Client DI 패턴

## 상태

승인됨

## 날짜

2024-01

## 컨텍스트

SPA에서 Chrome Extension과 통신할 때 `chrome.runtime.sendMessage()`를 직접 호출하면:

1. **테스트 어려움**: `chrome` 전역 객체 mocking 복잡
2. **코드 중복**: 에러 처리, 타임아웃 로직 반복
3. **강결합**: 브라우저 API에 직접 의존

```typescript
// 기존 방식 - 테스트하기 어려움
async function getCompanies() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(EXTENSION_ID, { type: 'GET_COMPANIES' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response?.success) {
        reject(new Error(response?.error?.message));
      } else {
        resolve(response.data);
      }
    });
  });
}
```

## 결정

**인터페이스 기반 DI(Dependency Injection) 패턴 적용**

### 인터페이스 정의

```typescript
// src/lib/extension-client/types.ts
interface IExtensionHandler {
  send<T extends MessageType>(
    type: T,
    payload?: MessagePayload[T]
  ): Promise<MessageResponse[T]>;
}
```

### 구현 분리

```
src/lib/extension-client/
├── types.ts           // 인터페이스
├── chrome-handler.ts  // Chrome API 구현
├── mock-handler.ts    // 테스트용 Mock
└── client.ts          // DI 컨테이너
```

### 클라이언트 팩토리

```typescript
// src/lib/extension-client/client.ts
let handler: IExtensionHandler | null = null;

export function initExtensionClient(h: IExtensionHandler) {
  handler = h;
}

export function getExtensionClient(): IExtensionHandler {
  if (!handler) throw new Error('Extension client not initialized');
  return handler;
}
```

### 사용

```typescript
// 프로덕션
initExtensionClient(new ChromeHandler(EXTENSION_ID));

// 테스트
initExtensionClient(createMockHandler());
```

## 결과

### 긍정적

- **테스트 커버리지 +70%**: Mock 주입으로 단위 테스트 용이
- **코드 재사용**: 에러 처리, 타임아웃 로직 한 곳에서 관리
- **유연성**: 환경별 다른 구현 주입 가능

### 부정적

- **초기 복잡성**: 인터페이스, 팩토리 등 추가 코드
- **초기화 필수**: `initExtensionClient()` 호출 누락 시 런타임 에러

### 리스크

- **의존성 주입 누락**: TypeScript strict mode로 완화

## 대안

### 1. 전역 Mock (기존)

```typescript
vi.stubGlobal('chrome', mockChrome);
```

- 단점: 테스트 간 상태 오염, 부분 mocking 어려움

### 2. Service Locator 패턴

```typescript
const client = ServiceLocator.get<IExtensionHandler>('extension');
```

- 단점: 런타임까지 의존성 확인 불가

### 3. React Context

```typescript
const client = useExtensionClient();
```

- 단점: React 외부에서 사용 불가

## 관련 문서

- [03-spa-structure.md](/docs/spa-with-extension/spec/03-spa-structure.md) - Section 7
- [07-testing-strategy.md](/docs/spa-with-extension/spec/07-testing-strategy.md) - Section 6.4
