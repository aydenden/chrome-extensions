# 16. OCR 파이프라인 마이그레이션

## 개요

기존 Qwen2-VL-2B VLM 기반 OCR에서 Tesseract.js로 마이그레이션.
복잡한 UI 레이아웃(리뷰 스크린샷 등)에서 VLM 타임아웃 문제 해결.

## 변경 이력

### v1.0 - 초기 구현
- Qwen2-VL-2B로 이미지 분석 + OCR + 분류 통합

### v2.0 - VLM/LM 분리 (Phase 1-5)
- **OCR**: Qwen2-VL-2B (VLM)
- **분류/분석**: Qwen3-0.6B (Text LLM)

### v3.0 - Tesseract.js 마이그레이션 (Phase 9)
- **OCR**: Tesseract.js
- **분류/분석**: Qwen3-0.6B (Text LLM) - 유지

## 아키텍처 비교

### v2.0 (VLM + Text LLM)
```
이미지 → Qwen2-VL-2B (OCR) → 텍스트 → Qwen3-0.6B (분류/분석)
         ~2GB, WebGPU            ~600MB, WebGPU
         120초 타임아웃
```

**문제점:**
- 복잡한 UI 레이아웃에서 타임아웃 발생
- 2GB 모델 로딩 시간 길음
- 텍스트 많은 이미지에서 토큰 생성 느림

### v3.0 (Tesseract.js + Text LLM)
```
이미지 → Tesseract.js (OCR) → 텍스트 → Qwen3-0.6B (분류/분석)
         ~15MB, WASM               ~600MB, WebGPU
         빠름, 안정적
```

**장점:**
- 브라우저 OCR 사실상 표준
- 15MB vs 2GB (133배 작음)
- 100+ 언어 지원 (한국어 포함)
- 타임아웃 걱정 없음

## 수정된 파일

### 신규 파일
| 파일 | 설명 |
|------|------|
| `src/background/tesseract-engine.ts` | Tesseract.js 엔진 래퍼 |

### 수정된 파일
| 파일 | 변경 |
|------|------|
| `package.json` | tesseract.js 의존성 추가 |
| `src/background/extraction-queue.ts` | VLM → Tesseract 호출 |
| `src/background/index.ts` | 초기화 로직 변경 |

### 제거된 파일
| 파일 | 이유 |
|------|------|
| `src/background/smolvlm-engine.ts` | Tesseract.js로 대체 |

## Tesseract.js 엔진 API

```typescript
// 초기화
await initTesseract(progress => console.log(progress));

// OCR 수행
const text = await recognizeText(imageBlob);

// 상태 확인
if (isTesseractReady()) { ... }

// 정리
await disposeTesseract();
```

## v2.0에서 추가된 기능 (유지됨)

### Text LLM 엔진 (Qwen3-0.6B)
- 텍스트 분류: 20개 카테고리
- 텍스트 요약: 한국어 200자 이내
- `<think>` 태그 자동 제거

### 프롬프트 시스템
- `CLASSIFY_SYSTEM` - 분류 프롬프트
- `ANALYZE_SYSTEM` - 분석 프롬프트
- `/no_think` 지시 포함

## 의존성 변경

### 추가
```json
{
  "dependencies": {
    "tesseract.js": "^6.0.1"
  }
}
```

### 제거 가능 (선택)
- `@huggingface/transformers`의 Vision 관련 모듈 (Text LLM은 유지 필요)

## 한국어 OCR 설정

```typescript
// 한국어 worker 생성
const worker = await createWorker('kor');

// 한국어 + 영어 동시 인식
const worker = await createWorker(['kor', 'eng']);
```

언어 데이터는 jsDelivr CDN에서 자동 다운로드됨.

## 성능 비교

| 항목 | v2.0 (VLM) | v3.0 (Tesseract) |
|------|------------|------------------|
| 모델 크기 | ~2GB | ~15MB |
| 첫 로딩 | 30-60초 | 3-5초 |
| OCR 속도 | 10-120초 | 1-5초 |
| 메모리 | ~4GB | ~500MB |
| 복잡한 UI | 타임아웃 | 정상 처리 |

## 참고 자료

- [Tesseract.js GitHub](https://github.com/naptha/tesseract.js)
- [Tesseract.js 한국어](https://tesseract.projectnaptha.com/)
- [Qwen3 ONNX](https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX)
