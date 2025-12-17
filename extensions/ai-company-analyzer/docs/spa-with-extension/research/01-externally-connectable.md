# externally_connectable 기술 조사

## 개요

Chrome Extension과 외부 웹페이지(SPA) 간 통신을 위한 `externally_connectable` API 조사.

## 1. 기본 개념

### 1.1 externally_connectable이란?

- Chrome Extension이 **외부 웹페이지**와 메시지를 주고받을 수 있게 하는 manifest 설정
- Content Script 없이도 웹페이지에서 직접 Extension과 통신 가능
- 보안상 **명시적으로 허용된 도메인**만 통신 가능

### 1.2 대안 비교

| 방식 | 장점 | 단점 |
|------|------|------|
| **externally_connectable** | 직접 통신, 빠름 | 도메인 제한 필요 |
| Content Script + postMessage | 유연함 | 복잡, 오버헤드 |
| Native Messaging | 강력함 | 네이티브 앱 필요 |

## 2. manifest.json 설정

### 2.1 기본 설정

```json
{
  "externally_connectable": {
    "matches": ["https://username.github.io/*"]
  }
}
```

### 2.2 중요 제한사항

```json
// ❌ 불가능 - 와일드카드 서브도메인
{
  "matches": ["https://*.github.io/*"]
}

// ✅ 가능 - 정확한 도메인
{
  "matches": ["https://username.github.io/*"]
}

// ✅ 가능 - 여러 도메인
{
  "matches": [
    "https://username.github.io/*",
    "http://localhost:*/*"
  ]
}
```

### 2.3 왜 와일드카드가 안 되나?

- **보안**: `*.github.io`는 모든 GitHub Pages 사용자를 허용하게 됨
- **악용 가능성**: 악성 페이지가 Extension과 통신할 수 있음
- Chrome 정책으로 **서브도메인 와일드카드 금지**

## 3. 통신 API

### 3.1 SPA → Extension (외부에서 요청)

```typescript
// SPA에서 Extension으로 메시지 전송
const EXTENSION_ID = 'abcdefghijklmnopqrstuvwxyz123456';

// 단순 요청
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'GET_COMPANIES'
}, (response) => {
  console.log('응답:', response);
});

// async/await 사용
async function sendToExtension(message: object): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(EXTENSION_ID, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}
```

### 3.2 Extension에서 수신

```typescript
// Service Worker (background.ts)
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    // sender.url로 요청 출처 확인
    console.log('외부 메시지:', message);
    console.log('발신자:', sender.url);

    // 비동기 응답
    handleExternalMessage(message)
      .then(sendResponse);

    return true; // 비동기 응답 표시 (필수!)
  }
);
```

### 3.3 Extension → SPA (푸시)

```typescript
// 연결 기반 통신 (양방향)
// SPA에서
const port = chrome.runtime.connect(EXTENSION_ID, { name: 'main' });
port.onMessage.addListener((msg) => {
  console.log('Extension에서 푸시:', msg);
});

// Extension에서
chrome.runtime.onConnectExternal.addListener((port) => {
  // 나중에 푸시 가능
  port.postMessage({ type: 'STATUS_UPDATE', data: '...' });
});
```

## 4. 보안 고려사항

### 4.1 sender.url 검증 (필수)

```typescript
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    // 허용된 도메인만 처리
    const ALLOWED_ORIGINS = [
      'https://username.github.io',
      'http://localhost:5173', // 개발용
    ];

    const senderOrigin = new URL(sender.url || '').origin;

    if (!ALLOWED_ORIGINS.includes(senderOrigin)) {
      sendResponse({ error: 'Unauthorized origin' });
      return;
    }

    // 정상 처리
    handleMessage(message).then(sendResponse);
    return true;
  }
);
```

### 4.2 메시지 유형 검증

```typescript
const ALLOWED_MESSAGE_TYPES = [
  'GET_COMPANIES',
  'GET_IMAGES',
  'GET_IMAGE_BLOB',
  'SAVE_ANALYSIS',
];

if (!ALLOWED_MESSAGE_TYPES.includes(message.type)) {
  sendResponse({ error: 'Unknown message type' });
  return;
}
```

### 4.3 Rate Limiting (선택)

```typescript
const requestCounts = new Map<string, number>();
const RATE_LIMIT = 100; // 분당 요청 수
const RATE_WINDOW = 60000; // 1분

function checkRateLimit(origin: string): boolean {
  const count = requestCounts.get(origin) || 0;
  if (count >= RATE_LIMIT) return false;
  requestCounts.set(origin, count + 1);
  return true;
}

// 주기적 리셋
setInterval(() => requestCounts.clear(), RATE_WINDOW);
```

## 5. 에러 처리

### 5.1 Extension 미설치 감지 (SPA)

```typescript
async function checkExtensionInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(EXTENSION_ID, { type: 'PING' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    } catch {
      resolve(false);
    }
  });
}
```

### 5.2 연결 끊김 처리

```typescript
// SPA에서
port.onDisconnect.addListener(() => {
  console.log('Extension 연결 끊김');
  // 재연결 시도 또는 사용자에게 알림
});
```

## 6. 개발 환경 설정

### 6.1 localhost 허용

```json
{
  "externally_connectable": {
    "matches": [
      "https://username.github.io/*",
      "http://localhost:*/*",
      "http://127.0.0.1:*/*"
    ]
  }
}
```

### 6.2 Extension ID 고정 (개발용)

```json
// manifest.json
{
  "key": "MIIBIjANBgkqhki..."  // 고정 키
}
```

키 생성 방법:
```bash
# 개인키 생성
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem

# 공개키 추출
openssl rsa -in key.pem -pubout -outform DER | base64 -w 0
```

## 7. 참고 자료

- [Chrome Extension externally_connectable](https://developer.chrome.com/docs/extensions/mv3/manifest/externally_connectable/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Security Best Practices](https://developer.chrome.com/docs/extensions/mv3/security/)

## 8. 결론

### 장점
- 직접적인 통신으로 빠름
- Content Script 불필요
- 공식 API로 안정적

### 주의점
- `*.github.io` 와일드카드 불가 → 정확한 도메인 지정 필수
- sender.url 검증 필수
- Extension ID가 변경되면 SPA 코드 수정 필요

### 권장 사항
1. 프로덕션: `https://username.github.io/*`
2. 개발: `http://localhost:*/*` 추가
3. sender.url 검증 항상 수행
4. Extension ID 고정 (key 설정)
