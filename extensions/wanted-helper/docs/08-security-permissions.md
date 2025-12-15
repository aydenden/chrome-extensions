# 보안과 권한

## 목차
- [권한 관리](#권한-관리)
- [Content Security Policy](#content-security-policy)
- [보안 베스트 프랙티스](#보안-베스트-프랙티스)
- [일반적인 보안 위협](#일반적인-보안-위협)
- [현재 프로젝트 보안 점검](#현재-프로젝트-보안-점검)

## 권한 관리

### 최소 권한 원칙 (Principle of Least Privilege)

**필요한 권한만 요청하세요.** 사용자는 과도한 권한 요청을 신뢰하지 않습니다.

```json
// ❌ 나쁨: 필요 없는 권한
{
  "permissions": [
    "tabs",           // 모든 탭 정보
    "webRequest",     // 네트워크 요청 감시
    "cookies",        // 쿠키 접근
    "history",        // 방문 기록
    "<all_urls>"      // 모든 사이트 접근
  ]
}

// ✅ 좋음: 필요한 것만
{
  "permissions": [
    "storage",        // 데이터 저장만 필요
    "activeTab"       // 활성 탭만 필요
  ],
  "host_permissions": [
    "https://www.wanted.co.kr/*"  // 특정 사이트만
  ]
}
```

### 주요 권한 설명

#### storage
```json
{
  "permissions": ["storage"]
}
```
- `chrome.storage` API 사용
- 위험도: 낮음
- 사용자에게 경고 없음

#### activeTab
```json
{
  "permissions": ["activeTab"]
}
```
- 사용자가 확장 프로그램과 상호작용할 때만 활성 탭 접근
- 위험도: 낮음
- 사용자 클릭 시에만 작동

#### tabs
```json
{
  "permissions": ["tabs"]
}
```
- 모든 탭의 URL, 제목 등 읽기
- 위험도: 중간
- 개인정보 우려

#### host_permissions
```json
{
  "host_permissions": [
    "https://www.wanted.co.kr/*"
  ]
}
```
- 특정 사이트에 Content Script 주입
- 해당 사이트의 데이터 읽기/수정
- 위험도: 중간~높음 (사이트에 따라)

## Content Security Policy

CSP는 확장 프로그램이 실행할 수 있는 코드를 제한합니다.

### 기본 CSP (Manifest V3)

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**의미**:
- `script-src 'self'`: 확장 프로그램 패키지 내 스크립트만 실행
- `object-src 'self'`: 플러그인도 마찬가지

### 금지 사항

```json
// ❌ 불가능: 인라인 스크립트
<script>
  alert('Hello');
</script>

// ❌ 불가능: 인라인 이벤트 핸들러
<button onclick="handleClick()">Click</button>

// ❌ 불가능: eval()
eval('alert("XSS")');

// ❌ 불가능: 원격 스크립트
<script src="https://cdn.example.com/script.js"></script>
```

### 허용 방법

```html
<!-- ✅ 외부 파일 사용 -->
<script src="./script.js"></script>

<button id="myButton">Click</button>
```

```javascript
// ✅ 이벤트 리스너
document.getElementById('myButton').addEventListener('click', handleClick);

// ✅ JSON.parse (eval 대신)
const data = JSON.parse(jsonString);

// ✅ Function constructor 대신 직접 함수
function dynamicFunction() {
  // ...
}
```

### WebAssembly 허용

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

## 보안 베스트 프랙티스

### 1. XSS 방지

**문제**: 사용자 입력을 직접 HTML에 삽입

```javascript
// ❌ 위험: XSS 공격 가능
const userInput = "<img src=x onerror='alert(1)'>";
element.innerHTML = userInput; // 스크립트 실행됨!
```

**해결**:

```javascript
// ✅ 안전: textContent 사용
element.textContent = userInput;

// ✅ 안전: 새 요소 생성
const div = document.createElement('div');
div.textContent = userInput;
element.appendChild(div);

// ✅ 안전: DOMPurify 라이브러리 사용
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);
```

### 2. 데이터 검증

```javascript
// ❌ 위험: 검증 없음
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  eval(request.code); // 절대 금지!
});

// ✅ 안전: 엄격한 검증
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. 출처 확인
  if (!sender.tab) {
    console.error('Not from content script');
    return;
  }

  // 2. URL 확인
  const url = new URL(sender.tab.url);
  if (url.hostname !== 'www.wanted.co.kr') {
    console.error('Unauthorized origin');
    return;
  }

  // 3. 액션 타입 확인
  const allowedActions = ['getData', 'saveData', 'deleteData'];
  if (!allowedActions.includes(request.action)) {
    console.error('Unknown action:', request.action);
    return;
  }

  // 4. 데이터 타입 확인
  if (typeof request.action !== 'string') {
    console.error('Invalid action type');
    return;
  }

  // 안전하게 처리
  handleRequest(request);
});
```

### 3. 민감한 데이터 처리

```javascript
// ❌ 위험: 평문 저장
await chrome.storage.sync.set({
  password: 'myPassword123',
  apiKey: 'sk_live_...'
});

// ✅ 안전: 민감한 데이터는 저장하지 않음
// 필요하다면 session storage + 암호화
import { encrypt, decrypt } from 'crypto-js';

await chrome.storage.session.set({
  encryptedToken: encrypt(token, encryptionKey)
});

// ✅ 더 안전: 서버에서 관리
// 클라이언트는 세션 토큰만 보관
```

### 4. HTTPS만 사용

```json
{
  "host_permissions": [
    "https://api.example.com/*"  // ✅ HTTPS
  ]
}

// ❌ HTTP 사용 금지
// "http://api.example.com/*"
```

```javascript
// fetch 시 HTTPS 확인
async function fetchData(url) {
  if (!url.startsWith('https://')) {
    throw new Error('Only HTTPS allowed');
  }

  const response = await fetch(url);
  return response.json();
}
```

### 5. 외부 콘텐츠 필터링

```javascript
// 외부 데이터를 DOM에 추가하기 전에 검증
async function displayExternalContent(url) {
  const response = await fetch(url);
  const data = await response.json();

  // ✅ 검증
  if (!isValidData(data)) {
    throw new Error('Invalid data structure');
  }

  // ✅ 안전하게 표시
  data.items.forEach(item => {
    const div = document.createElement('div');
    div.textContent = item.title; // HTML 주입 방지
    container.appendChild(div);
  });
}

function isValidData(data) {
  return (
    typeof data === 'object' &&
    Array.isArray(data.items) &&
    data.items.every(item =>
      typeof item.title === 'string' &&
      item.title.length < 200
    )
  );
}
```

## 일반적인 보안 위협

### 1. Cross-Site Scripting (XSS)

**공격 방법**:
```javascript
// 악의적인 웹 페이지
window.postMessage({
  type: 'EXPLOIT',
  payload: "<script>stealData()</script>"
}, '*');

// 취약한 Content Script
window.addEventListener('message', (event) => {
  document.body.innerHTML += event.data.payload; // ❌ 위험!
});
```

**방어**:
```javascript
// ✅ 안전
window.addEventListener('message', (event) => {
  // 1. 출처 확인
  if (event.source !== window) return;

  // 2. 메시지 타입 확인
  if (event.data.type !== 'SAFE_TYPE') return;

  // 3. HTML 주입 금지
  const div = document.createElement('div');
  div.textContent = event.data.payload;
  document.body.appendChild(div);
});
```

### 2. Clickjacking

**공격**: 투명한 iframe으로 사용자의 클릭 가로채기

**방어**:
```json
{
  "content_security_policy": {
    "extension_pages": "frame-ancestors 'none'"
  }
}
```

### 3. Man-in-the-Middle (MITM)

**방어**:
- HTTPS만 사용
- 인증서 검증
- CORS 올바르게 설정

### 4. 권한 에스컬레이션

**공격**: 더 많은 권한 획득 시도

**방어**:
```javascript
// Content Script에서 민감한 API 접근 금지
// Service Worker를 통해서만 접근

// Content Script
chrome.runtime.sendMessage({ action: 'sensitiveOperation' });

// Service Worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 권한 확인
  if (!isAuthorized(sender)) {
    sendResponse({ error: 'Unauthorized' });
    return;
  }

  // 수행
  performSensitiveOperation();
});
```

## 현재 프로젝트 보안 점검

### Manifest 분석

```json
{
  "permissions": [
    "storage",      // ✅ 적절: 데이터 저장 필요
    "activeTab",    // ✅ 적절: 탭 정보 필요
    "scripting",    // ✅ 적절: Content Script 주입
    "webRequest"    // ⚠️ 검토 필요: 사용하지 않는다면 제거
  ],
  "host_permissions": [
    "https://www.wanted.co.kr/*"  // ✅ 적절: 특정 사이트만
  ]
}
```

### 코드 보안 점검

#### ✅ 잘된 점
1. **격리된 환경**: Content Script만 사용
2. **Storage API**: 안전한 데이터 저장
3. **특정 호스트**: 원티드만 대상

#### 🔧 개선 가능
1. **webRequest 권한 제거** (사용 안 함)
   ```json
   "permissions": [
     "storage",
     "activeTab",
     "scripting"
     // "webRequest" 제거
   ]
   ```

2. **에러 처리 추가**
   ```typescript
   chrome.storage.sync.get(['companyIds'], (result) => {
     if (chrome.runtime.lastError) {
       console.error('Storage error:', chrome.runtime.lastError);
       return;
     }
     // 처리...
   });
   ```

3. **타입 체크 강화**
   ```typescript
   function isValidCompanyId(id: unknown): id is string {
     return typeof id === 'string' && /^\d+$/.test(id);
   }

   const companyId = getCompanyId();
   if (!isValidCompanyId(companyId)) {
     throw new Error('Invalid company ID');
   }
   ```

## 보안 체크리스트

### 개발 전
- [ ] 필요한 최소 권한만 manifest에 선언
- [ ] Host permissions를 특정 도메인으로 제한
- [ ] CSP 정책 확인

### 개발 중
- [ ] eval(), Function() 사용 금지
- [ ] innerHTML 사용 최소화, textContent 우선 사용
- [ ] 외부 입력 항상 검증
- [ ] HTTPS만 사용
- [ ] 민감한 데이터는 저장하지 않음

### 배포 전
- [ ] 사용하지 않는 권한 제거
- [ ] 모든 에러 처리 추가
- [ ] 보안 테스트 수행
- [ ] 코드 리뷰

## 참고 자료

- [Chrome Extension Security Best Practices](https://developer.chrome.com/docs/extensions/develop/concepts/security)
- [Content Security Policy](https://developer.chrome.com/docs/privacy-security/csp)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## 학습 완료!

축하합니다! 크롬 익스텐션 개발의 핵심 개념을 모두 학습했습니다.

### 다음 단계
1. **[README](./00-README.md)**로 돌아가서 복습
2. 현재 프로젝트에 배운 내용 적용
3. 새로운 기능 추가 시 문서 참조
