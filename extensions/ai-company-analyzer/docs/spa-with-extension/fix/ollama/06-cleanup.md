# Cleanup 체크리스트

## 개요

WebGPU, OCR, Mock 관련 코드를 정리합니다.

---

## 1. 삭제할 파일

### 전체 파일 삭제

| 파일 | 이유 |
|------|------|
| `spa/src/lib/ai/engines/qwen3.ts` | WebGPU 엔진 |
| `spa/src/lib/ai/engines/mock.ts` | Mock 엔진 |
| `spa/src/lib/ai/webgpu-check.ts` | WebGPU 지원 확인 |
| `spa/src/contexts/OCRContext.tsx` | Tesseract OCR |
| `spa/src/hooks/useOCRBatch.ts` | OCR 배치 처리 |

### 삭제 명령어
```bash
rm spa/src/lib/ai/engines/qwen3.ts
rm spa/src/lib/ai/engines/mock.ts
rm spa/src/lib/ai/webgpu-check.ts
rm spa/src/contexts/OCRContext.tsx
rm spa/src/hooks/useOCRBatch.ts
```

---

## 2. 수정할 파일

### 2.1 engine-factory.ts

**파일**: `spa/src/lib/ai/engine-factory.ts`

```typescript
// 삭제: qwen3, mock import 및 case
import { Qwen3Engine } from './engines/qwen3';  // 삭제
import { MockEngine } from './engines/mock';    // 삭제

// 삭제: switch case
case 'qwen3':
  return new Qwen3Engine();  // 삭제
case 'mock':
  return new MockEngine();   // 삭제
```

### 2.2 AIContext.tsx

**파일**: `spa/src/contexts/AIContext.tsx`

```typescript
// 삭제: WebGPU 체크
import { checkWebGPUSupport } from '@/lib/ai/webgpu-check';  // 삭제

// 삭제: qwen3 fallback 로직
if (engineType === 'qwen3') {
  const webgpu = await checkWebGPUSupport();
  if (!webgpu.supported) continue;  // 삭제
}

// 삭제: engines 배열에서 qwen3, mock
const engines: Array<'qwen3' | 'ollama' | 'mock'> = ...  // 수정 필요

// 삭제: 디버깅 로그
console.log('[AIContext] ...');  // 모든 디버깅 로그 삭제
```

### 2.3 App.tsx

**파일**: `spa/src/App.tsx`

```typescript
// 삭제: OCRProvider
import { OCRProvider } from '@/contexts/OCRContext';  // 삭제

// 삭제: OCRProvider 사용
<OCRProvider>  // 삭제
  ...
</OCRProvider>  // 삭제

// 추가: OllamaProvider
import { OllamaProvider } from '@/contexts/OllamaContext';

<OllamaProvider>
  ...
</OllamaProvider>
```

### 2.4 Analysis.tsx

**파일**: `spa/src/pages/Analysis.tsx`

```typescript
// 삭제: OCR 관련
import { useOCR } from '@/contexts/OCRContext';        // 삭제
import { useOCRBatch } from '@/hooks/useOCRBatch';    // 삭제

const { isReady: ocrReady } = useOCR();               // 삭제
const { processBatch: processOCRBatch } = useOCRBatch();  // 삭제

// 삭제: OCR 처리 로직
const ocrResults = await processOCRBatch(imageDataList);  // 삭제

// 삭제: AI 엔진 초기화 UI
const { status: aiStatus, engineName, initialize: initAI } = useAI();  // 삭제
<Button onClick={handleInitAI}>AI 엔진 초기화</Button>  // 삭제

// 삭제: 디버깅 로그
console.log('[Analysis] ...');  // 모든 디버깅 로그 삭제
```

### 2.5 Settings.tsx

**파일**: `spa/src/pages/Settings.tsx`

```typescript
// 삭제: AI 엔진 선택 UI
<div>
  <label>AI 엔진</label>
  <input type="radio" value="qwen3" />  // 삭제
  <input type="radio" value="ollama" />  // 삭제
</div>

// 삭제: OCR 설정 UI
<div>
  <label>OCR 언어</label>
  <select>...</select>  // 삭제
</div>

// 삭제: Qwen3 관련 텍스트
"WebGPU 기반 로컬 AI..."  // 삭제
```

### 2.6 settings.ts

**파일**: `spa/src/lib/settings.ts`

```typescript
// 수정: AppSettings 인터페이스
interface AppSettings {
  // 삭제
  aiEngine: 'qwen3' | 'ollama' | 'mock';
  ocrLanguage: 'kor' | 'eng' | 'kor+eng';

  // 유지/수정
  ollamaEndpoint: string;
  ollamaModel: string;  // 추가
}

// 수정: 기본값
const DEFAULT_SETTINGS: AppSettings = {
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: ''
};
```

### 2.7 vite.config.ts

**파일**: `spa/vite.config.ts`

```typescript
// 삭제: optimizeDeps
optimizeDeps: {
  include: ['tesseract.js', '@huggingface/transformers'],  // 삭제
  exclude: ['lindera-wasm-ko-dic'],  // 삭제 또는 유지 (lindera 사용 시)
},

// 삭제: manualChunks
manualChunks: {
  ai: ['@huggingface/transformers'],  // 삭제
  ocr: ['tesseract.js', ...],         // 삭제
}
```

---

## 3. 의존성 삭제

### package.json

**파일**: `spa/package.json`

```json
// 삭제
"dependencies": {
  "@huggingface/transformers": "^3.8.1",  // 삭제
  "tesseract.js": "^7.0.0"                 // 삭제
}
```

### 삭제 명령어
```bash
cd spa
bun remove @huggingface/transformers tesseract.js
```

---

## 4. 타입 정리

### vite-env.d.ts

**파일**: `spa/src/vite-env.d.ts`

```typescript
// 삭제: WebGPU 타입 (사용하지 않으면)
interface GPU { ... }
interface GPUAdapter { ... }
interface GPUDevice { ... }
// 등 WebGPU 관련 인터페이스
```

### types.ts

**파일**: `spa/src/lib/ai/types.ts`

```typescript
// 수정: 엔진 타입에서 qwen3, mock 제거 (필요시)
type AIEngineType = 'qwen3' | 'ollama' | 'mock';  // → 'ollama'만 유지할지 검토
```

---

## 5. 체크리스트

### 파일 삭제
- [ ] `spa/src/lib/ai/engines/qwen3.ts`
- [ ] `spa/src/lib/ai/engines/mock.ts`
- [ ] `spa/src/lib/ai/webgpu-check.ts`
- [ ] `spa/src/contexts/OCRContext.tsx`
- [ ] `spa/src/hooks/useOCRBatch.ts`

### 코드 수정
- [ ] `spa/src/lib/ai/engine-factory.ts` - qwen3, mock case 제거
- [ ] `spa/src/contexts/AIContext.tsx` - WebGPU 체크, fallback 제거
- [ ] `spa/src/App.tsx` - OCRProvider 제거, OllamaProvider 추가
- [ ] `spa/src/pages/Analysis.tsx` - OCR 로직 제거
- [ ] `spa/src/pages/Settings.tsx` - AI 엔진 선택, OCR 설정 제거
- [ ] `spa/src/lib/settings.ts` - 설정 구조 변경
- [ ] `spa/vite.config.ts` - 번들 설정 정리

### 의존성 삭제
- [ ] `@huggingface/transformers` 제거
- [ ] `tesseract.js` 제거

### 디버깅 로그 제거
- [ ] AIContext.tsx의 console.log
- [ ] Analysis.tsx의 console.log

### 테스트
- [ ] Ollama 연결 확인
- [ ] 모델 목록 조회
- [ ] 이미지 분석 테스트
- [ ] 결과 저장 확인

---

## 6. 주의사항

### lindera 관련
- `lindera-wasm`, `lindera-wasm-ko-dic`은 한국어 형태소 분석용
- OCR 제거 시에도 필요하면 유지, 아니면 함께 삭제

### AIContext vs OllamaContext
- AIContext는 기존 AI 엔진 인터페이스 제공
- OllamaContext는 Ollama 연결/모델 관리
- 두 Context를 통합할지 분리 유지할지 결정 필요

### 호환성
- `rawText` 필드는 기존 데이터 호환을 위해 유지
- AI가 이미지에서 추출한 텍스트를 저장
