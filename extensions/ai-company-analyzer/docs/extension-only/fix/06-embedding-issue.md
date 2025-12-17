# 임베딩 실패 문제 분석

## 문제 상황

E2E 테스트에서 임베딩 단계 실패:

```
[company-info-small.png] 상태: embedding, 카테고리: table_data
[company-info-small.png] 상태: failed, 카테고리: table_data
[company-info-small.png] 임베딩 실패 (서비스 워커 재시작 문제): document is not defined
```

---

## 근본 원인

### 1. Service Worker 제한사항

Chrome Extension의 Service Worker에서는 동적 import(`import()`)가 금지되어 있습니다.

```
Error: no available backend found. ERR: [webgpu] TypeError: import() is disallowed on ServiceWorkerGlobalScope
```

### 2. ONNX Runtime 아키텍처

`@huggingface/transformers` v3은 내부적으로 `onnxruntime-web`을 사용합니다. ONNX Runtime은 WASM 백엔드 초기화 시 동적 import를 수행하여 Service Worker 환경에서 실패합니다.

### 3. Web Worker 프록시 문제

ONNX Runtime이 Web Worker를 생성하려 할 때 `document`를 참조하는 코드가 있어서, Offscreen Document에서도 특정 상황에서 오류가 발생합니다.

---

## 시도한 해결책

### 1. WASM 로컬 번들링

**변경 파일:** `vite.config.ts`

```typescript
// onnxruntime-web WASM 파일 복사
const ortWasmFiles = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.mjs',
];

for (const wasmFile of ortWasmFiles) {
  copyFileSync(
    resolve(__dirname, `../../node_modules/onnxruntime-web/dist/${wasmFile}`),
    resolve(transformersDir, wasmFile)
  );
}
```

**결과:** ❌ 실패 - CDN 의존성은 해결했으나 동적 import 문제 지속

### 2. Offscreen Document 구현

**새로 생성된 파일:**
- `src/offscreen/offscreen.html`
- `src/offscreen/offscreen.ts`

**변경된 파일:**
- `src/background/embedding-engine.ts` → Offscreen 프록시로 변경
- `manifest.json` → offscreen 권한 추가

**통신 패턴:**

```
Service Worker ──OFFSCREEN_GENERATE_EMBEDDINGS──> Offscreen Document
                                                        ↓
                                                   transformers.js 실행
                                                        ↓
Service Worker <──────{ embeddings }─────────────── 결과 반환
```

**결과:** ❌ 실패 - Offscreen Document에서도 동일한 오류 발생

### 3. ONNX Runtime 환경 설정

**`src/offscreen/offscreen.ts`**

```typescript
// onnxruntime-web 먼저 import하여 설정 적용
import * as ort from 'onnxruntime-web';

ort.env.wasm.proxy = false;           // Web Worker 프록시 비활성화
ort.env.wasm.numThreads = 1;          // 싱글 스레드 모드
ort.env.wasm.wasmPaths = chrome.runtime.getURL('dist/transformers/');

// transformers.js 환경 설정
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('dist/transformers/');
env.backends.onnx.wasm.numThreads = 1;
```

**결과:** ❌ 실패 - 설정이 적용되기 전에 초기화 시작

### 4. device: 'wasm' 명시적 지정

```typescript
model = await AutoModel.from_pretrained(MODEL_ID, {
  device: 'wasm',  // WebGPU 대신 WASM 강제 사용
  progress_callback: (p) => { ... },
});
```

**결과:** ❌ 실패 - WebGPU 시도 없이 WASM으로 바로 가지만 동일 오류

---

## 관련 GitHub 이슈

- [microsoft/onnxruntime#20876](https://github.com/microsoft/onnxruntime/issues/20876) - Service Worker에서 WebGPU/WASM 백엔드 사용 불가
- [microsoft/onnxruntime#23063](https://github.com/microsoft/onnxruntime/discussions/23063) - Chrome MV3 Extension WASM 초기화 문제
- [huggingface/transformers.js#787](https://github.com/huggingface/transformers.js/issues/787) - transformers.js v3 Service Worker 호환성

---

## 현재 상태

| 단계 | 상태 | 비고 |
|------|------|------|
| 분류 (classifying) | ✅ 성공 | Qwen2-VL 모델 |
| 텍스트 추출 (extracting_text) | ✅ 성공 | JSON 메타데이터 |
| 임베딩 (embedding) | ❌ 실패 | `document is not defined` |
| RAG 분석 | ⏭️ 스킵 | 임베딩 필요 |

---

## 대안

### 1. 임베딩 없이 운영 (현재)

분류와 텍스트 추출만 사용하고, 임베딩 기반 RAG 분석은 비활성화합니다.

**장점:** 즉시 사용 가능
**단점:** 벡터 검색 기반 분석 불가

### 2. 외부 임베딩 API 사용

OpenAI, Cohere, Hugging Face Inference API 등을 활용합니다.

```typescript
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'text-embedding-3-small',
    input: text,
  }),
});
```

**장점:** 안정적, 고품질 임베딩
**단점:** 네트워크 의존성, 비용 발생, API 키 관리 필요

### 3. transformers.js v2 다운그레이드

v2는 ONNX Runtime 초기화 방식이 달라서 문제가 덜 할 수 있습니다.

```bash
bun remove @huggingface/transformers
bun add @xenova/transformers  # v2
```

**장점:** 로컬 실행 유지
**단점:** 최신 기능/모델 사용 불가, 다른 호환성 문제 가능

### 4. 향후 업데이트 대기

onnxruntime-web과 transformers.js가 Chrome Extension 환경을 더 잘 지원할 때까지 대기합니다.

**관련 PR:** [microsoft/onnxruntime#20898](https://github.com/microsoft/onnxruntime/pull/20898) - Service Worker용 특별 번들

---

## 수정된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `vite.config.ts` | WASM 파일 복사 플러그인 추가 |
| `manifest.json` | offscreen 권한, web_accessible_resources |
| `src/offscreen/offscreen.html` | 신규 - Offscreen Document HTML |
| `src/offscreen/offscreen.ts` | 신규 - 임베딩 엔진 실제 실행 |
| `src/background/embedding-engine.ts` | Offscreen 메시지 프록시로 변경 |
| `src/background/extraction-queue.ts` | async isEmbeddingEngineReady() 수정 |
| `src/background/index.ts` | offscreen 메시지 바이패스 추가 |
| `package.json` | onnxruntime-web 의존성 추가 |

---

## 결론

transformers.js v3과 Chrome Extension MV3 Service Worker 환경 사이의 호환성 문제는 라이브러리 수준에서 해결되어야 합니다. 현재로서는 임베딩 기능을 비활성화하고, 분류 + 텍스트 추출 기능만 사용하는 것이 가장 실용적인 방안입니다.
