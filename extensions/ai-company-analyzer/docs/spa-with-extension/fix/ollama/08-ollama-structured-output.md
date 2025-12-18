# Ollama Structured Output

## 개요

Ollama 전환 후 발생한 이슈들과 해결 과정을 기록합니다.

---

## 이슈 1: 분석 속도 (5분/이미지)

### 증상
- qwen3-vl:8b로 분류 1분 + 분석 4분 = ~5분/이미지
- 2단계 플로우: 이미지 분류 → 분석

### 시도
- 2단계(분류→분석)를 1단계로 통합
- `temperature: 0.3` - 낮은 랜덤성으로 빠른 응답
- `num_predict: 1024` - 출력 토큰 제한

### 결과
- ~1분/이미지로 개선 (5배 향상)

---

## 이슈 2: Thinking 모드 비활성화 실패

### 증상
```json
{
  "thinking": "이미지를 분석해보면... (긴 사고 과정)",
  "content": ""  // 비어있음
}
```
- 응답에 `thinking` 필드가 계속 포함됨
- `content`는 비어있고 생각 과정만 출력

### 시도 1: API 파라미터 `think: false`

**파일**: `spa/src/contexts/OllamaContext.tsx`
```typescript
const res = await fetch(`${state.endpoint}/api/chat`, {
  body: JSON.stringify({
    model: state.selectedModel,
    messages,
    think: false  // 최상위 레벨에 배치
  })
});
```
→ ❌ 작동 안함

### 시도 2: 시스템 메시지에 `/no_think`

```typescript
const messagesWithNoThink = [
  { role: 'system', content: '/no_think' },
  ...messages
];
```
→ ❌ 작동 안함

### 시도 3: 프롬프트 끝에 `/no_think`

```typescript
const lastMsg = messages[messages.length - 1];
lastMsg.content = `${lastMsg.content}\n\n/no_think`;
```
→ ❌ 작동 안함

### 원인
- qwen3-vl:8b는 **Thinking 버전** 모델
- API 파라미터나 프롬프트로는 thinking 비활성화 불가
- Instruct 버전(non-thinking)을 사용해야 함

---

## 이슈 3: 모델별 응답 형식 불일치

### 증상

**qwen3-vl:8b**
- `thinking` + `content` 분리 구조

**gemma3:4b**
- 마크다운 코드블록으로 JSON 감싸서 응답
```json
"```json\n{\"category\": \"...\"}\n```"
```
- category가 enum 대신 템플릿 문자열 그대로 반환:
```json
"category": "revenue_trend|balance_sheet|income_statement|..."
```

### 해결책: Ollama `format` 파라미터

Ollama의 **structured output** 기능 사용:
- llama.cpp grammar constraints 기반
- **토큰 생성 레벨**에서 JSON 형식 강제
- 모델 종류와 무관하게 일관된 출력

---

## 수정 파일

| 파일 | 변경 |
|------|------|
| `spa/src/lib/ai/types.ts` | `format?: 'json' \| object` 옵션 추가 |
| `spa/src/contexts/OllamaContext.tsx` | API 요청에 `format` 전달 |
| `spa/src/pages/Analysis.tsx` | JSON Schema 정의, 분석 옵션에 적용 |

---

## 코드 변경

### types.ts

```typescript
export interface ChatOptions {
  num_ctx?: number;
  temperature?: number;
  num_predict?: number;
  format?: 'json' | object;  // 추가
}
```

### OllamaContext.tsx

```typescript
const res = await fetch(`${state.endpoint}/api/chat`, {
  body: JSON.stringify({
    model: state.selectedModel,
    messages,
    stream: false,
    format: options?.format,  // 추가
    options: ollamaOptions
  })
});
```

### Analysis.tsx

```typescript
const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      enum: ['revenue_trend', 'balance_sheet', 'income_statement',
             'employee_trend', 'review_positive', 'review_negative',
             'company_overview', 'unknown']
    },
    summary: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    extractedText: { type: 'string' }
  },
  required: ['category', 'summary', 'keyPoints', 'sentiment', 'extractedText']
};

const analysisOptions = {
  temperature: 0.3,
  num_predict: 1024,
  format: ANALYSIS_SCHEMA
};
```

---

## 결과

- **모든 Vision 모델**에서 일관된 JSON 응답
- `enum`으로 category/sentiment 값 제한
- 마크다운 코드블록, thinking 등 모델별 차이 무시됨

---

## 참조

- [Ollama Structured Outputs Blog](https://ollama.com/blog/structured-outputs)
- [Ollama Structured Outputs Docs](https://docs.ollama.com/capabilities/structured-outputs)
