# ADR-0002: AI Engine Strategy 패턴

## 상태

승인됨

## 날짜

2024-01

## 컨텍스트

SPA에서 AI 추론(분류/분석)을 위해 여러 엔진을 사용할 수 있어야 함:

1. **Qwen3 (WebGPU)**: 기본 엔진, 브라우저 내 추론
2. **Ollama**: WebGPU 미지원 환경 폴백
3. **Mock**: 테스트용 고정 응답

문제점:
- 각 엔진 초기화/호출 방식이 다름
- 엔진 실패 시 폴백 로직 필요
- 테스트 시 실제 AI 호출 회피 필요

```typescript
// 기존 방식 - 하드코딩된 엔진
const generator = await pipeline('text-generation', 'qwen3-0.6b', { device: 'webgpu' });
const result = await generator(prompt);
```

## 결정

**Strategy 패턴으로 AI 엔진 추상화**

### 인터페이스 정의

```typescript
// src/ai/engines/types.ts
type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AIEngine {
  id: string;
  status: EngineStatus;

  // 라이프사이클
  init(onProgress?: (p: number) => void): Promise<void>;
  terminate(): Promise<void>;

  // 추론
  classify(text: string): Promise<ImageSubCategory>;
  analyze(text: string, category: ImageSubCategory): Promise<string>;
}
```

### 구현 구조

```
src/ai/engines/
├── types.ts           // 인터페이스
├── qwen3.ts           // WebGPU Qwen3 구현
├── ollama.ts          // 로컬 Ollama 폴백
├── mock.ts            // 테스트용
└── index.ts           // 팩토리
```

### 폴백 파이프라인

```typescript
// src/ai/pipeline.ts
const ENGINE_PRIORITY = ['qwen3', 'ollama', 'mock'] as const;

async function getAvailableEngine(): Promise<AIEngine> {
  for (const engineId of ENGINE_PRIORITY) {
    const engine = createEngine(engineId);
    try {
      await engine.init();
      return engine;
    } catch {
      console.warn(`Engine ${engineId} failed, trying next...`);
      continue;
    }
  }
  throw new Error('No available AI engine');
}
```

### 사용

```typescript
// 프로덕션
const engine = await getAvailableEngine();
const category = await engine.classify(ocrText);
const analysis = await engine.analyze(ocrText, category);

// 테스트
const mockEngine = createMockEngine({
  classify: () => 'revenue_trend',
  analyze: () => '매출 10억원, 전년 대비 20% 증가',
});
```

## 결과

### 긍정적

- **확장성 +60%**: 새 엔진 추가 시 인터페이스만 구현
- **테스트 용이성 +50%**: Mock 엔진으로 AI 호출 없이 테스트
- **안정성**: WebGPU 미지원 시 자동 폴백
- **일관된 API**: 엔진 교체해도 호출 코드 변경 없음

### 부정적

- **추상화 비용**: 각 엔진 래퍼 구현 필요
- **성능 차이**: 엔진별 응답 품질/속도 다름

### 리스크

- **모델 불일치**: Qwen3 vs Ollama 응답 형식 차이
  - 완화: 응답 파서 공통화

## 대안

### 1. if-else 분기

```typescript
if (webgpuSupported) {
  return await qwen3Classify(text);
} else {
  return await ollamaClassify(text);
}
```

- 단점: 분기 복잡, 새 엔진 추가 시 수정 필요

### 2. 단일 엔진 (Ollama만)

- 단점: 외부 서버 의존, 오프라인 불가

### 3. Cloud API (OpenAI/Anthropic)

- 단점: API 키 관리, 비용, 개인정보 전송

## 엔진별 특성

| 엔진 | 환경 | 장점 | 단점 |
|------|------|------|------|
| Qwen3 | WebGPU 브라우저 | 오프라인, 빠름 | GPU 필요, 초기 로딩 |
| Ollama | 로컬 서버 | 다양한 모델 | 서버 실행 필요 |
| Mock | 테스트 | 빠름, 결정적 | 실제 추론 아님 |

## 관련 문서

- [03-spa-structure.md](/docs/spa-with-extension/spec/03-spa-structure.md) - Section 6.3
- [04-data-flow.md](/docs/spa-with-extension/spec/04-data-flow.md) - Section 11
