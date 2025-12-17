# SmolVLM 마이그레이션

## 변경 일자
2025-12-15

## 배경

### 기존 문제점
1. **텍스트 데이터**: DOM에서 추출 시 뒤죽박죽 저장됨
2. **이미지 분석**: WebLLM은 텍스트만 처리, Vision 모델 미지원
3. **2단계 분석**: 이미지→캡션→텍스트해석 (정보 손실)

### 기존 아키텍처
```
이미지 → Transformers.js (ViT-GPT2 캡셔닝) → WebLLM (Qwen2-1.5B) → 결과
텍스트 → WebLLM (Qwen2-1.5B) → 결과
```

### 새 아키텍처
```
이미지 → SmolVLM-500M (Vision LLM) → 결과
```

## 변경 사항

### 1. AI 엔진 전면 교체

| 항목 | 기존 | 변경 |
|------|------|------|
| 텍스트 LLM | WebLLM (Qwen2-1.5B) | 제거 |
| 이미지 캡셔닝 | Transformers.js (ViT-GPT2) | 제거 |
| Vision LLM | 없음 | SmolVLM-500M-Instruct |
| 패키지 | `@mlc-ai/web-llm`, `@xenova/transformers` | `@huggingface/transformers` |

### 2. SmolVLM-500M-Instruct 선택 이유

| 모델 | 파라미터 | 특징 |
|------|----------|------|
| SmolVLM-256M | 2.56억 | 가장 경량, 리소스 제약 환경 |
| **SmolVLM-500M** | 5억 | DocVQA/MMMU에서 더 나은 성능, **프로덕션 권장** |
| SmolVLM-2B | 20억 | 가장 높은 성능, GPU RAM 5GB 필요 |

- MacBook M1/M2에서 2-3k tokens/sec 속도
- 프롬프트에 더 강건
- 프로덕션 환경에 적합

### 3. 텍스트 수집 기능 제거

SmolVLM이 이미지를 직접 분석하므로 텍스트 추출 불필요.

**제거 대상:**
- 팝업의 "텍스트 수집" 버튼
- Element Picker 모듈 전체
- 텍스트 저장/표시 UI
- `saveText` 함수
- `ExtractedData.textContent` 필드

### 4. 데이터 수집 방식 통일

모든 데이터를 **이미지 캡처**로 수집:
- 재무 정보 → 스크린샷 캡처 → SmolVLM 분석
- 리뷰 정보 → 스크린샷 캡처 → SmolVLM 분석
- 그래프/차트 → 스크린샷 캡처 → SmolVLM 분석

## 제거 파일

| 파일 | 설명 |
|------|------|
| `src/background/webllm-engine.ts` | WebLLM 엔진 |
| `src/background/transformers-engine.ts` | Transformers.js 이미지 캡셔닝 |
| `src/content/element-picker.ts` | 텍스트 요소 선택 UI |

## 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `package.json` | 의존성 교체 |
| `src/background/index.ts` | 메시지 핸들러 수정 |
| `src/popup/Popup.tsx` | "텍스트 수집" 버튼 제거 |
| `src/content/index.ts` | ACTIVATE_PICKER 핸들러 제거 |
| `src/content/confirm-popup.tsx` | 텍스트 관련 로직 제거 |
| `src/pages/detail/DetailPage.tsx` | 텍스트 섹션 UI 제거 |
| `src/pages/detail/detail.css` | 텍스트 스타일 제거 |
| `src/lib/storage.ts` | saveText 함수 제거 |
| `src/types/storage.ts` | textContent 필드 제거 |

## 신규 파일

| 파일 | 설명 |
|------|------|
| `src/background/smolvlm-engine.ts` | SmolVLM 엔진 |

## 참고 자료

- [SmolVLM 256M & 500M 소개](https://huggingface.co/blog/smolervlm)
- [SmolVLM 브라우저 실행](https://pyimagesearch.com/2025/10/20/running-smolvlm-locally-in-your-browser-with-transformers-js/)
- [HuggingFace SmolVLM](https://huggingface.co/blog/smolvlm)

## 요구사항

- WebGPU 지원 브라우저 필수 (Chrome 113+)
- 초기 모델 로딩 시간 존재
