# 기술 결정 요약

> 조사일: 2025-12-15
> 관련 스펙: [02-data-extraction.md](../spec/02-data-extraction.md), [04-ai-analysis.md](../spec/04-ai-analysis.md)

## 기술 스택

| 분류 | 결정 | 비고 |
|------|------|------|
| **UI 프레임워크** | React + React Compiler | 포트폴리오 적합성 |
| **빌드 도구** | Vite + TypeScript | |
| **요소 선택** | 직접 구현 (Shadow DOM) | 라이브러리 X |
| **SVG 캡처** | canvg v4.0.3 | ~312KB |
| **영역 캡처** | captureVisibleTab + crop | Chrome API |
| **PDF 처리** | pdfjs-dist | |
| **회사명 추출** | Title 패턴 + lindera-wasm-ko-dic | Chrome AI 사용 안 함 |
| **AI 분석 (텍스트)** | WebLLM + Qwen2-1.5B | 한국어 성능, 로컬 처리 |
| **AI 분석 (이미지)** | Transformers.js | WebLLM 멀티모달 미지원 보완 |
| **데이터 저장** | Dexie.js + chrome.storage.sync | |

## 주요 결정 근거

### React + React Compiler 선택

- 스토어 배포 아님 → 번들 크기 부담 적음
- 포트폴리오 적합성
- 익숙함

### Chrome 빌트인 AI 미사용 (회사명 추출)

- 모델 다운로드 22GB 필요
- 한국어 미지원 (2025-12 기준)
- lindera-wasm-ko-dic (~2-3MB)로 대체

### WebLLM + Transformers.js 선택 (AI 분석)

**WebLLM (텍스트 분석):**
- Qwen2-1.5B 모델: 한국어 직접 지원 (119개 언어)
- 로컬 처리: 프라이버시, 오프라인 가능
- 포트폴리오 차별화: 브라우저 내 LLM 실행
- Chrome 124+ Service Worker WebGPU 지원

**Transformers.js (이미지 분석):**
- WebLLM 멀티모달 미지원 보완
- 이미지 → 텍스트 캡셔닝 (vit-gpt2)
- SVG 그래프, PDF 페이지 분석용

**Chrome 빌트인 AI 제외 이유:**
- Prompt API 한국어 미지원 (영어, 일본어, 스페인어만)
- 번역 파이프라인 필요 시 품질/latency 저하

### Dexie.js 선택 (vs idb)

- 스키마 버전 관리 내장
- React 훅 지원 (`useLiveQuery`)
- TypeScript 타입 안전

## 상세 조사 문서

| 문서 | 내용 |
|------|------|
| [01-element-picker.md](./01-element-picker.md) | 요소 선택 모드 |
| [02-graph-capture.md](./02-graph-capture.md) | 그래프 캡처 |
| [03-pdf-processing.md](./03-pdf-processing.md) | PDF 처리 |
| [04-company-extraction.md](./04-company-extraction.md) | 회사명 추출 |
| [05-data-storage.md](./05-data-storage.md) | 데이터 저장 |
| [06-ai-implementation.md](./06-ai-implementation.md) | AI 분석 구현 |
