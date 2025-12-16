# E2E 테스트 구축

## 개요

AI 기업분석 확장 프로그램의 전체 RAG 파이프라인을 검증하기 위한 E2E 테스트 환경을 구축했습니다. Playwright를 사용하여 Chrome Extension 환경에서 실제 AI 모델 추론을 포함한 통합 테스트를 수행합니다.

## 테스트 대상 파이프라인

```
SAVE_DATA
    ↓
extractionQueue.enqueue()
    ↓
1. runClassification() → subCategory 결정
    ↓
2. runTextExtraction() → JSON 메타데이터 추출
    ↓
3. runEmbedding() → 384차원 벡터 생성
    ↓
extractionStatus: 'completed'
    ↓
RAG_ANALYZE → overallScore 1-5
```

---

## 추가된 파일

### 1. 테스트 Fixture 생성기

**`e2e/fixtures/generator/generate.ts`**

Canvas API를 사용하여 12개의 mock 테스트 이미지를 생성합니다.

| 카테고리 | 파일 | 내용 |
|---------|------|------|
| 기업정보 | company-info-small.png | 소규모 기업 (8명, 3억) |
| 기업정보 | company-info-medium.png | 중규모 기업 (45명, 50억) |
| 기업정보 | company-info-large.png | 대기업 (500명, 1000억) |
| 고용현황 | employment-growing.png | 성장 추세 그래프 |
| 고용현황 | employment-stable.png | 안정 추세 그래프 |
| 고용현황 | employment-shrinking.png | 감소 추세 그래프 |
| 재무정보 | finance-good.png | 양호한 재무 지표 |
| 재무정보 | finance-average.png | 보통 재무 지표 |
| 재무정보 | finance-bad.png | 부정적 재무 지표 |
| 리뷰 | review-positive.png | 긍정적 리뷰 |
| 리뷰 | review-neutral.png | 중립 리뷰 |
| 리뷰 | review-negative.png | 부정적 리뷰 |

### 2. 테스트 헬퍼

**`e2e/helpers/fixture-loader.ts`**

```typescript
export async function loadFixtureAsBase64(filename: string): Promise<string>
export async function loadFixtureAsDataUrl(filename: string): Promise<string>
```

**`e2e/helpers/test-matrix.ts`**

```typescript
export interface AITestCase {
  fixture: string;
  dataType: DataType;
  expectedCategories: string[];
  scoreRange: { min: number; max: number };
  description: string;
}

export const AI_TEST_MATRIX: AITestCase[] = [...]
```

### 3. 테스트 스펙 파일

**`e2e/ai-classification-simple.spec.ts`**

- 단순 이미지 분류 테스트
- VLM 엔진 초기화 필요
- 각 fixture에 대해 분류 결과 검증

**`e2e/ai-rag-pipeline.spec.ts`**

- 전체 RAG 파이프라인 테스트
- 분류 → 텍스트 추출 → 임베딩 → 상태 검증
- 임베딩 실패 시 graceful 처리

---

## 백엔드 변경사항

### `src/background/index.ts` 메시지 핸들러 추가

```typescript
// 테스트용 메시지 핸들러
case 'GET_EXTRACTED_DATA':
  // extractedDataId로 추출 상태 조회

case 'GET_EXTRACTED_TEXT':
  // extractedDataId로 추출된 텍스트 조회

case 'GET_VECTOR_INDEX':
  // companyId로 벡터 인덱스 조회
```

---

## 실행 방법

```bash
# fixture 생성 + 테스트 실행
bun run test:e2e

# UI 모드로 실행
bun run test:e2e:ui

# 특정 테스트만 실행
bun run test:e2e -- --grep="company-info-small"
```

---

## 설정 파일

**`playwright.config.ts`**

```typescript
export default defineConfig({
  testDir: './e2e',
  timeout: 300000,  // 5분 (AI 모델 로딩 포함)
  use: {
    headless: true,
  },
});
```

**`e2e/fixtures.ts`**

```typescript
export const test = base.extend<{
  extensionContext: BrowserContext;
  extensionId: string;
}>({
  extensionContext: async ({}, use) => {
    const pathToExtension = resolve(__dirname, '../dist');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ extensionContext }, use) => {
    // Service Worker에서 extension ID 추출
  },
});
```

---

## 타임아웃 설정

| 작업 | 타임아웃 | 이유 |
|------|---------|------|
| VLM 엔진 초기화 | 150초 | Qwen2-VL 모델 로드 |
| 임베딩 엔진 초기화 | 60초 | all-MiniLM-L6-v2 로드 |
| 전체 추출 파이프라인 | 180초 | 분류+추출+임베딩 |
| RAG 분석 | 120초 | 벡터 검색 + Vision 분석 |

---

## 현재 테스트 결과

| 단계 | 상태 | 비고 |
|------|------|------|
| 분류 (classifying) | ✅ 성공 | VLM 엔진 사용 |
| 텍스트 추출 (extracting_text) | ✅ 성공 | JSON 메타데이터 추출 |
| 임베딩 (embedding) | ❌ 실패 | transformers.js v3 제한사항 |
| RAG 분석 | ⏭️ 스킵 | 임베딩 필요 |

임베딩 실패는 `06-embedding-issue.md` 참조.

---

## 테스트 구조

```
e2e/
├── fixtures.ts                    # Playwright fixture 정의
├── ai-classification-simple.spec.ts  # 단순 분류 테스트
├── ai-rag-pipeline.spec.ts        # 전체 파이프라인 테스트
├── helpers/
│   ├── fixture-loader.ts          # 이미지 로드 유틸
│   └── test-matrix.ts             # 테스트 케이스 정의
└── fixtures/
    ├── generator/
    │   └── generate.ts            # Mock 이미지 생성기
    └── generated/                 # 생성된 12개 PNG
```
