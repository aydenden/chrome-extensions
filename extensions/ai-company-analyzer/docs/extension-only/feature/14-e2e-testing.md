# 14. E2E 테스트 - 구현 가이드

## 개요

Playwright를 사용한 Chrome Extension E2E 테스트 환경 구축

## 기술 스택

- **테스트 프레임워크**: Playwright
- **테스트 대상**: Chrome Extension (Manifest V3)
- **AI 모델**: 실제 로드 (Qwen2-VL, all-MiniLM)
- **실행 환경**: 로컬 전용

## 파일 구조

```
extensions/ai-company-analyzer/
├── e2e/
│   ├── fixtures.ts           # Extension 로드 + ID 추출
│   ├── popup.spec.ts         # Popup UI 테스트
│   ├── list-page.spec.ts     # 회사 목록 페이지 테스트
│   ├── ai-pipeline.spec.ts   # AI 모델 로드 및 분류 테스트
│   └── fixtures/
│       ├── generator/
│       │   ├── templates/    # HTML 템플릿 (4종, 커밋됨)
│       │   ├── presets.ts    # 고정 데이터 (커밋됨)
│       │   └── generate.ts   # 생성 스크립트 (커밋됨)
│       ├── generated/        # 런타임 생성 (.gitignore)
│       └── .gitignore        # generated/ 무시
├── playwright.config.ts      # Playwright 설정
└── package.json              # test:e2e 스크립트
```

## 테스트 시나리오

### P0 (필수)
1. Popup 로드 및 렌더링
2. 회사 목록 페이지 표시
3. 이미지 저장 후 DB 확인

### P1 (중요)
4. 이미지 분류 파이프라인
5. Content Script 주입 확인
6. 설정 저장/로드

### P2 (선택)
7. RAG 검색

> PDF 테스트는 제외

## 실행 방법

```bash
# 1. 의존성 설치
bun add -D @playwright/test
bunx playwright install chromium

# 2. Extension 빌드
bun run build

# 3. E2E 테스트 실행
bun run test:e2e

# 4. 특정 테스트만 실행
bunx playwright test popup.spec.ts

# 5. UI 모드로 실행
bunx playwright test --ui
```

## 주요 설정

### Timeout 설정
- 전체 테스트: 180초 (3분)
- expect: 60초 (1분)
- AI 모델 로드 대기: 120초 (2분)

### Headless 모드
- `headless: false` 필수 (Extension 제약)
- 테스트 실행 시 브라우저 창이 열림

---

## Mock Fixture 이미지 생성

AI 분류/분석 정확도 테스트를 위한 익명화된 테스트 이미지 생성 시스템

### 템플릿 종류

| 템플릿 | 원본 | 변형 |
|--------|------|------|
| `company-info.html` | 원티드 기업정보 | small, medium, large |
| `employment.html` | 혁신의숲 고용현황 | growing, stable, shrinking |
| `finance.html` | 혁신의숲 재무정보 | good, average, bad |
| `review.html` | 잡플래닛 리뷰 | positive, neutral, negative |

### 생성되는 이미지 (12개, 런타임 생성)

```
e2e/fixtures/generated/  # .gitignore에 포함
├── company-info-small.png      # 소규모 (5-15명)
├── company-info-medium.png     # 중규모 (30-70명)
├── company-info-large.png      # 대규모 (100-300명)
├── employment-growing.png      # 성장 (인원 ↑20%+)
├── employment-stable.png       # 안정 (±5%)
├── employment-shrinking.png    # 축소 (↓20%+)
├── finance-good.png            # 양호 (매출↑, 흑자)
├── finance-average.png         # 보통 (횡보)
├── finance-bad.png             # 부진 (매출↓, 적자)
├── review-positive.png         # 긍정 (4.0-5.0점)
├── review-neutral.png          # 중립 (2.5-3.5점)
└── review-negative.png         # 부정 (1.0-2.0점)
```

고정된 프리셋 데이터를 사용하므로 매번 동일한 이미지가 생성됨

### 실행 방법

```bash
# 테스트 실행 시 자동으로 fixture 생성 후 테스트
bun run test:e2e
# → 1. generate:fixtures (이미지 생성)
# → 2. playwright test (테스트 실행)
```

### AI 평가 정확도 테스트

```typescript
// 예상 결과와 실제 AI 평가 비교
const testCases = [
  { fixture: 'finance-good.png', expectedScore: { min: 4, max: 5 } },
  { fixture: 'finance-bad.png', expectedScore: { min: 1, max: 2 } },
  { fixture: 'review-positive.png', expectedScore: { min: 4, max: 5 } },
  { fixture: 'review-negative.png', expectedScore: { min: 1, max: 2 } },
];
```

---

## 참고 문서

- [기술 조사](../research/07-e2e-testing.md)
- [Playwright 공식 문서](https://playwright.dev/docs/chrome-extensions)
