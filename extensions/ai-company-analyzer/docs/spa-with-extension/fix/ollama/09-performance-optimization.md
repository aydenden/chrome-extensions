# 09. Ollama 이미지 분석 성능 최적화

## 배경

`docs/spa-with-extension/research/05-ollama-http.md` 문서에서 제안한 최적화 전략을 현재 구현에 적용.

## 현재 상태 vs 목표

| 항목 | Before | After |
|------|--------|-------|
| 이미지 페이로드 | 10~50 MB (원본) | 100~500 KB |
| 리사이징 | 없음 | 32배수 정렬, max 100만 픽셀 |
| 이미지 포맷 | PNG 원본 | JPEG (quality 0.85) |
| keep_alive | 기본 5분 | -1 (무한) / 0 (즉시 언로드) |
| 스트리밍 | stream: false | stream: true |
| 체감 응답성 | 전체 대기 | 토큰별 렌더링 |

## 수정 대상 파일

- `spa/src/lib/image/optimizer.ts` (신규)
- `spa/src/contexts/OllamaContext.tsx`
- `spa/src/pages/Analysis.tsx`

---

## 1. 이미지 스마트 리사이징 + JPEG 압축

### 신규 파일: `spa/src/lib/image/optimizer.ts`

```typescript
/**
 * Qwen3-VL 최적화 이미지 전처리
 * - 32 배수 정렬 (패치 단위)
 * - max_pixels 제한 (약 100만 픽셀)
 * - JPEG 압축 (quality 0.85)
 */

const PATCH_SIZE = 32;  // Qwen3-VL 패치 단위
const MAX_PIXELS = 2073600;  // 약 1440x1440 - 텍스트/숫자 인식 가능
const MIN_PIXELS = 200704;   // 약 448x448
const JPEG_QUALITY = 0.92;   // 텍스트 선명도 유지

export async function optimizeImageForVLM(base64: string): Promise<string> {
  // 1. Base64 → ImageBitmap
  const blob = base64ToBlob(base64);
  const bitmap = await createImageBitmap(blob);

  // 2. 스마트 리사이징 (32 배수 정렬)
  const { width, height } = calculateOptimalSize(
    bitmap.width, bitmap.height, MIN_PIXELS, MAX_PIXELS, PATCH_SIZE
  );

  // 3. Canvas로 리사이징 + JPEG 압축
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);

  // 4. JPEG Base64 반환 (data:image/jpeg;base64, 제거)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
}

function base64ToBlob(base64: string): Blob {
  // data:image/xxx;base64, 프리픽스 처리
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteString = atob(base64Data);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return new Blob([uint8Array], { type: 'image/jpeg' });
}

function calculateOptimalSize(
  origW: number, origH: number,
  minPixels: number, maxPixels: number,
  patchSize: number
): { width: number; height: number } {
  const pixels = origW * origH;
  let scale = 1;

  if (pixels > maxPixels) {
    scale = Math.sqrt(maxPixels / pixels);
  } else if (pixels < minPixels) {
    scale = Math.sqrt(minPixels / pixels);
  }

  // 패치 단위(32)로 정렬
  const width = Math.round((origW * scale) / patchSize) * patchSize;
  const height = Math.round((origH * scale) / patchSize) * patchSize;

  return {
    width: Math.max(patchSize, width),
    height: Math.max(patchSize, height)
  };
}
```

### Analysis.tsx 수정

```typescript
// import 추가
import { optimizeImageForVLM } from '@/lib/image/optimizer';

// Step 1: 이미지 로드 후 최적화 적용
for (let i = 0; i < images.length; i++) {
  const imageData = await client.send('GET_IMAGE_DATA', { imageId: images[i].id });
  const optimizedBase64 = await optimizeImageForVLM(imageData.base64);  // 추가
  imageDataList.push({
    id: imageData.id,
    base64: optimizedBase64,  // 최적화된 이미지 사용
  });
}
```

---

## 2. Keep-Alive 동적 제어

### 목표
- 분석 중: 모델 메모리 유지 (`keep_alive: -1`)
- 세션 종료: 즉시 언로드 (`keep_alive: 0`)

### OllamaContext.tsx 수정

```typescript
// ChatOptions 타입에 keepAlive 추가
export interface ChatOptions {
  // ... 기존 필드
  keepAlive?: number | string;  // -1: 무한, 0: 즉시 언로드, "60m": 60분
}

// chat 함수에서 keep_alive 전달
const chat = useCallback(async (
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<string> => {
  // ...
  body: JSON.stringify({
    model: state.selectedModel,
    messages,
    stream: false,
    format: options?.format,
    keep_alive: options?.keepAlive ?? -1,  // 기본 무기한
    options: ollamaOptions
  })
});

// 모델 언로드 함수 추가
const unloadModel = useCallback(async () => {
  if (!state.selectedModel) return;

  await fetch(`${state.endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: state.selectedModel,
      messages: [],
      keep_alive: 0
    })
  });
}, [state.endpoint, state.selectedModel]);
```

### Analysis.tsx: 세션 종료 시 언로드

```typescript
const { endpoint, selectedModel, unloadModel } = useOllama();

// 탭/페이지 종료 시 모델 언로드
useEffect(() => {
  const handleUnload = () => {
    // Beacon API로 비동기 요청 (탭 닫힘에도 전송 보장)
    navigator.sendBeacon(
      `${endpoint}/api/chat`,
      JSON.stringify({ model: selectedModel, messages: [], keep_alive: 0 })
    );
  };

  window.addEventListener('beforeunload', handleUnload);
  return () => window.removeEventListener('beforeunload', handleUnload);
}, [endpoint, selectedModel]);
```

---

## 3. 스트리밍 응답

### 목표
- 토큰 생성 즉시 UI 업데이트
- TTFT(첫 토큰 시간) 체감 개선

### OllamaContext.tsx: 스트리밍 함수 추가

```typescript
// analyzeImageStream 함수 추가
const analyzeImageStream = useCallback(async function* (
  imageBase64: string,
  prompt: string,
  options?: ChatOptions
): AsyncGenerator<string> {
  if (!state.selectedModel) throw new Error('모델이 선택되지 않았습니다');

  const ollamaOptions: Record<string, number> = {};
  if (options?.temperature !== undefined) ollamaOptions.temperature = options.temperature;
  if (options?.num_predict) ollamaOptions.num_predict = options.num_predict;

  const res = await fetch(`${state.endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: state.selectedModel,
      messages: [{
        role: 'user',
        content: prompt,
        images: [imageBase64]
      }],
      stream: true,
      keep_alive: options?.keepAlive ?? -1,
      format: options?.format,
      options: Object.keys(ollamaOptions).length > 0 ? ollamaOptions : undefined
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama API 오류: ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.message?.content) {
          yield json.message.content;
        }
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }
  }
}, [state.endpoint, state.selectedModel]);
```

### Analysis.tsx: 스트리밍 UI

```typescript
const { analyzeImageStream } = useOllama();
const [currentStreamText, setCurrentStreamText] = useState('');

// 스트리밍 분석
let fullText = '';
for await (const chunk of analyzeImageStream(base64, prompt, analysisOptions)) {
  fullText += chunk;
  setCurrentStreamText(fullText);  // 실시간 UI 업데이트
}

const analysis = parseJSON(fullText);
```

---

## 4. (선택) Web Workers 이미지 처리

### 구현 복잡도: 높음
- OffscreenCanvas 사용 필요
- Worker 파일 별도 빌드 설정 필요
- 현재 이미지 크기가 크지 않다면 우선순위 낮음

**→ 1~3번 구현 후 성능 테스트 결과에 따라 결정**

---

## 구현 체크리스트

- [x] `spa/src/lib/image/optimizer.ts` 생성
- [x] `spa/src/lib/image/index.ts` 생성 (export)
- [x] `spa/src/lib/ai/types.ts`: keepAlive 타입 추가
- [x] `Analysis.tsx`: 이미지 최적화 적용
- [x] `OllamaContext.tsx`: keep_alive 파라미터 추가
- [x] `OllamaContext.tsx`: unloadModel 함수 추가
- [x] `OllamaContext.tsx`: analyzeImageStream 함수 추가
- [x] `Analysis.tsx`: beforeunload 언로드 훅 추가
- [ ] (선택) `Analysis.tsx`: 스트리밍 UI 적용
- [ ] 테스트: 이미지 크기 감소 확인
- [ ] 테스트: 스트리밍 동작 확인

## 참고 문서

- `docs/spa-with-extension/research/05-ollama-http.md` - 최적화 전략 상세
- [Ollama API docs](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Ollama Keep-Alive FAQ](https://docs.ollama.com/faq)
