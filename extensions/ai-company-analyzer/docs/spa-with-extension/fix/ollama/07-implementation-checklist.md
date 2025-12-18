# Ollama 전환 구현 체크리스트

## 개요

이 문서는 Ollama 단일 엔진 전환을 위한 구현 체크리스트입니다.
의존성을 기반으로 병렬 실행 가능 여부를 표시했습니다.

---

## 의존성 그래프

```
[Phase 1: 기반 작업] ─────────────────────────────────────────
  │
  ├── settings.ts (독립)
  ├── 파일 삭제 (독립)
  └── 의존성 삭제 (독립)
         │
         ▼
[Phase 2: OllamaContext] ─────────────────────────────────────
  │
  └── OllamaContext.tsx → App.tsx
         │
         ▼
[Phase 3: UI] ────────────────────────────────────────────────
  │
  ├── Header.tsx (OllamaContext 의존)
  ├── Layout.tsx (Header 의존)
  └── Settings.tsx (OllamaContext 의존)
         │
         ▼
[Phase 4: Analysis] ──────────────────────────────────────────
  │
  └── Analysis.tsx (OllamaContext 의존)
         │
         ▼
[Phase 5: 정리] ──────────────────────────────────────────────
  │
  ├── AIContext.tsx
  ├── engine-factory.ts
  └── 테스트
```

---

## Phase 1: 기반 작업

> **병렬 가능**: 이 Phase의 모든 작업은 독립적으로 실행 가능

### 1.1 settings.ts 수정

**파일**: `spa/src/lib/settings.ts`

- [ ] `aiEngine` 필드 삭제
- [ ] `ocrLanguage` 필드 삭제
- [ ] `ollamaModel` 필드 추가
- [ ] 기본값 업데이트

```typescript
// Before
interface AppSettings {
  aiEngine: 'qwen3' | 'ollama' | 'mock';
  ollamaEndpoint: string;
  ocrLanguage: 'kor' | 'eng' | 'kor+eng';
}

// After
interface AppSettings {
  ollamaEndpoint: string;
  ollamaModel: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: ''
};
```

### 1.2 파일 삭제

**병렬 가능**

- [ ] `spa/src/lib/ai/engines/qwen3.ts` 삭제
- [ ] `spa/src/lib/ai/engines/mock.ts` 삭제
- [ ] `spa/src/lib/ai/webgpu-check.ts` 삭제
- [ ] `spa/src/contexts/OCRContext.tsx` 삭제
- [ ] `spa/src/hooks/useOCRBatch.ts` 삭제

### 1.3 의존성 삭제

**파일**: `spa/package.json`

- [ ] `@huggingface/transformers` 삭제
- [ ] `tesseract.js` 삭제
- [ ] `bun install` 실행

### 1.4 Vite 설정 수정

**파일**: `spa/vite.config.ts`

- [ ] `optimizeDeps.include`에서 삭제된 패키지 제거
- [ ] `manualChunks`에서 ai, ocr 청크 제거

---

## Phase 2: OllamaContext

> **순차 실행**: Phase 1 완료 후 실행

### 2.1 OllamaContext 생성

**파일**: `spa/src/contexts/OllamaContext.tsx` (신규)

- [ ] `OllamaState` 인터페이스 정의
- [ ] `OllamaModel` 인터페이스 정의
- [ ] `OllamaContextValue` 인터페이스 정의
- [ ] `OllamaProvider` 컴포넌트 구현
  - [ ] `checkConnection` 함수
  - [ ] `setEndpoint` 함수
  - [ ] `fetchModels` 함수 (Vision 모델 필터링)
  - [ ] `selectModel` 함수
  - [ ] `chat` 함수 (options.num_ctx 지원)
  - [ ] `analyzeImage` 함수
- [ ] `useOllama` 훅 구현
- [ ] `formatBytes` 유틸 함수

**참조 문서**: `02-ollama-context.md`

### 2.2 타입 정의

**파일**: `spa/src/lib/ai/types.ts` (신규 또는 수정)

- [ ] `ChatMessage` 인터페이스
- [ ] `ChatOptions` 인터페이스
- [ ] `ChatResponse` 인터페이스

**참조 문서**: `01-api-reference.md`

### 2.3 App.tsx 수정

**파일**: `spa/src/App.tsx`

- [ ] `OllamaProvider` import 추가
- [ ] `OCRProvider` import 삭제
- [ ] Provider 계층 구조 수정

```typescript
// Before
<ExtensionProvider>
  <OCRProvider>
    <AIProvider>
      ...
    </AIProvider>
  </OCRProvider>
</ExtensionProvider>

// After
<ExtensionProvider>
  <OllamaProvider>
    ...
  </OllamaProvider>
</ExtensionProvider>
```

---

## Phase 3: UI 컴포넌트

> **순차 실행**: Phase 2 완료 후 실행
> **내부 병렬 가능**: Header와 Settings는 병렬 실행 가능

### 3.1 Header.tsx 수정

**파일**: `spa/src/components/layout/Header.tsx`

- [ ] `useOllama` import 추가
- [ ] Ollama 상태 표시 추가 (StatusIndicator)
- [ ] `StatusIndicator` 컴포넌트 구현 (내부 또는 별도 파일)

**참조 문서**: `04-header-status.md`

### 3.2 Layout.tsx 수정

**파일**: `spa/src/components/layout/Layout.tsx`

- [ ] Header import 경로 확인
- [ ] Props 변경 없음 (isConnected 유지)

### 3.3 Settings.tsx 수정

**파일**: `spa/src/pages/Settings.tsx`

- [ ] `useOllama` import 추가
- [ ] AI 엔진 선택 UI 삭제
- [ ] OCR 설정 UI 삭제
- [ ] Ollama 연결 카드 구현 (OllamaConnectionCard)
- [ ] 모델 선택 카드 구현 (ModelSelectionCard)

**참조 문서**: `03-settings-ui.md`

---

## Phase 4: Analysis

> **순차 실행**: Phase 2 완료 후 실행 (Phase 3과 병렬 가능)

### 4.1 Analysis.tsx 수정

**파일**: `spa/src/pages/Analysis.tsx`

- [ ] OCR 관련 import 삭제
- [ ] `useOllama` import 추가
- [ ] OCR 처리 로직 삭제
- [ ] Ollama Vision 분석 로직 구현
- [ ] 분류 프롬프트 수정 (이미지 직접 분석)
- [ ] 분석 프롬프트 수정 (이미지 직접 분석)
- [ ] 진행률 표시 수정 (2단계로 단순화)

**참조 문서**: `05-analysis-flow.md`

---

## Phase 5: 정리

> **순차 실행**: Phase 3, 4 완료 후 실행

### 5.1 AIContext 정리

**파일**: `spa/src/contexts/AIContext.tsx`

- [ ] Qwen3 관련 코드 삭제
- [ ] WebGPU 체크 코드 삭제
- [ ] Mock 엔진 관련 코드 삭제
- [ ] Ollama 단일 엔진으로 단순화 또는 파일 삭제

### 5.2 engine-factory 정리

**파일**: `spa/src/lib/ai/engine-factory.ts`

- [ ] `qwen3` case 삭제
- [ ] `mock` case 삭제
- [ ] 필요시 파일 삭제 (OllamaContext로 대체되는 경우)

### 5.3 디버깅 로그 제거

- [ ] AIContext.tsx의 `console.log` 제거
- [ ] Analysis.tsx의 `console.log` 제거
- [ ] 기타 디버깅 로그 제거

### 5.4 테스트

- [ ] `bun run build` 성공 확인
- [ ] `bun run typecheck` 성공 확인
- [ ] Ollama 연결 테스트
- [ ] 모델 목록 조회 테스트
- [ ] 이미지 분석 테스트
- [ ] 결과 저장 테스트

---

## 실행 순서 요약

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1 (병렬)                                               │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│ │ settings.ts │ │ 파일 삭제   │ │ 의존성/Vite 설정 삭제   │ │
│ └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2 (순차)                                               │
│ ┌─────────────────────┐     ┌─────────────────────┐         │
│ │ OllamaContext.tsx   │ ──▶ │ App.tsx             │         │
│ │ + types.ts          │     │ (Provider 추가)     │         │
│ └─────────────────────┘     └─────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3 & 4 (병렬)                                           │
│ ┌───────────────────────────┐ ┌───────────────────────────┐ │
│ │ Phase 3: UI               │ │ Phase 4: Analysis         │ │
│ │ ├── Header.tsx            │ │ └── Analysis.tsx          │ │
│ │ ├── Layout.tsx            │ │                           │ │
│ │ └── Settings.tsx          │ │                           │ │
│ └───────────────────────────┘ └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 5 (순차)                                               │
│ ┌─────────────┐ ┌─────────────────┐ ┌─────────────────────┐ │
│ │ AIContext   │ │ engine-factory  │ │ 테스트 & 로그 제거  │ │
│ └─────────────┘ └─────────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 참조 문서

| 문서 | 내용 |
|------|------|
| `00-overview.md` | 전체 개요 및 결정 사항 |
| `01-api-reference.md` | Ollama API 레퍼런스 |
| `02-ollama-context.md` | OllamaContext 설계 |
| `03-settings-ui.md` | Settings 페이지 UI |
| `04-header-status.md` | Header 상태 표시 |
| `05-analysis-flow.md` | Analysis 페이지 흐름 |
| `06-cleanup.md` | 삭제 대상 목록 |
