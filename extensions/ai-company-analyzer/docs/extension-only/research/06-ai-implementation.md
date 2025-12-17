# AI 분석 구현 방안

> 조사일: 2025-12-15
> 관련 스펙: [04-ai-analysis.md](../spec/04-ai-analysis.md)

## 1. 기술 결정 요약

### 1.1 비교표

| 항목 | Chrome 빌트인 AI | WebLLM | 외부 API (OpenAI) |
|------|-----------------|--------|------------------|
| **한국어 지원** | ❌ (영어, 일본어, 스페인어만) | ✅ (Qwen 모델) | ✅ |
| **멀티모달** | ⚠️ Origin Trial | ❌ | ✅ |
| **오프라인** | ✅ | ✅ | ❌ |
| **프라이버시** | ✅ 로컬 | ✅ 로컬 | ❌ 외부 전송 |
| **비용** | 무료 | 무료 | 사용량 과금 |
| **다운로드** | 22GB 필요 | 1-5GB | 없음 |
| **포트폴리오 차별화** | 낮음 | ⭐ 높음 | 낮음 |

### 1.2 최종 선택

| 기능 | 라이브러리 | 모델 |
|------|-----------|------|
| **텍스트 분석** | WebLLM | Qwen2-1.5B-Instruct-q4f16 |
| **이미지 분석** | Transformers.js | vit-gpt2-image-captioning |

### 1.3 선택 근거

- **Chrome 빌트인 AI 제외**: Prompt API 한국어 미지원 (2025-12 기준)
- **WebLLM 선택**: 포트폴리오 차별화, 로컬 처리, Qwen 한국어 성능 우수
- **Transformers.js 병행**: WebLLM 멀티모달 미지원 보완

---

## 2. WebLLM 상세

### 2.1 개요

- **라이브러리**: `@mlc-ai/web-llm`
- **런타임**: WebGPU + WebAssembly
- **API 스타일**: OpenAI 호환
- **Chrome 버전**: 124+ (Service Worker WebGPU 지원)

### 2.2 Manifest V3 설정

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "tabs"],
  "host_permissions": ["https://huggingface.co/*"],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

**핵심:**
- `'wasm-unsafe-eval'` CSP 필수 (WebAssembly 실행)
- `type: "module"` 필수 (ES6 모듈)
- HuggingFace CDN 접근 권한 (모델 다운로드)

### 2.3 권장 모델

| 모델 | VRAM | 컨텍스트 | 다운로드 | 특징 |
|------|------|----------|----------|------|
| `Qwen2-0.5B-Instruct-q4f16` | ~700MB | 32K | ~500MB | 저사양용 |
| `Qwen2-1.5B-Instruct-q4f16` | ~1.4GB | 32K | ~1GB | **권장** ⭐ |
| `Qwen2-7B-Instruct-q4f16` | ~4.5GB | 32K | ~4GB | 고성능 |

**Qwen2-1.5B 선택 이유:**
- 한국어 성능 우수 (119개 언어 지원)
- 크기/성능 균형
- 대부분 PC에서 실행 가능

### 2.4 초기화 코드

```typescript
// background.ts (Service Worker)
import { CreateMLCEngine, type MLCEngine } from "@mlc-ai/web-llm";

let engine: MLCEngine | null = null;

async function initializeEngine() {
  engine = await CreateMLCEngine("Qwen2-1.5B-Instruct-q4f16-MLC", {
    initProgressCallback: (progress) => {
      // 진행 상황 전달
      chrome.runtime.sendMessage({
        type: 'INIT_PROGRESS',
        progress: progress.progress,
        text: progress.text
      });
    }
  });
}
```

### 2.5 스트리밍 응답

```typescript
async function chat(messages: Array<{ role: string; content: string }>) {
  if (!engine) throw new Error('Engine not initialized');

  const chunks = await engine.chat.completions.create({
    messages,
    temperature: 0.7,
    max_tokens: 512,
    stream: true
  });

  let response = '';
  for await (const chunk of chunks) {
    const delta = chunk.choices[0]?.delta.content || '';
    response += delta;
    // 실시간 전달
    chrome.runtime.sendMessage({ type: 'STREAM_CHUNK', content: delta });
  }
  return response;
}
```

### 2.6 에러 핸들링

```typescript
function handleError(error: Error): string {
  if (error.message.includes('Out of memory')) {
    return 'GPU 메모리 부족. 더 작은 모델을 선택하거나 다른 탭을 닫아주세요.';
  }
  if (error.message.includes('WebGPU')) {
    return 'WebGPU 미지원. Chrome 124+ 필요.';
  }
  if (error.message.includes('fetch')) {
    return '모델 다운로드 실패. 인터넷 연결 확인.';
  }
  return `오류: ${error.message}`;
}
```

### 2.7 Service Worker 유지

```typescript
// Chrome이 Service Worker를 kill하지 않도록
const HEARTBEAT_INTERVAL = 20000; // 20초

setInterval(() => {
  chrome.runtime.getPlatformInfo(() => {});
}, HEARTBEAT_INTERVAL);
```

---

## 3. Transformers.js 상세

### 3.1 개요

- **라이브러리**: `@huggingface/transformers`
- **용도**: 이미지 → 텍스트 변환 (캡셔닝)
- **WebLLM 보완**: 멀티모달 미지원 해결

### 3.2 이미지 캡셔닝

```typescript
import { pipeline } from '@huggingface/transformers';

// 파이프라인 초기화 (첫 실행 시 모델 다운로드)
const captioner = await pipeline(
  'image-to-text',
  'Xenova/vit-gpt2-image-captioning'
);

// 이미지 분석
const result = await captioner(imageBlob);
// result: [{ generated_text: "a graph showing revenue growth" }]
```

### 3.3 통합 파이프라인

```
[SVG 그래프]
    ↓
[canvg] → Canvas 변환
    ↓
[canvas.toBlob()] → Blob
    ↓
[Transformers.js] → 영어 캡션
    ↓
[WebLLM] → 상세 분석
```

### 3.4 권장 모델

| 태스크 | 모델 | 크기 |
|--------|------|------|
| 이미지 캡셔닝 | `Xenova/vit-gpt2-image-captioning` | ~300MB |
| OCR (선택) | `Xenova/trocr-base-printed` | ~200MB |

---

## 4. 아키텍처

### 4.1 전체 구조

```
┌─────────────────────────────────────────────────────┐
│ Chrome Extension                                      │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────┐    메시지     ┌──────────────────┐ │
│  │ Content     │ ←─────────→ │ Service Worker   │ │
│  │ Script      │              │                  │ │
│  │             │              │ ┌──────────────┐ │ │
│  │ - DOM 추출  │              │ │ WebLLM       │ │ │
│  │ - 요소 선택 │              │ │ (Qwen2-1.5B) │ │ │
│  └─────────────┘              │ └──────────────┘ │ │
│                               │                  │ │
│  ┌─────────────┐              │ ┌──────────────┐ │ │
│  │ Popup/      │ ←─────────→ │ │Transformers.js│ │ │
│  │ Pages       │              │ │ (이미지 분석)│ │ │
│  │             │              │ └──────────────┘ │ │
│  │ - UI        │              │                  │ │
│  │ - 상태 관리 │              │ ┌──────────────┐ │ │
│  └─────────────┘              │ │ IndexedDB    │ │ │
│                               │ │ (Dexie.js)   │ │ │
│                               │ └──────────────┘ │ │
│                               └──────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 4.2 메시지 흐름

```typescript
// Content Script → Service Worker
chrome.runtime.sendMessage({
  type: 'ANALYZE_TEXT',
  data: { text, analysisType: 'financial' }
});

// Service Worker → Content Script/Popup
chrome.runtime.sendMessage({
  type: 'ANALYSIS_RESULT',
  result: { runway_months: 18, risk_level: 'medium' }
});
```

### 4.3 분석 파이프라인

```
[데이터 추출 완료]
    ↓
[텍스트?] ──Yes──→ [WebLLM 분석]
    │
    No (이미지)
    ↓
[Transformers.js 캡셔닝]
    ↓
[캡션 텍스트]
    ↓
[WebLLM 상세 분석]
    ↓
[결과 저장 (IndexedDB)]
```

---

## 5. 성능 고려사항

### 5.1 GPU/메모리 요구사항

| 환경 | 최소 요구 | 권장 모델 |
|------|-----------|-----------|
| 통합 GPU (Intel Iris) | 2GB VRAM | Qwen2-0.5B |
| 중급 GPU (GTX 1650) | 4GB VRAM | Qwen2-1.5B ⭐ |
| 고급 GPU (RTX 3060) | 8GB+ VRAM | Qwen2-7B |

### 5.2 다운로드 크기

| 구성요소 | 크기 | 비고 |
|----------|------|------|
| WebLLM (Qwen2-1.5B) | ~1GB | 첫 실행만 |
| Transformers.js 모델 | ~300MB | 첫 실행만 |
| **합계** | ~1.3GB | Cache API에 저장 |

### 5.3 추론 속도 (Qwen2-1.5B, RTX 3060)

| 지표 | 값 |
|------|-----|
| 첫 토큰 (TTFT) | ~200ms |
| 스트리밍 | 15-25 tokens/sec |
| CPU 전용 | 3-5 tokens/sec |

### 5.4 UX 고려사항

**필수 구현:**
- 모델 다운로드 프로그레스 바
- GPU 체크 (WebGPU 지원 확인)
- 스트리밍 응답 UI
- 에러 메시지 (사용자 친화적)

**권장:**
- 모델 크기 선택 옵션
- 오프라인 모드 표시
- 추론 시간 표시

---

## 6. 스펙 업데이트 필요 사항

기존 04-ai-analysis.md 스펙에서 변경이 필요한 부분:

### 변경 전 (Chrome 빌트인 AI)
```
[한국어 데이터]
    ↓
[Language Detector] → 한국어 감지
    ↓
[Translator API] → 영어로 번역
    ↓
[Prompt API] → 분석
```

### 변경 후 (WebLLM + Transformers.js)
```
[한국어 데이터]
    ↓
[텍스트?] ──Yes──→ [WebLLM] → 분석 (한국어 직접 처리)
    │
    No (이미지)
    ↓
[Transformers.js] → 캡셔닝
    ↓
[WebLLM] → 상세 분석
```

**주요 변경점:**
1. 번역 파이프라인 제거 (Qwen 한국어 직접 지원)
2. Chrome AI API → WebLLM 교체
3. 이미지 분석 → Transformers.js 추가

---

## 7. 참고 자료

### WebLLM
- GitHub: https://github.com/mlc-ai/web-llm
- 문서: https://webllm.mlc.ai/docs/
- Extension 예제: https://github.com/mlc-ai/web-llm/tree/main/examples/chrome-extension-webgpu-service-worker

### Transformers.js
- 문서: https://huggingface.co/docs/transformers.js
- 이미지 캡셔닝: https://huggingface.co/Xenova/vit-gpt2-image-captioning

### Qwen 모델
- 블로그: https://qwenlm.github.io/blog/qwen3/
- 다국어 지원: 119개 언어 (한국어 포함)

### Chrome Extension + WebGPU
- Chrome 124 릴리즈 노트: https://developer.chrome.com/blog/new-in-chrome-124
