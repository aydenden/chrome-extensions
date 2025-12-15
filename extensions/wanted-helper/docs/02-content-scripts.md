# Content Scripts

## 목차
- [Content Scripts란?](#content-scripts란)
- [작동 원리](#작동-원리)
- [주입 방법](#주입-방법)
- [접근 가능한 API](#접근-가능한-api)
- [격리된 월드 (Isolated Worlds)](#격리된-월드-isolated-worlds)
- [호스트 페이지와의 통신](#호스트-페이지와의-통신)
- [현재 프로젝트 예시](#현재-프로젝트-예시)
- [베스트 프랙티스](#베스트-프랙티스)

## Content Scripts란?

Content Scripts는 **웹 페이지의 컨텍스트에서 실행되는 JavaScript 파일**입니다. 표준 DOM을 사용하여 브라우저가 방문하는 웹 페이지의 세부 정보를 읽고, 변경하며, 정보를 확장 프로그램으로 전달할 수 있습니다.

### 주요 특징
- 웹 페이지의 DOM에 직접 접근 가능
- 페이지의 JavaScript와 격리된 환경에서 실행
- 특정 Chrome Extension API에 접근 가능
- 확장 프로그램의 다른 부분과 메시지로 통신

## 작동 원리

```
┌─────────────────────────────────────────┐
│         Chrome Extension                 │
│  ┌────────────┐      ┌────────────┐    │
│  │  Background │◄────►│   Popup    │    │
│  │   Worker   │      │            │    │
│  └──────┬─────┘      └────────────┘    │
│         │                                │
│         │ Message Passing                │
│         ▼                                │
│  ┌────────────┐                         │
│  │  Content   │                         │
│  │  Script    │                         │
│  └──────┬─────┘                         │
└─────────┼─────────────────────────────┘
          │
          │ DOM Access
          ▼
  ┌──────────────┐
  │  Web Page    │
  │    (DOM)     │
  └──────────────┘
```

## 주입 방법

### 1. 정적 선언 (Static Declaration)

가장 일반적인 방법으로, `manifest.json`에 선언합니다.

```json
{
  "content_scripts": [
    {
      "matches": ["https://www.wanted.co.kr/*"],
      "js": ["dist/index.js"],
      "css": ["styles.css"],
      "run_at": "document_idle"
    }
  ]
}
```

#### 옵션 설명

**matches** (필수)
- URL 패턴을 지정하여 어떤 페이지에서 실행할지 결정
- 예시:
  - `"https://www.wanted.co.kr/*"` - 원티드의 모든 페이지
  - `"<all_urls>"` - 모든 페이지 (권장하지 않음)
  - `"*://*.google.com/*"` - 모든 Google 도메인

**run_at** (선택)
- `"document_start"` - CSS 로드 전, DOM 생성 전
- `"document_end"` - DOM 완성 후, 이미지 로드 전 (기본값)
- `"document_idle"` - `window.onload` 직후 (권장)

**css** (선택)
- 페이지에 주입할 CSS 파일

**all_frames** (선택)
- `true`: 모든 iframe에도 주입
- `false`: 최상위 프레임에만 주입 (기본값)

### 2. 동적 등록 (Dynamic Registration)

런타임에 Content Script를 등록합니다.

```javascript
// Service Worker나 다른 확장 페이지에서
chrome.scripting.registerContentScripts([
  {
    id: "dynamic-script",
    matches: ["https://www.wanted.co.kr/*"],
    js: ["content.js"],
    runAt: "document_idle"
  }
]);
```

### 3. 프로그래밍 방식 (Programmatic Injection)

특정 이벤트에 응답하여 스크립트를 주입합니다.

```javascript
// 버튼 클릭 등의 이벤트 발생 시
chrome.scripting.executeScript({
  target: { tabId: tabId },
  files: ["content.js"]
});

// 또는 인라인 함수 실행
chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: () => {
    document.body.style.backgroundColor = "red";
  }
});
```

## 접근 가능한 API

### 직접 접근 가능
Content Scripts는 다음 Chrome API에 직접 접근할 수 있습니다:

```javascript
// ✅ 사용 가능한 API
chrome.dom                    // DOM 조작
chrome.i18n                   // 국제화
chrome.storage                // 데이터 저장
chrome.runtime.connect()      // 연결 생성
chrome.runtime.getManifest()  // Manifest 읽기
chrome.runtime.getURL()       // 리소스 URL 얻기
chrome.runtime.id             // 확장 프로그램 ID
chrome.runtime.sendMessage()  // 메시지 전송
chrome.runtime.onMessage      // 메시지 수신
```

### 간접 접근 필요
다른 API는 메시지 전달을 통해 Service Worker에 요청해야 합니다:

```javascript
// Content Script에서
chrome.runtime.sendMessage(
  { action: "createTab", url: "https://example.com" },
  (response) => {
    console.log("Tab created:", response);
  }
);

// Service Worker에서
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "createTab") {
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ tabId: tab.id });
    });
    return true; // 비동기 응답을 위해 필수
  }
});
```

## 격리된 월드 (Isolated Worlds)

Content Script는 **격리된 실행 환경**에서 동작합니다.

### 격리의 의미

```javascript
// 웹 페이지의 JavaScript
var pageVariable = "I'm in the page";
function pageFunction() {
  console.log("Page function");
}

// Content Script
console.log(typeof pageVariable);  // "undefined"
console.log(typeof pageFunction);  // "undefined"

// Content Script의 변수도 페이지에서 접근 불가
var contentVariable = "I'm in content script";
```

### DOM은 공유됨

```javascript
// Content Script에서 DOM 조작
document.body.style.backgroundColor = "lightblue";

// ✅ 웹 페이지에서 즉시 보임
// DOM 자체는 공유되지만, JavaScript 실행 환경은 분리됨
```

### 격리의 장점
1. **보안**: 악의적인 페이지 스크립트로부터 보호
2. **안정성**: 페이지 코드와의 충돌 방지
3. **예측 가능성**: 페이지의 전역 변수가 확장 프로그램에 영향 없음

## 호스트 페이지와의 통신

격리된 환경이지만, `window.postMessage()`를 통해 통신할 수 있습니다.

### 페이지에서 Content Script로 메시지 보내기

```javascript
// 웹 페이지 JavaScript
window.postMessage(
  { type: "FROM_PAGE", data: "Hello from page" },
  "*"
);

// Content Script
window.addEventListener("message", (event) => {
  // 보안: 출처 확인
  if (event.source !== window) return;

  if (event.data.type === "FROM_PAGE") {
    console.log("Received:", event.data.data);
  }
});
```

### Content Script에서 페이지로 메시지 보내기

```javascript
// Content Script
window.postMessage(
  { type: "FROM_CONTENT_SCRIPT", data: "Hello from extension" },
  "*"
);

// 웹 페이지 JavaScript
window.addEventListener("message", (event) => {
  if (event.data.type === "FROM_CONTENT_SCRIPT") {
    console.log("Received:", event.data.data);
  }
});
```

### ⚠️ 보안 주의사항

```javascript
// ❌ 위험: 모든 메시지를 신뢰
window.addEventListener("message", (event) => {
  eval(event.data.code); // 절대 하지 말 것!
});

// ✅ 안전: 출처 검증 및 데이터 검증
window.addEventListener("message", (event) => {
  // 1. 출처 확인
  if (event.source !== window) return;

  // 2. 메시지 타입 확인
  if (!event.data.type) return;

  // 3. 허용된 타입만 처리
  const allowedTypes = ["TYPE_A", "TYPE_B"];
  if (!allowedTypes.includes(event.data.type)) return;

  // 4. 데이터 검증
  if (typeof event.data.value !== "string") return;

  // 안전하게 처리
  console.log("Safe data:", event.data.value);
});
```

## 현재 프로젝트 예시

### Manifest 설정

```json
{
  "content_scripts": [
    {
      "matches": ["https://www.wanted.co.kr/*"],
      "js": ["dist/index.js"]
    }
  ]
}
```

### 실제 코드 패턴 (`src/index.ts`)

```typescript
// 1. Storage에서 데이터 로드
chrome.storage.sync.get(['companyIds', 'positionIds'], (result) => {
  const companyIds = result.companyIds || [];
  const positionIds = result.positionIds || [];

  // 2. 페이지 업데이트
  updateCardStyles(companyIds, positionIds);
});

// 3. DOM 조작
function updateCardStyles(companyIds: string[], positionIds: string[]) {
  const cards = document.querySelectorAll('#__next > div > div > ul > li > div > a');

  cards.forEach((card) => {
    const companyId = card.getAttribute('data-company-id');
    const positionId = card.getAttribute('data-position-id');

    if (companyIds.includes(companyId) || positionIds.includes(positionId)) {
      // @ts-ignore
      card.style.opacity = '0.5';
    }
  });
}

// 4. MutationObserver로 동적 변경 감지
const observer = new MutationObserver(
  debounce(() => {
    // URL 변경 감지 및 처리
    detectPageAndAct();
  }, 100)
);

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

### 현재 프로젝트의 Content Script 특징

#### ✅ 잘된 점
1. **Storage API 활용**: 데이터를 안전하게 저장
2. **MutationObserver 사용**: Next.js의 클라이언트 사이드 라우팅 대응
3. **Debounce 적용**: 성능 최적화

#### 🔧 개선 가능한 점
1. **에러 처리 추가**
   ```typescript
   chrome.storage.sync.get(['companyIds'], (result) => {
     if (chrome.runtime.lastError) {
       console.error('Storage error:', chrome.runtime.lastError);
       return;
     }
     // 정상 처리
   });
   ```

2. **선택자 안정성**
   ```typescript
   // 현재: 깨지기 쉬운 선택자
   const cards = document.querySelectorAll('#__next > div > div > ul > li > div > a');

   // 개선: 더 안정적인 선택자
   const cards = document.querySelectorAll('[data-company-id], [data-position-id]');
   ```

3. **코드 모듈화**
   ```typescript
   // storage.ts
   export async function getBlockedIds() {
     return new Promise((resolve) => {
       chrome.storage.sync.get(['companyIds', 'positionIds'], resolve);
     });
   }

   // dom.ts
   export function updateCardStyles(ids) {
     // ...
   }

   // index.ts
   import { getBlockedIds } from './storage';
   import { updateCardStyles } from './dom';
   ```

## 베스트 프랙티스

### 1. 경량화
```javascript
// ❌ 나쁨: 큰 라이브러리 전체 로드
import _ from 'lodash';

// ✅ 좋음: 필요한 함수만 로드
import { debounce } from 'lodash/debounce';
```

### 2. 조건부 실행
```javascript
// 특정 페이지에서만 실행
if (window.location.pathname.startsWith('/wd/')) {
  initPositionPage();
}
```

### 3. 리소스 정리
```javascript
// Observer나 이벤트 리스너 정리
let observer;

function init() {
  observer = new MutationObserver(callback);
  observer.observe(document.body, config);
}

// 페이지 이탈 시 정리
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
  }
});
```

### 4. 안전한 DOM 접근
```javascript
// ❌ 위험: DOM이 준비되지 않을 수 있음
const element = document.querySelector('.target');
element.textContent = "Changed";

// ✅ 안전: null 체크
const element = document.querySelector('.target');
if (element) {
  element.textContent = "Changed";
}
```

### 5. eval() 사용 금지
```javascript
// ❌ 절대 금지
eval(someCode);
new Function(someCode)();

// ✅ 대안 사용
JSON.parse(someData);
```

### 6. XSS 방지
```javascript
// ❌ 위험: 사용자 입력을 직접 삽입
element.innerHTML = userInput;

// ✅ 안전: textContent 사용
element.textContent = userInput;

// ✅ 안전: 새 요소 생성
const div = document.createElement('div');
div.textContent = userInput;
element.appendChild(div);
```

### 7. 성능 최적화
```javascript
// ❌ 비효율: 반복문에서 DOM 조작
for (let i = 0; i < data.length; i++) {
  const div = document.createElement('div');
  div.textContent = data[i];
  container.appendChild(div); // Reflow 여러 번 발생
}

// ✅ 효율적: DocumentFragment 사용
const fragment = document.createDocumentFragment();
for (let i = 0; i < data.length; i++) {
  const div = document.createElement('div');
  div.textContent = data[i];
  fragment.appendChild(div);
}
container.appendChild(fragment); // Reflow 한 번만 발생
```

## 디버깅

Content Script 디버깅 방법:

1. **페이지에서 DevTools 열기** (F12)
2. **Sources 탭**에서 Content Script 파일 찾기
3. 중단점 설정 및 디버깅
4. **Console**에서 직접 테스트

```javascript
// Console에서 실행 가능
chrome.runtime.sendMessage({ action: "test" }, (response) => {
  console.log("Response:", response);
});
```

## 참고 자료

- [Chrome for Developers - Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Content Scripts Best Practices](https://developer.chrome.com/docs/webstore/best-practices)

## 다음 단계

Content Scripts를 이해했다면, 다음을 학습하세요:
- **[Storage API](./03-storage-api.md)** - 데이터 저장 방법
- **[메시지 전달](./04-messaging.md)** - 컴포넌트 간 통신
