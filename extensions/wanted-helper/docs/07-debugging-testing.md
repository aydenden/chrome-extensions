# 디버깅과 테스트

## 목차
- [디버깅 도구](#디버깅-도구)
- [컴포넌트별 디버깅](#컴포넌트별-디버깅)
- [일반적인 문제와 해결](#일반적인-문제와-해결)
- [로깅 전략](#로깅-전략)
- [테스트 방법](#테스트-방법)

## 디버깅 도구

### Chrome DevTools

모든 크롬 익스텐션 디버깅의 기본 도구입니다.

#### 확장 프로그램 관리 페이지
```
chrome://extensions/
```

**주요 기능**:
- 개발자 모드 활성화
- 확장 프로그램 로드/새로고침
- 에러 확인 (Errors 버튼)
- 각 컴포넌트 검사

### 확장 프로그램 로드하기

1. `chrome://extensions/` 열기
2. **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 프로젝트 루트 디렉토리 선택

### 코드 변경 후 리로드

```bash
# 1. 코드 변경
# 2. 빌드
npm run build

# 3. chrome://extensions/에서 새로고침 버튼 클릭
```

**팁**: 빌드를 자동화하려면
```bash
# watch 모드로 개발
npm run build -- --watch

# 또는 package.json에 스크립트 추가
"scripts": {
  "dev": "tsc --watch"
}
```

## 컴포넌트별 디버깅

### 1. Service Worker 디버깅

```
chrome://extensions/ → 확장 프로그램 찾기 → "Service Worker" 클릭
```

```javascript
// background.js
console.log('Service Worker started');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Installed:', details.reason);
  console.log('Previous version:', details.previousVersion);
});

// 에러 추적
try {
  await someRiskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  console.trace(); // 스택 트레이스
}
```

**Service Worker 특징**:
- 비활성 상태일 수 있음
- DevTools를 열면 활성화됨
- 로그를 보려면 DevTools를 먼저 열어야 함

### 2. Content Script 디버깅

**방법 1: 페이지 DevTools에서**
```
페이지에서 F12 → Sources 탭 → Content scripts
```

```javascript
// content.js
console.log('Content script loaded on:', window.location.href);

// 특정 이벤트 디버깅
document.addEventListener('click', (e) => {
  console.log('Clicked:', e.target);
  debugger; // 중단점
});

// DOM 변화 추적
const observer = new MutationObserver((mutations) => {
  console.log('DOM changed:', mutations.length, 'mutations');
  console.table(mutations);
});
```

**방법 2: 중단점 사용**
```javascript
function processElement(element) {
  debugger; // 여기서 멈춤
  // 검사하고 싶은 코드
}
```

### 3. Popup 디버깅

```
확장 프로그램 아이콘 우클릭 → "팝업 검사"
```

```javascript
// popup.js
console.log('Popup opened');

document.getElementById('btn').addEventListener('click', () => {
  console.log('Button clicked');
  debugger; // 중단점
});

// 에러 경계
window.addEventListener('error', (e) => {
  console.error('Popup error:', e.error);
});
```

**주의**: Popup을 닫으면 DevTools도 닫힙니다.

### 4. Options Page 디버깅

일반 웹 페이지처럼 디버깅합니다.
```
Options 페이지에서 F12
```

## 일반적인 문제와 해결

### 문제 1: Manifest 에러

**증상**: 확장 프로그램이 로드되지 않음

**원인**:
```json
{
  "manifest_version": 3,
  "name": "My Extension"
  // ❌ version 누락
}
```

**해결**:
```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0"  // ✅ 추가
}
```

**디버깅**:
- `chrome://extensions/`의 에러 메시지 확인
- JSON 유효성 검사 (VS Code에서 자동으로 확인됨)

### 문제 2: Content Script가 실행 안 됨

**디버깅 체크리스트**:

```javascript
// 1. 스크립트가 로드되는지 확인
console.log('Script loaded!');

// 2. URL 매칭 확인
console.log('Current URL:', window.location.href);

// 3. 권한 확인
chrome.storage.sync.get(null, (result) => {
  if (chrome.runtime.lastError) {
    console.error('Permission error:', chrome.runtime.lastError);
  }
});
```

**자주 하는 실수**:
```json
{
  "content_scripts": [{
    "matches": ["https://www.wanted.co.kr"],  // ❌ 패턴 잘못됨
    "js": ["content.js"]
  }]
}
```

**올바른 예**:
```json
{
  "content_scripts": [{
    "matches": ["https://www.wanted.co.kr/*"],  // ✅ 와일드카드 필요
    "js": ["dist/index.js"]  // ✅ 빌드된 파일 경로
  }]
}
```

### 문제 3: Storage 데이터가 없음

```javascript
// 디버깅
chrome.storage.sync.get(null, (result) => {
  console.log('All storage data:', result);
  console.log('Keys:', Object.keys(result));

  if (Object.keys(result).length === 0) {
    console.warn('Storage is empty!');
  }
});

// Storage 사용량 확인
chrome.storage.sync.getBytesInUse(null, (bytes) => {
  console.log('Storage used:', bytes, 'bytes');
});
```

### 문제 4: 메시지가 전달 안 됨

```javascript
// 발신자
chrome.runtime.sendMessage({ action: 'test' }, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Send error:', chrome.runtime.lastError.message);
    // "Receiving end does not exist" → 리스너 없음
    // "Extension context invalidated" → 확장 프로그램 리로드됨
  } else {
    console.log('Response:', response);
  }
});

// 수신자
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  console.log('From:', sender.tab?.url || sender.id);

  sendResponse({ received: true });
  return true; // 비동기 응답을 위해 필수!
});
```

### 문제 5: MutationObserver가 작동 안 함

```javascript
const observer = new MutationObserver((mutations) => {
  console.log('Mutations:', mutations.length);

  // 어떤 변경이 감지되었는지 확인
  mutations.forEach((mutation, index) => {
    console.log(`Mutation ${index}:`, {
      type: mutation.type,
      target: mutation.target,
      addedNodes: mutation.addedNodes.length,
      removedNodes: mutation.removedNodes.length
    });
  });
});

// 설정 확인
const config = {
  childList: true,
  subtree: true
};
console.log('Observer config:', config);

const target = document.body;
console.log('Observing:', target);

observer.observe(target, config);
```

## 로깅 전략

### 1. 환경별 로깅

```typescript
// utils/logger.ts
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[LOG]', ...args);
    }
  },

  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },

  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
    // 프로덕션에서도 에러는 기록
  },

  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', ...args);
      console.trace();
    }
  }
};

// 사용
import { logger } from './utils/logger';

logger.log('Processing data:', data);
logger.error('Failed to save:', error);
```

### 2. 구조화된 로깅

```typescript
function logAction(action: string, details: any) {
  console.log({
    timestamp: new Date().toISOString(),
    action,
    details,
    url: window.location.href
  });
}

// 사용
logAction('CARD_FILTERED', {
  blockedCount: 5,
  totalCount: 20
});
```

### 3. 성능 측정

```typescript
// 시작
console.time('operation');

// 작업 수행
await heavyOperation();

// 종료
console.timeEnd('operation'); // "operation: 1234.56ms"

// 더 자세한 측정
performance.mark('start');
await operation();
performance.mark('end');
performance.measure('operation', 'start', 'end');

const measure = performance.getEntriesByName('operation')[0];
console.log('Duration:', measure.duration, 'ms');
```

## 테스트 방법

### 1. 수동 테스트 체크리스트

```markdown
## Content Script 테스트
- [ ] 확장 프로그램 로드됨
- [ ] 대상 페이지에서 스크립트 실행됨
- [ ] DOM 조작이 올바르게 적용됨
- [ ] 에러 없이 동작함

## Storage 테스트
- [ ] 데이터 저장됨
- [ ] 데이터 읽기 성공
- [ ] 데이터 삭제 성공
- [ ] 여러 탭에서 동기화됨

## UI 테스트
- [ ] 버튼이 올바른 위치에 표시됨
- [ ] 클릭 이벤트 작동함
- [ ] 상태에 따라 텍스트 변경됨

## 호환성 테스트
- [ ] Chrome 최신 버전
- [ ] Chrome 이전 버전
- [ ] 다양한 화면 크기
```

### 2. 자동화 테스트 (고급)

```typescript
// __tests__/storage.test.ts
import { getBlockedIds, addBlockedId } from '../src/shared/storage';

// Chrome API 목킹
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
} as any;

describe('Storage', () => {
  test('should get blocked IDs', async () => {
    (chrome.storage.sync.get as jest.Mock).mockImplementation((keys, callback) => {
      callback({ companyIds: ['1', '2', '3'] });
    });

    const ids = await getBlockedIds();
    expect(ids).toEqual(['1', '2', '3']);
  });
});
```

### 3. E2E 테스트

```javascript
// Puppeteer로 자동화 테스트
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=/path/to/extension`,
      `--load-extension=/path/to/extension`
    ]
  });

  const page = await browser.newPage();
  await page.goto('https://www.wanted.co.kr/');

  // 확장 프로그램 동작 확인
  await page.waitForSelector('.filtered-card');

  const opacity = await page.$eval('.filtered-card', el => {
    return window.getComputedStyle(el).opacity;
  });

  console.log('Opacity:', opacity); // "0.5" 기대

  await browser.close();
})();
```

## 디버깅 팁

### 1. 네트워크 요청 확인

```javascript
// 모든 fetch 요청 로깅
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('Fetch:', args[0]);
  return originalFetch.apply(this, args);
};
```

### 2. 이벤트 리스너 확인

```javascript
// Chrome DevTools Console에서
getEventListeners(document.getElementById('myButton'));
```

### 3. Storage 실시간 모니터링

```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.group('Storage Changed:', areaName);
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(`${key}:`, oldValue, '→', newValue);
  }
  console.groupEnd();
});
```

### 4. 조건부 중단점

```javascript
function processItem(item) {
  // 특정 조건에서만 멈춤
  if (item.id === '123') {
    debugger;
  }
  // 처리...
}
```

## 참고 자료

- [Chrome DevTools Documentation](https://developer.chrome.com/docs/devtools/)
- [Debug Extensions](https://developer.chrome.com/docs/extensions/get-started/tutorial/debug)

## 다음 단계

- **[보안과 권한](./08-security-permissions.md)** - 안전한 확장 프로그램 만들기
