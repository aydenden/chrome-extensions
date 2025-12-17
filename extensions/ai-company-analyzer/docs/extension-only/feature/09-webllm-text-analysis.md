# 09. WebLLM 텍스트 분석

## 개요
WebLLM + Qwen2-1.5B 기반 텍스트 AI 분석 구현

## 선행 조건
- 02-data-storage 완료

## 기술 스택
| 분류 | 기술 | 버전 |
|------|------|------|
| LLM 엔진 | @mlc-ai/web-llm | 최신 |
| 모델 | Qwen2-1.5B-Instruct-q4f16-MLC | ~1GB |
| 실행 환경 | Service Worker (WebGPU) | Chrome 124+ |

---

## 모델 선택 이유

| 항목 | WebLLM + Qwen2 | Chrome 빌트인 AI |
|------|---------------|-----------------|
| 한국어 | ✅ 직접 지원 | ❌ 미지원 |
| 다운로드 | ~1GB | 22GB |
| 프라이버시 | ✅ 로컬 | ✅ 로컬 |
| 포트폴리오 | ⭐ 차별화 | 일반적 |

---

## 구현

### src/background/webllm-engine.ts

```typescript
import * as webllm from '@mlc-ai/web-llm';

// 상태
let engine: webllm.MLCEngine | null = null;
let isLoading = false;
let loadProgress = 0;

// 모델 설정
const MODEL_ID = 'Qwen2-1.5B-Instruct-q4f16_1-MLC';

/**
 * WebLLM 엔진 초기화
 */
export async function initEngine(
  onProgress?: (progress: number, text: string) => void
): Promise<void> {
  if (engine) return;
  if (isLoading) return;

  isLoading = true;

  try {
    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report) => {
        loadProgress = report.progress;
        onProgress?.(report.progress, report.text);
      },
    });

    console.log('WebLLM 엔진 초기화 완료');
  } catch (error) {
    console.error('WebLLM 엔진 초기화 실패:', error);
    throw error;
  } finally {
    isLoading = false;
  }
}

/**
 * 엔진 상태 확인
 */
export function getEngineStatus(): {
  isReady: boolean;
  isLoading: boolean;
  progress: number;
} {
  return {
    isReady: engine !== null,
    isLoading,
    progress: loadProgress,
  };
}

/**
 * 텍스트 생성 (스트리밍)
 */
export async function generateText(
  prompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    onToken?: (token: string) => void;
  } = {}
): Promise<string> {
  if (!engine) {
    throw new Error('엔진이 초기화되지 않았습니다.');
  }

  const { maxTokens = 1024, temperature = 0.7, onToken } = options;

  const messages: webllm.ChatCompletionMessageParam[] = [
    { role: 'user', content: prompt },
  ];

  let result = '';

  // 스트리밍 생성
  const chunks = await engine.chat.completions.create({
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  });

  for await (const chunk of chunks) {
    const delta = chunk.choices[0]?.delta?.content || '';
    result += delta;
    onToken?.(delta);
  }

  return result;
}

/**
 * 재무 분석
 */
export async function analyzeFinancials(
  data: string,
  onToken?: (token: string) => void
): Promise<{
  runway?: { months: number; confidence: string; reasoning: string };
  risk?: { level: string; factors: string[] };
}> {
  const prompt = `다음 재무 데이터를 분석해주세요.

데이터:
${data}

다음 형식으로 JSON 응답해주세요:
{
  "runway": {
    "months": 예상 현금 소진 기간 (숫자),
    "confidence": "high" | "medium" | "low",
    "reasoning": "분석 근거"
  },
  "risk": {
    "level": "high" | "medium" | "low",
    "factors": ["리스크 요인1", "리스크 요인2"]
  }
}`;

  const result = await generateText(prompt, { onToken });

  try {
    // JSON 추출
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('JSON 파싱 실패:', error);
  }

  return {};
}

/**
 * 리뷰 분석
 */
export async function analyzeReviews(
  reviews: string[],
  onToken?: (token: string) => void
): Promise<{
  positive: string[];
  negative: string[];
  summary: string;
}> {
  const prompt = `다음 회사 리뷰들을 분석해주세요.

리뷰:
${reviews.join('\n---\n')}

다음 형식으로 JSON 응답해주세요:
{
  "positive": ["긍정적 키워드1", "긍정적 키워드2"],
  "negative": ["부정적 키워드1", "부정적 키워드2"],
  "summary": "전체 리뷰 요약 (2-3문장)"
}`;

  const result = await generateText(prompt, { onToken });

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('JSON 파싱 실패:', error);
  }

  return { positive: [], negative: [], summary: '' };
}

/**
 * 종합 점수 계산
 */
export async function calculateTotalScore(
  financialAnalysis: any,
  reviewAnalysis: any,
  weights: { financial: number; review: number }
): Promise<{
  score: number;
  reasoning: string;
}> {
  const prompt = `다음 분석 결과를 바탕으로 종합 점수를 계산해주세요.

재무 분석:
${JSON.stringify(financialAnalysis, null, 2)}

리뷰 분석:
${JSON.stringify(reviewAnalysis, null, 2)}

가중치: 재무 ${weights.financial}%, 리뷰 ${weights.review}%

1~5점 사이로 점수를 매기고 근거를 설명해주세요.
JSON 형식: { "score": 숫자, "reasoning": "근거" }`;

  const result = await generateText(prompt);

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('JSON 파싱 실패:', error);
  }

  return { score: 0, reasoning: '' };
}

// ============ Service Worker 유지 ============

// Chrome이 Service Worker를 종료하지 않도록 heartbeat
const HEARTBEAT_INTERVAL = 20000; // 20초

setInterval(() => {
  chrome.runtime.getPlatformInfo(() => {});
}, HEARTBEAT_INTERVAL);

// ============ 메시지 핸들러 ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INIT_WEBLLM') {
    initEngine((progress, text) => {
      // 진행률 브로드캐스트
      chrome.runtime.sendMessage({
        type: 'WEBLLM_PROGRESS',
        payload: { progress, text },
      });
    }).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // 비동기 응답
  }

  if (message.type === 'ANALYZE_FINANCIALS') {
    analyzeFinancials(message.payload.data).then((result) => {
      sendResponse({ success: true, result });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'ANALYZE_REVIEWS') {
    analyzeReviews(message.payload.reviews).then((result) => {
      sendResponse({ success: true, result });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});
```

---

## 사용 예시

### 팝업에서 엔진 초기화

```typescript
// 엔진 상태 확인
const status = await chrome.runtime.sendMessage({ type: 'GET_ENGINE_STATUS' });

if (!status.isReady) {
  // 초기화 시작
  chrome.runtime.sendMessage({ type: 'INIT_WEBLLM' });

  // 진행률 수신
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'WEBLLM_PROGRESS') {
      console.log(`로딩: ${(message.payload.progress * 100).toFixed(1)}%`);
    }
  });
}
```

### 재무 분석 요청

```typescript
const result = await chrome.runtime.sendMessage({
  type: 'ANALYZE_FINANCIALS',
  payload: { data: '매출액: 1000억, 영업이익: 100억...' },
});

if (result.success) {
  console.log('분석 결과:', result.result);
}
```

---

## Manifest 설정

```json
{
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

---

## 성능 고려사항

| 항목 | 값 |
|------|-----|
| 모델 다운로드 | ~1GB (첫 실행만) |
| 메모리 사용 | ~1.4GB VRAM |
| 첫 토큰 지연 | ~200ms (GPU) |
| 생성 속도 | 15-25 tokens/sec (GPU) |
| CPU 속도 | 3-5 tokens/sec |

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/background/webllm-engine.ts` | WebLLM 엔진 및 분석 함수 |

---

## 참조 문서
- [spec/04-ai-analysis.md](../spec/04-ai-analysis.md) - AI 분석
- [research/06-ai-implementation.md](../research/06-ai-implementation.md) - AI 구현 기술 조사
