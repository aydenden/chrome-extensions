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
