# 테스트 전략 명세

## 1. 테스트 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                     E2E 테스트 (Playwright)                  │
│   - Extension ↔ SPA 통합                                    │
│   - 사용자 시나리오                                          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   통합 테스트 (Vitest)                       │
│   - OCR Pipeline                                            │
│   - LLM Pipeline                                            │
│   - Extension API                                           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   프롬프트 테스트 (promptfoo + Ollama)       │
│   - 분류 프롬프트                                           │
│   - 분석 프롬프트                                           │
│   - 출력 형식 검증                                          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   유닛 테스트 (Vitest)                       │
│   - 유틸리티 함수                                           │
│   - React Hooks                                             │
│   - 데이터 변환                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 테스트 도구

| 도구 | 용도 |
|------|------|
| Vitest | 유닛/통합 테스트 |
| Playwright | E2E 테스트 |
| promptfoo + Ollama | 프롬프트 테스트 |
| @testing-library/react | React 컴포넌트 테스트 |

---

## 3. 유닛 테스트

### 3.1 대상 모듈

```
spa/src/
├── lib/
│   ├── text-processing.test.ts    # OCR 텍스트 후처리
│   ├── image-processing.test.ts   # 이미지 전처리
│   └── api-client.test.ts         # Extension API 클라이언트
├── ai/
│   ├── prompts.test.ts            # 프롬프트 빌더
│   └── response-parser.test.ts    # LLM 응답 파서
└── hooks/
    ├── useOCR.test.ts             # OCR Hook
    └── useAnalysis.test.ts        # 분석 Hook
```

### 3.2 테스트 케이스 예시

#### text-processing.test.ts

```typescript
describe('cleanOCRText', () => {
  test('연속 공백 제거', () => {
    expect(cleanOCRText('hello   world')).toBe('hello world');
  });

  test('줄바꿈 정리', () => {
    expect(cleanOCRText('a\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('cleanKoreanOCRText', () => {
  test('숫자+단위 공백 제거', () => {
    expect(cleanKoreanOCRText('1 억 원')).toBe('1억원');
  });

  test('괄호 내부 공백 정리', () => {
    expect(cleanKoreanOCRText('( 2024 )')).toBe('(2024)');
  });
});
```

#### prompts.test.ts

```typescript
describe('buildClassifyPrompt', () => {
  test('텍스트 길이 제한 (1500자)', () => {
    const longText = 'a'.repeat(2000);
    const prompt = buildClassifyPrompt(longText);
    expect(prompt.length).toBeLessThan(2000);
  });

  test('모든 카테고리 포함', () => {
    const prompt = buildClassifyPrompt('test');
    expect(prompt).toContain('revenue_trend');
    expect(prompt).toContain('balance_sheet');
  });
});

describe('parseCategory', () => {
  test('정확한 카테고리 반환', () => {
    expect(parseCategory('revenue_trend')).toBe('revenue_trend');
  });

  test('부분 일치 처리', () => {
    expect(parseCategory('I think this is revenue_trend.')).toBe('revenue_trend');
  });

  test('불일치 시 unknown 반환', () => {
    expect(parseCategory('something random')).toBe('unknown');
  });
});
```

#### response-parser.test.ts

```typescript
describe('removeThinkingTags', () => {
  test('<think> 태그 제거', () => {
    const text = '<think>reasoning</think>결과';
    expect(removeThinkingTags(text)).toBe('결과');
  });

  test('불완전한 <think> 태그 제거', () => {
    const text = '<think>incomplete reasoning';
    expect(removeThinkingTags(text)).toBe('');
  });
});
```

### 3.3 Vitest 설정

```typescript
// spa/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/'],
    },
  },
});
```

---

## 4. 통합 테스트

### 4.1 OCR Pipeline 테스트

```typescript
// spa/src/workers/__tests__/ocr-pool.integration.test.ts
describe('OCR Worker Pool', () => {
  beforeAll(async () => {
    await ocrPool.init();
  });

  afterAll(async () => {
    await ocrPool.terminate();
  });

  test('한국어 텍스트 인식', async () => {
    const blob = await loadTestImage('korean-text.png');
    const text = await ocrPool.recognize(blob);
    expect(text).toContain('테스트');
  });

  test('영어 텍스트 인식', async () => {
    const blob = await loadTestImage('english-text.png');
    const text = await ocrPool.recognize(blob);
    expect(text).toContain('test');
  });

  test('병렬 처리 (4개 동시)', async () => {
    const blobs = await Promise.all([
      loadTestImage('test1.png'),
      loadTestImage('test2.png'),
      loadTestImage('test3.png'),
      loadTestImage('test4.png'),
    ]);

    const start = Date.now();
    await Promise.all(blobs.map(b => ocrPool.recognize(b)));
    const duration = Date.now() - start;

    // 병렬이므로 순차 처리보다 빨라야 함
    expect(duration).toBeLessThan(10000);
  });
});
```

### 4.2 Extension API 테스트

```typescript
// spa/src/lib/__tests__/extension-client.integration.test.ts
describe('Extension Client', () => {
  beforeEach(() => {
    vi.mock('chrome', () => ({
      runtime: {
        sendMessage: vi.fn(),
      },
    }));
  });

  test('회사 목록 조회', async () => {
    chrome.runtime.sendMessage.mockResolvedValue({
      success: true,
      data: [{ id: '1', name: '테스트 회사' }],
    });

    const companies = await api.getCompanies();
    expect(companies).toHaveLength(1);
  });

  test('Extension 미설치 에러', async () => {
    chrome.runtime.sendMessage.mockRejectedValue(
      new Error('Could not establish connection')
    );

    await expect(api.getCompanies()).rejects.toThrow('Extension');
  });
});
```

---

## 5. E2E 테스트

### 5.1 테스트 파일 구조

```
e2e/
├── popup.spec.ts          # Extension 팝업 테스트
├── list-page.spec.ts      # SPA 회사 목록 테스트
├── spa-analysis.spec.ts   # SPA 분석 플로우
└── extension-spa.spec.ts  # Extension ↔ SPA 통합
```

### 5.2 SPA 분석 플로우 테스트

```typescript
// e2e/spa-analysis.spec.ts
import { test, expect } from '@playwright/test';

test.describe('SPA Analysis Flow', () => {
  test('회사 목록 → 상세 → 분석 플로우', async ({ page }) => {
    // 1. SPA 접속
    await page.goto('http://localhost:5173');

    // 2. 회사 카드 클릭
    await page.click('.company-card:first-child');

    // 3. 상세 페이지 확인
    await expect(page.locator('.company-detail')).toBeVisible();

    // 4. 분석 시작 버튼 클릭
    await page.click('button:has-text("분석 시작")');

    // 5. 진행 상태 확인
    await expect(page.locator('.analysis-progress')).toBeVisible();

    // 6. 완료 대기 (타임아웃 3분)
    await expect(page.locator('.analysis-complete')).toBeVisible({
      timeout: 180000,
    });
  });

  test('OCR 엔진 로딩 상태', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const ocrStatus = page.locator('[data-testid="ocr-status"]');
    await expect(ocrStatus).toHaveAttribute('data-ready', 'true', {
      timeout: 60000,
    });
  });

  test('LLM 엔진 로딩 상태', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const llmStatus = page.locator('[data-testid="llm-status"]');
    await expect(llmStatus).toHaveAttribute('data-ready', 'true', {
      timeout: 120000,
    });
  });
});
```

### 5.3 Extension ↔ SPA 통합 테스트

```typescript
// e2e/extension-spa.spec.ts
import { test, expect } from './fixtures';

test.describe('Extension ↔ SPA Integration', () => {
  test('Extension에서 스크린샷 캡처 후 SPA에서 조회', async ({
    extensionContext,
    extensionId,
  }) => {
    // 1. Extension 팝업에서 스크린샷 캡처
    const popup = await extensionContext.newPage();
    await popup.goto(getPopupUrl(extensionId));
    await popup.click('button:has-text("스크린샷 캡처")');

    // 2. SPA에서 이미지 확인
    const spa = await extensionContext.newPage();
    await spa.goto('http://localhost:5173');

    await expect(spa.locator('.image-item')).toHaveCount(1);
  });

  test('SPA에서 분석 결과가 Extension DB에 저장됨', async ({
    extensionContext,
    extensionId,
  }) => {
    const spa = await extensionContext.newPage();
    await spa.goto('http://localhost:5173/company/test-id');
    await spa.click('button:has-text("분석 시작")');
    await spa.waitForSelector('.analysis-complete', { timeout: 180000 });

    const result = await spa.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          { type: 'GET_IMAGES', data: { companyId: 'test-id' } },
          resolve
        );
      });
    });

    expect(result.data[0].hasAnalysis).toBe(true);
  });
});
```

---

## 6. 테스트 Fixture

### 6.1 디렉토리 구조

```
spa/test/
├── fixtures/
│   ├── images/
│   │   ├── revenue-chart.png
│   │   ├── balance-sheet.png
│   │   ├── review-positive.png
│   │   └── company-overview.png
│   └── texts/
│       ├── revenue-trend.txt
│       ├── balance-sheet.txt
│       └── review-samples.txt
├── mocks/
│   ├── chrome.ts              # chrome.runtime mock
│   └── extension-api.ts       # Extension API mock
└── setup.ts                   # Vitest 설정
```

### 6.2 기존 E2E Fixture 이미지

```
e2e/fixtures/generated/
├── company-info-small.png
├── company-info-medium.png
├── company-info-large.png
├── employment-growing.png
├── employment-stable.png
├── employment-shrinking.png
├── finance-good.png
├── finance-average.png
├── finance-bad.png
├── review-positive.png
├── review-neutral.png
└── review-negative.png
```

### 6.3 Mock 설정

```typescript
// spa/test/mocks/chrome.ts
export const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    connect: vi.fn(() => ({
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() },
      postMessage: vi.fn(),
    })),
  },
};

vi.stubGlobal('chrome', mockChrome);
```

### 6.4 DI 기반 Mock 설정

Extension Client DI 패턴을 활용한 테스트 Mock 설정.

```typescript
// spa/test/mocks/extension-handler.ts
import { IExtensionHandler } from '@/lib/extension-client/types';
import { mockCompany, mockImageMeta, mockImageData } from './fixtures';

/**
 * DI용 Mock Extension Handler 생성
 */
export const createMockHandler = (): IExtensionHandler => ({
  send: vi.fn(async (type, payload) => {
    const handlers: Record<string, () => any> = {
      'GET_COMPANIES': () => [mockCompany()],
      'GET_COMPANY': () => mockCompany(),
      'GET_IMAGES': () => [mockImageMeta()],
      'GET_IMAGE_DATA': () => mockImageData(),
      'SAVE_ANALYSIS': () => ({ updatedAt: new Date().toISOString() }),
      'BATCH_SAVE_ANALYSIS': () => ({ savedCount: 1, failedIds: [] }),
      'DELETE_COMPANY': () => ({ deletedImages: 3 }),
      'DELETE_IMAGE': () => null,
      'PING': () => ({ version: '1.0.0', timestamp: new Date().toISOString() }),
      'GET_STATS': () => ({
        totalCompanies: 10,
        totalImages: 50,
        analyzedImages: 30,
        storageUsed: 1024000,
      }),
    };
    return handlers[type]?.() ?? null;
  }),
});

/**
 * 실패 시뮬레이션 Mock
 */
export const createFailingHandler = (
  failingTypes: string[]
): IExtensionHandler => ({
  send: vi.fn(async (type) => {
    if (failingTypes.includes(type)) {
      throw new Error(`Mock failure for ${type}`);
    }
    return createMockHandler().send(type, {});
  }),
});
```

**테스트에서 사용:**

```typescript
// spa/src/__tests__/example.test.ts
import { initExtensionClient } from '@/lib/extension-client/client';
import { createMockHandler } from '../test/mocks/extension-handler';

describe('CompanyList', () => {
  beforeEach(() => {
    // DI로 Mock 주입
    initExtensionClient(createMockHandler());
  });

  test('회사 목록을 렌더링한다', async () => {
    render(<CompanyList />);
    expect(await screen.findByText('테스트 회사')).toBeInTheDocument();
  });
});
```

---

## 7. 테스트 실행 전략

### 7.1 로컬 개발

```bash
# 유닛 테스트 (watch 모드)
bun run test:unit --watch

# 통합 테스트
bun run test:integration

# E2E 테스트 (UI 모드)
bun run test:e2e:ui

# 프롬프트 테스트
bun run test:prompts
```

### 7.2 CI 파이프라인

```bash
# 1. 유닛 테스트 (빠름)
bun run test:unit

# 2. 프롬프트 테스트 (Ollama 필요)
bun run test:prompts

# 3. E2E 테스트 (느림, Chrome Extension 필요)
bun run test:e2e
```

### 7.3 CI/CD 통합

```yaml
# .github/workflows/test.yml
jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bun install
      - run: bun run test:unit

  prompt-test:
    runs-on: ubuntu-latest
    services:
      ollama:
        image: ollama/ollama
        ports:
          - 11434:11434
    steps:
      - uses: actions/checkout@v4
      - run: ollama pull qwen3:0.6b
      - run: bun install
      - run: bun run test:prompts

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bun install
      - run: bunx playwright install
      - run: bun run test:e2e
```

---

## 8. 커버리지 목표

| 영역 | 목표 |
|------|------|
| 유닛 테스트 | 80% |
| 통합 테스트 | 주요 파이프라인 100% |
| E2E 테스트 | 핵심 사용자 시나리오 100% |
| 프롬프트 테스트 | 모든 카테고리 + 엣지 케이스 |

---

## 9. 관련 문서

| 문서 | 내용 |
|------|------|
| [프롬프트 테스트 가이드](../feature/06-prompt-testing.md) | promptfoo + Ollama 설정 |
| [분석 파이프라인](../feature/03-analysis-pipeline.md) | LLM 파이프라인 상세 |
| [OCR 파이프라인](../feature/02-ocr-pipeline.md) | OCR 처리 상세 |

---

## 10. 순수 함수 테스트 가이드

외부 의존성 없는 순수 함수들의 테스트 전략.

### 10.1 대상 함수

테스트 용이한 순수 함수로 분리된 모듈들:

| 모듈 | 순수 함수 | 역할 |
|------|----------|------|
| text-processing | `cleanOCRText()` | 연속 공백/줄바꿈 정리 |
| | `fixCommonOCRErrors()` | OCR 오인식 패턴 수정 |
| | `cleanKoreanOCRText()` | 한국어 숫자+단위 공백 제거 |
| | `removeThinkingTags()` | `<think>` 태그 제거 |
| | `parseCategory()` | 카테고리 문자열 파싱 |
| prompts | `buildClassifyPrompt()` | 분류 프롬프트 생성 |
| | `buildAnalyzePrompt()` | 분석 프롬프트 생성 |
| image-processing | `blobToBase64()` | Blob → Base64 변환 |
| | `base64ToBlob()` | Base64 → Blob 변환 |

### 10.2 텍스트 처리 테스트

```typescript
// spa/src/lib/text-processing/__tests__/ocr-normalization.test.ts
describe('cleanOCRText', () => {
  test('연속 공백을 단일 공백으로 정리', () => {
    expect(cleanOCRText('hello   world')).toBe('hello world');
  });

  test('3개 이상 줄바꿈을 2개로 정리', () => {
    expect(cleanOCRText('a\n\n\n\nb')).toBe('a\n\nb');
  });

  test('각 줄 앞뒤 공백 제거', () => {
    expect(cleanOCRText('  hello  \n  world  ')).toBe('hello\nworld');
  });
});

describe('fixCommonOCRErrors', () => {
  test('l을 1로 교정 (숫자 앞)', () => {
    expect(fixCommonOCRErrors('l234')).toBe('1234');
  });

  test('O를 0으로 교정 (숫자 앞)', () => {
    expect(fixCommonOCRErrors('O123')).toBe('0123');
  });
});
```

### 10.3 한국어 처리 테스트

```typescript
// spa/src/lib/text-processing/__tests__/korean-processing.test.ts
describe('cleanKoreanOCRText', () => {
  test('숫자+단위 공백 제거', () => {
    expect(cleanKoreanOCRText('1 억 원')).toBe('1억원');
    expect(cleanKoreanOCRText('50 명')).toBe('50명');
  });

  test('괄호 내부 공백 정리', () => {
    expect(cleanKoreanOCRText('( 2024 )')).toBe('(2024)');
  });

  test('연도 형식 정리', () => {
    expect(cleanKoreanOCRText('2024 년')).toBe('2024년');
  });
});

describe('containsKorean', () => {
  test('한국어 포함 시 true', () => {
    expect(containsKorean('안녕 hello')).toBe(true);
  });

  test('한국어 미포함 시 false', () => {
    expect(containsKorean('hello world')).toBe(false);
  });
});
```

### 10.4 LLM 응답 파싱 테스트

```typescript
// spa/src/lib/text-processing/__tests__/llm-response-parser.test.ts
describe('removeThinkingTags', () => {
  test('완전한 <think> 태그 제거', () => {
    const text = '<think>reasoning here</think>결과';
    expect(removeThinkingTags(text)).toBe('결과');
  });

  test('불완전한 <think> 태그 제거', () => {
    const text = '<think>incomplete reasoning';
    expect(removeThinkingTags(text)).toBe('');
  });

  test('중첩 태그 처리', () => {
    const text = '<think>first</think>middle<think>second</think>end';
    expect(removeThinkingTags(text)).toBe('middleend');
  });
});

describe('parseCategory', () => {
  test('정확한 카테고리 반환', () => {
    expect(parseCategory('revenue_trend')).toBe('revenue_trend');
  });

  test('대소문자 무시', () => {
    expect(parseCategory('REVENUE_TREND')).toBe('revenue_trend');
  });

  test('부분 일치 처리', () => {
    expect(parseCategory('I think this is revenue_trend.')).toBe('revenue_trend');
  });

  test('불일치 시 unknown 반환', () => {
    expect(parseCategory('something random')).toBe('unknown');
  });
});
```

### 10.5 프롬프트 빌더 테스트

```typescript
// spa/src/ai/__tests__/prompts.test.ts
describe('buildClassifyPrompt', () => {
  test('텍스트 길이 제한 (1500자)', () => {
    const longText = 'a'.repeat(2000);
    const prompt = buildClassifyPrompt(longText);
    // 프롬프트 내 텍스트가 제한됨
    expect(prompt.length).toBeLessThan(2500);
  });

  test('모든 카테고리 포함', () => {
    const prompt = buildClassifyPrompt('test');
    expect(prompt).toContain('revenue_trend');
    expect(prompt).toContain('balance_sheet');
    expect(prompt).toContain('unknown');
  });
});

describe('buildAnalyzePrompt', () => {
  test('카테고리와 텍스트 포함', () => {
    const prompt = buildAnalyzePrompt('sample text', 'revenue_trend');
    expect(prompt).toContain('sample text');
    expect(prompt).toContain('revenue_trend');
  });
});
```

### 10.6 테스트 실행

```bash
# 순수 함수 테스트만 실행
bun run test:unit --grep "text-processing|prompts"

# 커버리지 포함
bun run test:unit --coverage --grep "text-processing"
```
