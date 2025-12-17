# 16. OCR 파이프라인 마이그레이션 - 체크리스트

## Phase 9: Tesseract.js 시도 (실패)
- [x] tesseract.js 설치
- [x] tesseract-engine.ts 생성
- [x] extraction-queue.ts 수정
- [x] index.ts 초기화 로직 변경
- [x] bun run build 성공
- [ ] ~~Chrome에서 테스트~~ → **실패**: `Worker is not defined`

> Service Worker에서 Web Worker 생성 불가로 Tesseract.js 사용 불가

## Phase 10: Donut OCR로 교체 (성공)
- [x] tesseract.js 제거 (`bun remove tesseract.js`)
- [x] `src/background/donut-engine.ts` 생성
- [x] extraction-queue.ts import 변경
- [x] index.ts import 변경
- [x] classifier.ts import 변경
- [x] tesseract-engine.ts 삭제
- [x] bun run build 성공
- [ ] Chrome에서 익스텐션 로드
- [ ] 한국어 텍스트 OCR 테스트
- [ ] 복잡한 리뷰 스크린샷 OCR 테스트
- [ ] Qwen3 분류/분석 연동 테스트

## 변경된 파일

### 신규
- `src/background/donut-engine.ts`
- `docs/feature/16-ocr-pipeline-migration.md`
- `docs/feature/16-ocr-pipeline-migration.checklist.md`

### 수정
- `package.json` (tesseract.js 제거됨)
- `src/background/extraction-queue.ts` (v5.0)
- `src/background/index.ts`
- `src/background/classifier.ts` (v3.0)

### 제거
- `src/background/tesseract-engine.ts`
- `src/background/smolvlm-engine.ts`

## 아키텍처 변경

```
[v2.0 - VLM 기반]
이미지 → Qwen2-VL-2B (VLM) → OCR → Qwen3 분석
         ~2GB, 타임아웃 문제

[v4.0 - Tesseract 시도, 실패]
이미지 → Tesseract.js → OCR → Qwen3 분석
         Service Worker에서 Worker 생성 불가 ❌

[v5.0 - Donut 기반, 현재]
이미지 → Donut (NAVER) → OCR → Qwen3 분석
         ~240MB, transformers.js 사용 ✅
```
