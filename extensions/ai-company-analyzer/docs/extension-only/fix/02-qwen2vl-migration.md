# SmolVLM → Qwen2-VL 마이그레이션

## 변경 일자
2025-12-15

## 문제 상황

### 증상
AI 재분석 버튼 클릭 시 JSON 파싱 실패:
```
JSON 파싱 실패: SyntaxError: Unexpected token '이', "이 그래프/차트 이"... is not valid JSON

응답: 이 그래프/차트 이미지를 분석하고 JSON 형식으로 응답하세요.
      이 그래프/차트 이미지를 분석하고 JSON 형식으로 응답하세요.
      이 그래프/차트 이미지를 분석하고 JSON 형식으로 응답하세요.
```

### 원인 분석
1. **SmolVLM-500M 모델의 한계**: 500M 파라미터의 경량 모델로 한글 이해 능력 부족
2. **한글 미지원**: SmolVLM 시리즈는 영어 전용 모델
3. **프롬프트 에코**: 모델이 이미지를 분석하지 못하고 프롬프트를 그대로 반복 출력

### 요구사항
- 한글 이미지 내 텍스트 인식 (OCR)
- 한글 프롬프트 이해
- 브라우저 WebGPU 실행 가능

## 해결책: Qwen2-VL-2B 모델 도입

### 모델 비교

| 항목 | SmolVLM-500M | Qwen2-VL-2B |
|------|--------------|-------------|
| 파라미터 | 500M | 2B |
| 한국어 | ❌ | ✅ |
| 다국어 OCR | ❌ | 19개 언어 |
| ONNX/WebGPU | ✅ | ✅ |
| 메모리 | ~2GB | ~4GB |
| 이미지 크기 | 자동 | 448x448 |

### Qwen2-VL 선택 이유
1. **한국어 공식 지원**: 이미지 내 한국어 텍스트 인식 가능
2. **ONNX 공식 변환**: `onnx-community/Qwen2-VL-2B-Instruct` 제공
3. **WebGPU 호환**: transformers.js로 브라우저 실행 가능
4. **적절한 크기**: 2B로 성능과 리소스 균형

## 변경 사항

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/background/smolvlm-engine.ts` | Qwen2-VL API로 전면 교체 |

### 주요 코드 변경

#### 1. 모델 ID 변경
```typescript
// 변경 전
const MODEL_ID = 'HuggingFaceTB/SmolVLM-500M-Instruct';

// 변경 후
const MODEL_ID = 'onnx-community/Qwen2-VL-2B-Instruct';
```

#### 2. API 변경
```typescript
// 변경 전
import { AutoModelForVision2Seq } from '@huggingface/transformers';
model = await AutoModelForVision2Seq.from_pretrained(MODEL_ID, { dtype: 'fp32', device: 'webgpu' });

// 변경 후
import { Qwen2VLForConditionalGeneration } from '@huggingface/transformers';
model = await Qwen2VLForConditionalGeneration.from_pretrained(MODEL_ID, { device: 'webgpu' });
```

#### 3. 이미지 처리 변경
```typescript
// 변경 전
const image = await RawImage.fromBlob(new Blob([arrayBuffer]));

// 변경 후
const rawImage = await RawImage.fromBlob(new Blob([arrayBuffer]));
const image = await rawImage.resize(448, 448);  // Qwen2-VL 권장 크기
```

#### 4. 출력 디코딩 변경
```typescript
// 변경 전 (TextStreamer 사용)
const streamer = new TextStreamer(processor, { ... });
await model.generate({ ...inputs, streamer });

// 변경 후 (batch_decode 사용)
const outputs = await model.generate({ ...inputs, max_new_tokens: 512 });
const decoded = processor.batch_decode(
  outputs.slice(null, [inputLength, null]),
  { skip_special_tokens: true }
);
return decoded[0];
```

#### 5. 타임아웃 증가
```typescript
// 변경 전
const ANALYSIS_TIMEOUT = 60000; // 60초

// 변경 후
const ANALYSIS_TIMEOUT = 120000; // 120초 (모델이 더 크므로)
```

## 주의사항

1. **초기 로딩 시간 증가**: 2B 모델이므로 SmolVLM-500M 대비 로딩 시간 증가
2. **메모리 사용량 증가**: ~4GB GPU RAM 필요
3. **WebGPU 필수**: Chrome 113+ 또는 WebGPU 지원 브라우저 필요

## 테스트 체크리스트

- [ ] 엔진 초기화 성공
- [ ] 한글 이미지 분석 성공
- [ ] JSON 응답 정상 파싱
- [ ] 재분석 버튼 동작 확인

## 향후 계획

- Qwen3-VL ONNX 버전 출시 시 업그레이드 검토 (더 나은 성능)
- 현재 Qwen3-VL은 ONNX 변환 미지원으로 대기 중

## 참고 자료

- [onnx-community/Qwen2-VL-2B-Instruct](https://huggingface.co/onnx-community/Qwen2-VL-2B-Instruct)
- [Qwen2-VL 공식 블로그](https://qwenlm.github.io/blog/qwen2-vl/)
- [Transformers.js WebGPU 가이드](https://huggingface.co/docs/transformers.js/guides/webgpu)
