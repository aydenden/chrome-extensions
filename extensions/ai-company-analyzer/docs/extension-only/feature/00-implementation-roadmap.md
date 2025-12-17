# AI 기업분석 - 구현 로드맵

## 프로젝트 개요

취업 준비자가 여러 사이트의 기업 정보를 수집하고 로컬 AI로 분석하는 크롬 익스텐션

### 핵심 기능
1. **데이터 수집**: 요소 선택 방식으로 텍스트/그래프/PDF 추출
2. **AI 분석**: Runway 예측, 재무 리스크, 리뷰 분석, 종합 점수
3. **회사 관리**: 리스트/상세 페이지에서 수집된 데이터 및 분석 결과 확인

### 기술 스택
| 분류 | 기술 |
|------|------|
| UI | React + React Compiler |
| 빌드 | Vite + TypeScript |
| 저장소 | Dexie.js (IndexedDB) + chrome.storage.local |
| 텍스트 AI | WebLLM (Qwen2-1.5B) |
| 이미지 AI | Transformers.js (vit-gpt2) |
| SVG 캡처 | canvg |
| PDF 처리 | pdfjs-dist |
| 회사명 추출 | Title 패턴 + lindera-wasm-ko-dic |

---

## 의존성 다이어그램

```
                    ┌─────────────────────────────────────┐
                    │     Phase 1: 기반 인프라              │
                    │  ┌────────────────────────────────┐ │
                    │  │   01-project-setup             │ │
                    │  │   (Vite, React, manifest.json) │ │
                    │  └──────────────┬─────────────────┘ │
                    │                 │                   │
                    │  ┌──────────────▼─────────────────┐ │
                    │  │   02-data-storage              │ │
                    │  │   (Dexie.js, Chrome Storage)   │ │
                    │  └──────────────┬─────────────────┘ │
                    └─────────────────┼───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│ Phase 2: 데이터 수집 │   │ Phase 3: 기본 UI     │   │ Phase 4: AI 분석     │
│                     │   │                     │   │                     │
│ 03-company-extract  │   │ 07-popup-ui         │   │ 09-webllm-text      │
│ 04-element-picker   │   │                     │   │                     │
│ 05-graph-capture    │   └──────────┬──────────┘   └──────────┬──────────┘
│ 06-pdf-processing   │              │                         │
└─────────┬───────────┘              │                         │
          │                          │                         │
          └──────────────────────────┼─────────────────────────┘
                                     │
                      ┌──────────────▼──────────────┐
                      │   08-confirm-popup          │
                      │   (데이터 수집 후 확인 UI)    │
                      └──────────────┬──────────────┘
                                     │
                      ┌──────────────▼──────────────┐
                      │   10-transformers-image     │
                      │   (이미지 캡셔닝)            │
                      └──────────────┬──────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          │
┌─────────────────────┐   ┌─────────────────────┐               │
│ Phase 5: 고급 UI     │   │                     │               │
│                     │   │ 12-detail-page      │               │
│ 11-list-page        ├───▶ (회사 상세 정보)      │               │
│ (회사 목록)          │   │                     │               │
└─────────────────────┘   └──────────┬──────────┘               │
                                     │                          │
                      ┌──────────────▼──────────────┐           │
                      │   Phase 6: 설정             │           │
                      │                             │           │
                      │   13-settings               │◀──────────┘
                      │   (사이트/AI 설정)           │
                      └─────────────────────────────┘
```

---

## Phase별 상세

### Phase 1: 기반 인프라
프로젝트 초기 설정과 데이터 저장소 구현

| Feature | 설명 | 산출물 |
|---------|------|--------|
| 01-project-setup | Vite + React + TypeScript 설정 | package.json, manifest.json, vite.config.ts |
| 02-data-storage | Dexie.js + chrome.storage.local | src/lib/db.ts, src/lib/storage.ts |

### Phase 2: 데이터 수집
사용자가 웹페이지에서 데이터를 추출하는 기능

| Feature | 설명 | 산출물 |
|---------|------|--------|
| 03-company-extraction | 회사명 자동 추출 | src/lib/company-extractor.ts |
| 04-element-picker | 요소 선택 모드 (텍스트) | src/content/element-picker.ts |
| 05-graph-capture | SVG/영역 캡처 | src/content/graph-capture.ts |
| 06-pdf-processing | PDF 처리 | src/lib/pdf-processor.ts |

### Phase 3: 기본 UI
메인 팝업과 데이터 확인 팝업

| Feature | 설명 | 산출물 |
|---------|------|--------|
| 07-popup-ui | 익스텐션 메인 팝업 | src/popup/Popup.tsx |
| 08-confirm-popup | 데이터 추출 확인 모달 | src/content/confirm-popup.tsx |

### Phase 4: AI 분석
WebLLM과 Transformers.js를 사용한 AI 분석

| Feature | 설명 | 산출물 |
|---------|------|--------|
| 09-webllm-text-analysis | 텍스트 AI 분석 | src/background/webllm-engine.ts |
| 10-transformers-image-analysis | 이미지 캡셔닝 | src/background/transformers-engine.ts |

### Phase 5: 고급 UI
회사 리스트와 상세 페이지

| Feature | 설명 | 산출물 |
|---------|------|--------|
| 11-list-page | 회사 목록 페이지 | src/pages/list/ListPage.tsx |
| 12-detail-page | 회사 상세 페이지 | src/pages/detail/DetailPage.tsx |

### Phase 6: 설정
사이트 설정 및 AI 설정 관리

| Feature | 설명 | 산출물 |
|---------|------|--------|
| 13-settings | 설정 페이지 | src/pages/settings/SettingsPage.tsx |

---

## 병렬 작업 가능 그룹

의존성이 없어 동시에 개발 가능한 Feature 그룹:

| 그룹 | Features | 선행 조건 |
|------|----------|----------|
| A | 03, 04, 05, 06 | 02 완료 후 |
| B | 07, 09 | 02 완료 후 |
| C | 10, 11 | 09 완료 후 |

---

## 참조 문서

### Spec 문서 (기능 명세)
- [01-overview.md](../spec/01-overview.md) - 프로젝트 개요
- [02-data-extraction.md](../spec/02-data-extraction.md) - 데이터 추출
- [03-data-storage.md](../spec/03-data-storage.md) - 데이터 저장
- [04-ai-analysis.md](../spec/04-ai-analysis.md) - AI 분석
- [05-ui-structure.md](../spec/05-ui-structure.md) - UI 구조
- [06-settings.md](../spec/06-settings.md) - 설정

### Research 문서 (기술 조사)
- [00-decisions.md](../research/00-decisions.md) - 기술 결정 요약
- [01-element-picker.md](../research/01-element-picker.md) - 요소 선택 모드
- [02-graph-capture.md](../research/02-graph-capture.md) - 그래프 캡처
- [03-pdf-processing.md](../research/03-pdf-processing.md) - PDF 처리
- [04-company-extraction.md](../research/04-company-extraction.md) - 회사명 추출
- [05-data-storage.md](../research/05-data-storage.md) - 데이터 저장
- [06-ai-implementation.md](../research/06-ai-implementation.md) - AI 구현
