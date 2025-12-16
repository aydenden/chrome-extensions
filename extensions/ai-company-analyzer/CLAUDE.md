# AI 기업분석

## 빌드

- `bun run build` - Vite + esbuild 전체 빌드
- `bun run dev` - watch 모드

**주의**: Content script는 esbuild로 IIFE 빌드됨 (Vite와 별도)

## 구조

- `src/popup/` - React 팝업 UI
- `src/pages/` - list, detail, settings 페이지 (React)
- `src/content/` - 콘텐츠 스크립트 (요소 선택, 그래프 캡처)
- `src/background/` - 서비스 워커 (AI 엔진)
- `src/lib/` - 유틸 (db, storage, settings, sites)

## 의존성 특이사항

| 패키지 | 용도 |
|--------|------|
| @huggingface/transformers | 브라우저 AI 추론 (SmolVLM) |
| lindera-wasm-ko-dic | 한국어 형태소 분석 |
| pdfjs-dist | PDF 텍스트/이미지 추출 |
| dexie | IndexedDB 래퍼 |

**WASM 파일**: vite.config.ts가 빌드 시 자동 복사
