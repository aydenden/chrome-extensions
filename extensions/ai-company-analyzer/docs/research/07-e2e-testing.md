# Chrome Extension E2E 테스트 조사

> 조사일: 2025-12-16
> 관련 스펙: 전체 Extension 기능 검증

## 결정사항

- **선택**: Playwright
- **이유**: Manifest V3 완벽 지원, Service Worker 네이티브 접근, 공식 문서 충실

## 조사 대상

| 옵션 | 특징 | 채택 |
|------|------|------|
| Playwright | MS 개발, 다중 브라우저, Service Worker 직접 접근 | ⭐ 채택 |
| Puppeteer | Chrome DevTools Protocol 기반, Chromium 전용 | ❌ |
| Selenium | 전통적 도구, Extension 지원 제한적 | ❌ |
| WebdriverIO | 웹앱+Extension 동시 테스트, 실무 사례 있음 | ❌ |

## 상세 분석

### Playwright

**장점:**
- Manifest V3 Service Worker 완벽 지원
- `context.serviceWorkers()` API로 직접 접근
- Extension ID 동적 추출 가능
- 공식 문서에 Chrome Extension 테스트 가이드 포함
- GitHub Actions 완벽 호환
- Fixture 패턴으로 깔끔한 테스트 구조

**단점:**
- `headless: false` 필수 (Extension은 headless 미지원)
- 테스트 실행 시 브라우저 창 열림

**코드 예시:**
```typescript
// fixtures.ts
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '../dist');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker)
      serviceWorker = await context.waitForEvent('serviceworker');
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  }
});
```

### Puppeteer

**장점:**
- CDP(Chrome DevTools Protocol) 직접 접근
- Google 공식 지원
- Extension ID 동적 추출 가능

**단점:**
- Chromium 전용 (크로스 브라우저 지원 약함)
- Service Worker 접근 시 "Dead Mode" 문제 가능성
- Headless 모드에서 Extension 미지원 (`headless: false` 필수)
- Service Worker 라이프사이클 테스트 불안정 (Issue #9995)

**코드 예시:**
```typescript
import puppeteer from 'puppeteer';
import path from 'path';

const pathToExtension = path.join(process.cwd(), 'dist');
const browser = await puppeteer.launch({
  headless: false,
  args: [
    `--disable-extensions-except=${pathToExtension}`,
    `--load-extension=${pathToExtension}`
  ]
});

// Service Worker 접근
const targets = await browser.targets();
const serviceWorkerTarget = targets.find(t =>
  t.type() === 'service_worker' &&
  t.url().includes('chrome-extension://')
);
```

### Selenium

**장점:**
- 오래된 생태계, 다양한 언어 지원

**단점:**
- Service Worker 직접 접근 불가
- Extension 페이지 열기만 가능
- Storage API 테스트 시 `executeAsyncScript` 필요
- 현대적 Extension 테스트에 부적합

### WebdriverIO

**장점:**
- Contentsquare CS Live 프로젝트에서 73.7% 커버리지 달성
- 웹앱과 Extension 테스트 동시 지원

**단점:**
- Playwright 대비 Extension 특화 기능 부족
- 설정 복잡도 높음

## 벤치마킹 프로젝트

### kelseyaubrecht/playwright-chrome-extension-testing-template
- **URL**: https://github.com/kelseyaubrecht/playwright-chrome-extension-testing-template
- **특징**: Manifest V3 완벽 지원, 가장 권장하는 템플릿
- **포함 내용**:
  - Extension 로드 및 Service Worker 접근
  - Extension ID 동적 추출
  - Popup 페이지 테스트
  - Content Script 테스트
  - GitHub Actions 워크플로우

### essentialkit/xtension
- **URL**: https://github.com/justiceo/xtension
- **특징**: 포괄적인 Extension 보일러플레이트
- **포함 내용**:
  - TypeScript 지원
  - E2E 테스트 (Puppeteer, Firefox 지원)
  - 자동 아이콘 생성
  - ESBuild 번들러

### capitalbr/chrome-extension-for-testing
- **URL**: https://github.com/capitalbr/chrome-extension-for-testing
- **특징**: Manifest V3 최소 예제
- **용도**: Playwright 테스트 프레임워크 실습용

## 주요 테스트 시나리오

### 1. Popup UI 테스트
```typescript
test('popup page test', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('body')).toHaveText('expected content');
});
```

### 2. Content Script 테스트
```typescript
test('content script modifies page', async ({ page }) => {
  await page.goto('https://example.com');
  // Content Script가 추가한 요소 확인
  await expect(page.locator('[data-injected-by-extension]')).toBeVisible();
});
```

### 3. Service Worker 테스트
```typescript
test('service worker responds', async ({ context }) => {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker)
    serviceWorker = await context.waitForEvent('serviceworker');

  // Service Worker에서 코드 실행
  const result = await serviceWorker.evaluate(() => {
    return chrome.runtime.getManifest().name;
  });
  expect(result).toBe('My Extension');
});
```

### 4. Storage API 테스트
```typescript
test('storage operations', async ({ context }) => {
  const [serviceWorker] = context.serviceWorkers();
  const data = await serviceWorker.evaluate(() => {
    return new Promise(resolve => {
      chrome.storage.local.get('key', resolve);
    });
  });
  expect(data).toHaveProperty('key');
});
```

## 미채택 사유

| 옵션 | 사유 |
|------|------|
| Puppeteer | Service Worker 접근 시 Dead Mode 문제, Playwright 대비 이점 없음 |
| Selenium | Service Worker 직접 접근 불가, 현대적 Extension 테스트에 부적합 |
| WebdriverIO | Playwright 대비 Extension 특화 기능 부족, 설정 복잡 |

## Headless 모드 주의사항

Chrome Extension은 기본 headless 모드에서 동작하지 않음:

1. **`headless: false`로 실행** (기본 방법)
2. **새 Headless 모드 사용** (Chrome 112+): `args: ['--headless=new']`
3. **CI에서 Xvfb 사용**: `xvfb-run npm run test:e2e`

## AI 모델 테스트 고려사항

이 프로젝트는 Qwen2-VL, all-MiniLM 모델을 사용하므로:

- **모델 로드 시간**: 30초-2분 소요
- **테스트 타임아웃**: 최소 3분 설정 필요
- **옵션 1**: 모킹 (빠른 테스트)
- **옵션 2**: 실제 로드 (정확한 검증, 느림)

## 참고 자료

- [Playwright Chrome Extensions 공식 문서](https://playwright.dev/docs/chrome-extensions)
- [Chrome for Developers E2E 테스트 가이드](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing)
- [Puppeteer Chrome Extensions 문서](https://developer.chrome.com/docs/extensions/how-to/test/puppeteer)
- [kelseyaubrecht/playwright-chrome-extension-testing-template](https://github.com/kelseyaubrecht/playwright-chrome-extension-testing-template)
- [Contentsquare E2E 테스트 사례](https://engineering.contentsquare.com/2024/automating-e2e-tests-chrome-extensions/)
