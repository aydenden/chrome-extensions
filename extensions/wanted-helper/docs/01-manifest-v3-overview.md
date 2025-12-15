# Manifest V3 개요

## 목차
- [Manifest V3란?](#manifest-v3란)
- [주요 변경사항](#주요-변경사항)
- [Manifest V2와의 차이점](#manifest-v2와의-차이점)
- [현재 프로젝트와의 관련성](#현재-프로젝트와의-관련성)
- [마이그레이션 고려사항](#마이그레이션-고려사항)

## Manifest V3란?

Manifest V3는 Chrome 확장 프로그램 플랫폼의 최신 버전으로, **개인정보 보호**, **보안**, **성능** 개선을 목표로 합니다.

### 핵심 목표
1. 사용자 개인정보 보호 강화
2. 확장 프로그램 보안 향상
3. 플랫폼 성능 개선
4. 사용자에게 더 많은 제어권 제공

## 주요 변경사항

### 1. 서비스 워커로 전환

**V2: Background Pages (백그라운드 페이지)**
```json
{
  "background": {
    "scripts": ["background.js"],
    "persistent": true
  }
}
```
- 장시간 실행되는 백그라운드 페이지
- 메모리와 리소스를 지속적으로 소비

**V3: Service Workers (서비스 워커)**
```json
{
  "background": {
    "service_worker": "background.js"
  }
}
```
- 필요할 때만 실행되는 이벤트 기반 모델
- 사용하지 않을 때는 종료되어 리소스 절약
- 더 나은 성능과 배터리 수명

### 2. 원격 코드 실행 금지

**V2:**
- 원격 서버에서 JavaScript 코드를 다운로드하여 실행 가능
- 검토되지 않은 코드가 실행될 수 있는 보안 위험

**V3:**
```json
// ❌ 불가능
<script src="https://example.com/script.js"></script>

// ✅ 가능 - 패키지에 포함된 코드만 실행
<script src="./local-script.js"></script>
```
- 확장 프로그램 패키지에 포함된 코드만 실행 가능
- Chrome Web Store의 코드 검토가 더 효과적
- 악의적인 코드 주입 위험 감소

### 3. 네트워크 요청 수정 변경

**V2: webRequest API (차단 방식)**
```javascript
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    return {cancel: true};
  },
  {urls: ["*://*.ads.com/*"]},
  ["blocking"]
);
```
- 모든 네트워크 요청을 확장 프로그램이 직접 검사
- 성능 저하 및 개인정보 보호 우려

**V3: declarativeNetRequest API (선언적 방식)**
```json
{
  "declarativeNetRequest": {
    "rules": [
      {
        "id": 1,
        "priority": 1,
        "action": {"type": "block"},
        "condition": {"urlFilter": "*://*.ads.com/*"}
      }
    ]
  }
}
```
- 규칙을 미리 선언하여 브라우저가 처리
- 확장 프로그램이 네트워크 트래픽을 볼 수 없음
- 더 나은 성능과 개인정보 보호

### 4. 새로운 Promises 기반 API

**V2: 콜백 패턴**
```javascript
chrome.tabs.query({active: true}, function(tabs) {
  console.log(tabs);
});
```

**V3: Promises 지원**
```javascript
// Promise 방식
const tabs = await chrome.tabs.query({active: true});
console.log(tabs);

// 여전히 콜백도 지원
chrome.tabs.query({active: true}, function(tabs) {
  console.log(tabs);
});
```

## Manifest V2와의 차이점

| 항목 | Manifest V2 | Manifest V3 |
|------|-------------|-------------|
| **백그라운드 실행** | Background Pages (지속 실행) | Service Workers (이벤트 기반) |
| **원격 코드** | 실행 가능 | 실행 불가 |
| **네트워크 차단** | webRequest (차단 방식) | declarativeNetRequest (선언적) |
| **API 스타일** | 주로 콜백 | Promises + 콜백 |
| **보안** | 상대적으로 낮음 | 강화됨 |
| **성능** | 리소스 많이 소비 | 효율적 |
| **지원 종료** | 2024년 6월 종료 | 현재 표준 |

## 현재 프로젝트와의 관련성

### ✅ 우리 프로젝트의 Manifest V3 사용

```json
{
  "manifest_version": 3,
  "name": "Wanted Helper",
  "version": "1.0",
  "description": "원티드 사이트 필터링 도구",
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "webRequest"
  ],
  "host_permissions": [
    "https://www.wanted.co.kr/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://www.wanted.co.kr/*"],
      "js": ["dist/index.js"]
    }
  ]
}
```

### 프로젝트에 적용된 V3 특징

1. **Content Scripts 사용** ✅
   - 백그라운드 스크립트 없이 Content Script만 사용
   - 필요한 페이지에서만 실행
   - 리소스 효율적

2. **로컬 코드만 사용** ✅
   - `dist/index.js`는 빌드된 로컬 파일
   - 원격 코드 없이 안전하게 동작

3. **Storage API 사용** ✅
   - `chrome.storage.sync` 사용으로 데이터 동기화
   - V3의 권장 방식

### 개선 가능한 부분

현재 프로젝트는 Manifest V3를 잘 따르고 있지만, 향후 고려할 사항:

1. **webRequest 권한**
   ```json
   "permissions": ["webRequest"]  // 현재 사용하지 않음
   ```
   - manifest.json에 선언되어 있지만 코드에서 사용하지 않음
   - 필요 없다면 제거하는 것이 권장됨 (최소 권한 원칙)

2. **TypeScript 빌드 최적화**
   - 빌드된 파일 크기 최적화
   - Tree shaking으로 사용하지 않는 코드 제거

## 마이그레이션 고려사항

### V2에서 V3로 마이그레이션 시 체크리스트

#### 1. Manifest 파일 업데이트
- [ ] `"manifest_version": 2` → `"manifest_version": 3`
- [ ] Background pages → Service workers 전환
- [ ] `"browser_action"` → `"action"` 변경
- [ ] Host permissions 분리

#### 2. API 변경 대응
- [ ] `chrome.browserAction.*` → `chrome.action.*`
- [ ] `chrome.webRequest` → `chrome.declarativeNetRequest` (필요시)
- [ ] Callback → Promises 전환 고려

#### 3. 보안 강화
- [ ] Content Security Policy 업데이트
- [ ] 원격 코드 제거
- [ ] `eval()` 사용 제거

#### 4. 테스트
- [ ] 모든 기능 동작 확인
- [ ] 성능 테스트
- [ ] 다양한 Chrome 버전에서 테스트

### 일반적인 마이그레이션 문제와 해결책

**문제 1: Service Worker가 종료됨**
```javascript
// ❌ V2 방식 - 전역 변수 사용
let cachedData = null;

// ✅ V3 방식 - Storage API 사용
chrome.storage.local.set({ cachedData: data });
```

**문제 2: DOM 접근 불가**
```javascript
// ❌ Service Worker에서는 불가능
document.getElementById('element');

// ✅ Content Script나 Offscreen document 사용
chrome.scripting.executeScript({
  target: { tabId },
  func: () => document.getElementById('element')
});
```

**문제 3: XMLHttpRequest 제거**
```javascript
// ❌ V3 Service Worker에서 사용 불가
const xhr = new XMLHttpRequest();

// ✅ Fetch API 사용
const response = await fetch(url);
```

## 참고 자료

- [Chrome for Developers - What is Manifest V3?](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate)
- [Manifest V3 FAQ](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3#faq)

## 다음 단계

Manifest V3의 기본을 이해했다면, 다음 문서를 학습하세요:
- **[Content Scripts](./02-content-scripts.md)** - 웹 페이지와 상호작용하는 방법
- **[Storage API](./03-storage-api.md)** - 데이터 저장 방법
