# Ollama 단일 엔진 전환 개요

## 배경

### 기존 문제점
- **WebGPU (Qwen3)**: 브라우저 메모리 제약으로 0.5B 모델만 사용 가능, 품질 한계
- **OCR (Tesseract)**: 추가 처리 단계, 정확도 이슈
- **복잡한 Fallback**: qwen3 → ollama → mock 순서로 복잡한 로직

### 전환 이유
1. **품질 향상**: Ollama로 7B+ 모델 사용 가능
2. **멀티모달**: Vision 모델로 이미지 직접 분석 (OCR 불필요)
3. **단순화**: 단일 엔진으로 코드 복잡도 감소
4. **로컬 실행**: API 비용 없음, 개인 포트폴리오용으로 적합

---

## 결정 사항

| 항목 | 결정 |
|------|------|
| Vision 모델 | **필수** - 이미지 분석 지원 모델만 선택 가능 |
| Fallback | **없음** - Ollama 미연결 시 분석 기능 비활성화 |
| Mock 엔진 | **삭제** - 개발/테스트용 Mock 제거 |

---

## 주요 변경점

### 삭제
- WebGPU 관련 코드 (qwen3.ts, webgpu-check.ts)
- OCR 관련 코드 (OCRContext, useOCRBatch, tesseract.js)
- Mock 엔진 (mock.ts)
- transformers.js 의존성

### 신규
- OllamaContext (연결 상태, 모델 관리)
- Settings UI 개편 (엔드포인트 + 모델 선택)
- Header Ollama 상태 표시

### 수정
- ollama.ts 엔진 (이미지 분석 추가)
- Analysis 페이지 (OCR 제거, 이미지 직접 분석)
- AIContext (Ollama 단일)

---

## 작업 순서

1. **문서 작성** (현재)
   - API 레퍼런스
   - 설계 문서 (Context, UI, Flow)
   - Cleanup 체크리스트

2. **신규 구현**
   - OllamaContext 생성
   - ollama.ts 이미지 분석 추가

3. **UI 변경**
   - Settings 페이지 개편
   - Header 상태 추가

4. **기존 코드 수정**
   - Analysis 페이지 OCR 제거
   - AIContext 단순화

5. **정리**
   - 삭제 파일 제거
   - 의존성 정리
   - 디버깅 로그 제거

---

## 참고 문서

| 문서 | 내용 |
|------|------|
| [01-api-reference.md](./01-api-reference.md) | Ollama API 엔드포인트 |
| [02-ollama-context.md](./02-ollama-context.md) | OllamaContext 설계 |
| [03-settings-ui.md](./03-settings-ui.md) | Settings 페이지 UI |
| [04-header-status.md](./04-header-status.md) | Header 상태 표시 |
| [05-analysis-flow.md](./05-analysis-flow.md) | 분석 흐름 변경 |
| [06-cleanup.md](./06-cleanup.md) | 삭제 대상 목록 |
