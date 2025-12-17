# 시스템 아키텍처 스펙

## 1. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SPA (GitHub Pages)                              │
│                  https://username.github.io/ai-company-analyzer      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      React Application                         │   │
│  │                                                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │   │
│  │  │   Pages     │  │ Components  │  │    State (Query)    │   │   │
│  │  │ - List      │  │ - Header    │  │ - Companies         │   │   │
│  │  │ - Detail    │  │ - ImageCard │  │ - Images            │   │   │
│  │  │ - Analysis  │  │ - Progress  │  │ - Analysis          │   │   │
│  │  │ - Settings  │  │ - Toast     │  │ - OCR/LLM Status    │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │   │
│  │                                                                │   │
│  │  ┌───────────────────────────────────────────────────────────┐│   │
│  │  │                    AI Processing Layer                     ││   │
│  │  │                                                            ││   │
│  │  │  ┌─────────────────┐      ┌────────────────────────────┐  ││   │
│  │  │  │  Tesseract.js   │      │    Qwen3-0.6B (WebGPU)     │  ││   │
│  │  │  │  Worker Pool    │  →   │    Classification + Analysis│  ││   │
│  │  │  │  (4 workers)    │      │                            │  ││   │
│  │  │  └─────────────────┘      └────────────────────────────┘  ││   │
│  │  └───────────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                    │                                  │
│                     chrome.runtime.sendMessage(extensionId, ...)     │
└────────────────────────────────────┼─────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Service Worker (Background)               │    │
│  │                                                              │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │    │
│  │  │  External API   │  │   Data Manager  │  │   Capture   │ │    │
│  │  │  (onMessage     │  │   (IndexedDB)   │  │   Service   │ │    │
│  │  │   External)     │  │                 │  │             │ │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      Content Script                          │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │    │
│  │  │   DOM Scraper   │  │ Element Picker  │  │   Messenger │ │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌───────────────┐                                                   │
│  │  Mini Popup   │  → "분석 대시보드 열기" 버튼만                      │
│  └───────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 역할 분담

### 2.1 Chrome Extension (수집 전용)

| 모듈 | 역할 |
|------|------|
| **Service Worker** | 메시지 라우팅, 데이터 관리 |
| **External API** | SPA 요청 처리, 보안 검증 |
| **Data Manager** | IndexedDB CRUD |
| **Capture Service** | 스크린샷, 탭 캡처 |
| **Content Script** | DOM 스크래핑, 요소 선택 |
| **Popup** | SPA 열기 버튼 |

### 2.2 SPA (분석 + UI)

| 모듈 | 역할 |
|------|------|
| **Pages** | 라우팅, 페이지 레이아웃 |
| **Components** | 재사용 UI 컴포넌트 |
| **State (Query)** | 서버 상태 관리 (React Query) |
| **Extension Client** | Extension 통신 |
| **Tesseract.js** | OCR 처리 |
| **Qwen3 Engine** | 분류/분석 LLM |

## 3. 통신 흐름

### 3.1 데이터 수집 흐름

```
[사용자]
    │
    ▼ 원티드/잡플래닛 방문
[Content Script]
    │ DOM 분석, 회사 정보 추출
    ▼
[Service Worker]
    │ 데이터 정규화
    ▼
[IndexedDB]
    │ 회사/이미지 저장
    ▼
[완료]
```

### 3.2 분석 흐름

```
[SPA]
    │
    ▼ GET_COMPANIES
[Extension] → 회사 목록 반환
    │
    ▼ GET_IMAGES(companyId)
[Extension] → 이미지 메타 반환
    │
    ▼ GET_IMAGE_DATA(imageId)
[Extension] → Base64 이미지 반환
    │
    ▼ Tesseract.js OCR
[SPA] → 텍스트 추출
    │
    ▼ Qwen3 분류/분석
[SPA] → 카테고리 + 요약
    │
    ▼ SAVE_ANALYSIS
[Extension] → IndexedDB 저장
    │
    ▼ [완료]
```

## 4. 기술 스택

### 4.1 Extension

| 분류 | 기술 |
|------|------|
| 런타임 | Chrome Extension Manifest V3 |
| 언어 | TypeScript |
| 빌드 | Vite + esbuild |
| DB | Dexie (IndexedDB) |
| 통신 | externally_connectable |

### 4.2 SPA

| 분류 | 기술 |
|------|------|
| 프레임워크 | React 18 |
| 언어 | TypeScript |
| 빌드 | Vite |
| 라우팅 | React Router v6 |
| 상태 관리 | TanStack Query v5 |
| 스타일 | TailwindCSS |
| OCR | Tesseract.js v6 |
| LLM | transformers.js + Qwen3 |
| 배포 | GitHub Pages + Actions |

## 5. 디렉토리 구조

```
extensions/ai-company-analyzer/
├── extension/                      # Chrome Extension
│   ├── manifest.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── background/
│       │   ├── index.ts            # 진입점
│       │   ├── external-api.ts     # SPA 통신 API
│       │   ├── data-manager.ts     # IndexedDB 관리
│       │   └── capture-service.ts  # 캡처 기능
│       ├── content/
│       │   ├── index.ts
│       │   ├── scraper.ts
│       │   └── element-picker.ts
│       ├── popup/
│       │   ├── index.html
│       │   ├── index.tsx
│       │   └── MiniPopup.tsx
│       └── lib/
│           ├── db.ts
│           ├── storage.ts
│           └── sites/
│
├── spa/                            # SPA Application
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── pages/
│       │   ├── CompanyList.tsx
│       │   ├── CompanyDetail.tsx
│       │   ├── Analysis.tsx
│       │   └── Settings.tsx
│       ├── components/
│       │   ├── Header.tsx
│       │   ├── ImageCard.tsx
│       │   ├── ProgressBar.tsx
│       │   └── ...
│       ├── contexts/
│       │   ├── ExtensionContext.tsx
│       │   └── OCRContext.tsx
│       ├── hooks/
│       │   ├── useExtensionData.ts
│       │   └── useOCR.ts
│       ├── lib/
│       │   ├── extension-client.ts
│       │   └── utils.ts
│       ├── ai/
│       │   ├── qwen3-engine.ts
│       │   └── prompts.ts
│       └── workers/
│           └── ocr-worker.ts
│
├── shared/                         # 공유 타입
│   ├── types/
│   │   ├── company.ts
│   │   ├── image.ts
│   │   ├── analysis.ts
│   │   └── message.ts
│   └── constants/
│       └── categories.ts
│
└── docs/
    ├── extension-only/             # 기존 문서
    └── spa-with-extension/         # 새 아키텍처 문서
        ├── research/
        ├── spec/
        └── feature/
```

## 6. 보안 고려사항

### 6.1 Extension 측

- `externally_connectable`에 허용 도메인 명시
- `sender.url` 검증 필수
- 민감 데이터 노출 최소화

### 6.2 SPA 측

- Extension ID 환경 변수로 관리
- HTTPS 강제 (GitHub Pages)
- CSP 헤더 설정

## 7. 배포 구조

```
[GitHub Repository]
    │
    ├── extension/ → 수동 빌드 후 Chrome 로드
    │
    └── spa/ → GitHub Actions → GitHub Pages
         │
         └── https://username.github.io/ai-company-analyzer/
```

## 8. 확장 가능성

### 8.1 성능 최적화

- 이미지 압축 (전송 전)
- 점진적 로딩 (가상화)
- 캐시 전략 개선

## 9. 에러 처리 아키텍처

### 9.1 계층적 Error Boundary

React Error Boundary를 계층적으로 적용하여 에러 영향 범위를 최소화.

```tsx
// src/App.tsx
<ErrorBoundary fallback={<GeneralErrorPage />}>
  <ExtensionErrorBoundary fallback={<ExtensionRequiredPage />}>
    <AIEngineFallback fallback={<AIEngineErrorPage />}>
      <RouterProvider router={router} />
    </AIEngineFallback>
  </ExtensionErrorBoundary>
</ErrorBoundary>
```

**에러 계층:**

| 순서 | 경계 | 처리 대상 | 폴백 UI |
|-----|------|----------|---------|
| 1 | ErrorBoundary | 일반 에러 | 전체 에러 페이지 |
| 2 | ExtensionErrorBoundary | Extension 연결 에러 | Extension 설치 안내 |
| 3 | AIEngineFallback | AI 엔진 초기화 에러 | 엔진 로딩 실패 안내 |

### 9.2 Circuit Breaker 패턴

외부 서비스 장애 시 빠른 실패(Fast Fail)로 시스템 안정성 확보.

```
[요청] → [Circuit 체크] → OPEN이면 즉시 실패
                       → CLOSED면 실행 + Retry
```

**적용 지점:**

| 대상 | 임계값 | 리셋 시간 |
|------|--------|----------|
| Extension API | 5회 실패 | 30초 |
| AI Engine | 3회 실패 | 60초 |

### 9.3 에러 타입 계층

```typescript
// shared/types/errors.ts

// 기본 에러
class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public recoverable: boolean = true
  ) {
    super(message);
  }
}

// Extension 관련
class ExtensionError extends AppError {
  constructor(message: string) {
    super(message, 'EXTENSION_ERROR');
  }
}

// AI 엔진 관련
class AIEngineError extends AppError {
  constructor(message: string, public engine: string) {
    super(message, 'AI_ENGINE_ERROR');
  }
}
```

## 10. 공유 타입 관리

SPA와 Extension 간 타입 일관성을 위한 공유 타입 전략.

### 10.1 Discriminated Union 메시지

타입 안전한 메시지 통신을 위해 Discriminated Union 사용.

```typescript
// shared/types/messages.ts

type ExtensionMessage =
  | { type: 'GET_COMPANIES'; payload?: GetCompaniesPayload }
  | { type: 'GET_COMPANY'; payload: { companyId: string } }
  | { type: 'DELETE_COMPANY'; payload: { companyId: string } }
  | { type: 'GET_IMAGES'; payload: { companyId: string } }
  | { type: 'GET_IMAGE_DATA'; payload: { imageId: string } }
  | { type: 'DELETE_IMAGE'; payload: { imageId: string } }
  | { type: 'SAVE_ANALYSIS'; payload: SaveAnalysisPayload }
  | { type: 'BATCH_SAVE_ANALYSIS'; payload: BatchSaveAnalysisPayload }
  | { type: 'PING' }
  | { type: 'GET_STATS' };

// 타입 추론
type MessagePayload<T extends ExtensionMessage['type']> =
  Extract<ExtensionMessage, { type: T }>['payload'];
```

### 10.2 런타임 검증 (Zod)

외부 데이터 검증을 위해 Zod 스키마 사용.

```typescript
// shared/types/validation.ts
import { z } from 'zod';

export const DataTypeSchema = z.enum([
  'WANTED', 'JOBPLANET', 'SARAMIN',
  'INNOFOREST', 'DART', 'SMES', 'BLIND', 'OTHER'
]);

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  url: z.string().url(),
  siteType: DataTypeSchema,
  dataSources: z.array(DataTypeSchema).optional(),
  imageCount: z.number().int().min(0),
  analyzedCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ImageSubCategorySchema = z.enum([
  'revenue_trend', 'balance_sheet', 'income_statement',
  'employee_trend', 'review_positive', 'review_negative',
  'company_overview', 'unknown'
]);

// 사용 예시
function parseCompanyResponse(data: unknown): CompanyDTO {
  return CompanySchema.parse(data);
}
```

### 10.3 타입 공유 구조

```
shared/
├── types/
│   ├── messages.ts          # API 메시지 Discriminated Union
│   ├── models.ts            # Company, Image 등 데이터 모델
│   ├── validation.ts        # Zod 스키마
│   └── errors.ts            # 에러 타입
└── constants/
    └── categories.ts        # ImageSubCategory 등 상수
```

### 10.4 타입 안전성 보장

| 계층 | 검증 방법 | 시점 |
|------|----------|------|
| 컴파일 타임 | TypeScript + Discriminated Union | 빌드 시 |
| 런타임 | Zod 스키마 | 외부 데이터 수신 시 |

```typescript
// Extension API 응답 검증 예시
async function getCompanies(): Promise<CompanyDTO[]> {
  const response = await sendMessage('GET_COMPANIES');

  // 런타임 검증
  const validated = z.array(CompanySchema).parse(response);
  return validated;
}
```

## 11. 아키텍처 결정 기록

주요 설계 결정과 그 배경을 간략히 기록.

### 11.1 Extension Client DI 패턴

| 항목 | 내용 |
|------|------|
| 결정 | 인터페이스 기반 DI로 Chrome API 추상화 |
| 이유 | 테스트 시 Mock 주입, 브라우저 의존성 격리 |
| 대안 | 전역 Mock (상태 오염), Service Locator (런타임 확인 불가) |
| 참조 | 03-spa-structure.md Section 7 |

### 11.2 AI Engine Strategy 패턴

| 항목 | 내용 |
|------|------|
| 결정 | Strategy 패턴으로 AI 엔진 추상화 |
| 이유 | WebGPU 미지원 폴백, 테스트용 Mock, 새 엔진 추가 용이 |
| 대안 | if-else 분기 (확장 어려움), 단일 엔진 (유연성 부족) |
| 참조 | 03-spa-structure.md Section 6.3 |

### 11.3 Shared Types + Zod Validation

| 항목 | 내용 |
|------|------|
| 결정 | Discriminated Union + Zod 런타임 검증 |
| 이유 | 컴파일 타임 + 런타임 이중 검증, 타입 추론 자동화 |
| 대안 | TypeScript만 (런타임 검증 없음), io-ts (가독성 낮음) |
| 참조 | Section 10 |
