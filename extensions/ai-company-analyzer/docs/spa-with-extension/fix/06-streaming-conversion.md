# Fix 06: AI 분석 스트리밍 전환

## 개요

AI 분석 요청 시 간헐적으로 응답이 불완전하게 오는 문제를 스트리밍 방식으로 전환하여 해결합니다.

| # | 이슈 | 현재 상태 | 목표 |
|---|------|----------|------|
| 1 | content 빈 응답 | thinking은 오지만 content가 비는 현상 | 스트리밍으로 안정적 응답 확보 |
| 2 | thinking 미활용 | thinking 필드 무시 | thinking 실시간 UI 표시 |
| 3 | format 충돌 | format: JSON_SCHEMA와 추론 충돌 | 프롬프트로 JSON 유도 |

---

## 이슈 1: content가 간헐적으로 비는 현상

### 증상
- Ollama AI 분석 요청 시
- 응답의 `thinking` 필드는 내려오지만
- `content` 필드가 비어있는 경우 발생
- 간헐적으로 발생하여 디버깅 어려움

### 원인 분석

**참고 문서**: `docs/spa-with-extension/research/06-Ollama 모델 응답 안정성 확보 방안.md`

추론 모델(Qwen3-VL 등)은 `<think>` 토큰을 먼저 생성하도록 훈련됨. 그러나 `format: "json"`이 적용되면:

1. **확률 분포 충돌**: 모델은 `<think>` 토큰 생성 확률이 높지만, format 제약이 `{`만 허용
2. **문법 제약(Grammar Masking)**: Ollama가 JSON 문법에 맞는 토큰만 허용
3. **결과**: thinking 과정이 억제되거나, content가 비거나, 생성 중단

**현재 코드**: `spa/src/lib/analysis/image-analyzer.ts`

```typescript
const DEFAULT_ANALYSIS_OPTIONS: ChatOptions = {
  format: IMAGE_ANALYSIS_SCHEMA,  // ← 문제의 원인
  num_ctx: 8192,
  // ...
};
```

### 수정 방안

1. **`format` 제거**: JSON Schema 강제 대신 프롬프트로 JSON 형식 유도
2. **`think: true` 사용**: Ollama의 thinking 모드 활성화
3. **스트리밍 전환**: 비스트리밍 → 스트리밍으로 안정성 확보
4. **`num_ctx` 확장**: 8192 → 16384 (thinking + content 모두 수용)

---

## 이슈 2: thinking 과정 UI 미표시

### 증상
- AI가 분석 중일 때 사용자에게 피드백 없음
- "분석 중..." 메시지만 표시
- 실제 AI가 무엇을 생각하는지 알 수 없음

### 수정 방안

스트리밍으로 전환하면서 thinking 과정을 실시간으로 UI에 표시:

```
┌─────────────────────────────────────┐
│ 분석 진행                            │
├─────────────────────────────────────┤
│ ● Thinking...                        │
│ ┌─────────────────────────────────┐ │
│ │ 이 이미지는 회사의 매출 추이를    │ │
│ │ 보여주는 그래프입니다. 2023년     │ │
│ │ 매출이 전년 대비 15% 증가...     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 수정 파일 목록

### 1. 타입 정의 확장

**파일**: `spa/src/lib/ai/types.ts`

```typescript
// 스트리밍 청크 타입 (신규)
export interface StreamChunk {
  type: 'thinking' | 'content' | 'done';
  text: string;
  accumulated: {
    thinking: string;
    content: string;
  };
}

// 스트리밍 옵션 (신규)
export interface StreamOptions extends ChatOptions {
  think?: boolean;
  onThinking?: (text: string, accumulated: string) => void;
  onContent?: (text: string, accumulated: string) => void;
  abortSignal?: AbortSignal;
}

// 스트리밍 결과 (신규)
export interface StreamResult {
  thinking: string;
  content: string;
  success: boolean;
}
```

### 2. JSON 추출 유틸리티

**파일**: `spa/src/lib/ai/stream-parser.ts` (신규)

```typescript
/**
 * content에서 JSON 추출
 * format 파라미터 없이 프롬프트로 JSON 유도 시 사용
 */
export function extractJsonFromContent(content: string): object | null {
  // 1. JSON 코드 블록 추출 시도
  const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1]);
    } catch { /* 다음 방법 시도 */ }
  }

  // 2. 직접 JSON 파싱 시도
  try {
    return JSON.parse(content);
  } catch { /* 다음 방법 시도 */ }

  // 3. {} 또는 [] 패턴 찾기
  const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch { /* 실패 */ }
  }

  return null;
}
```

### 3. OllamaContext 스트리밍 함수 추가

**파일**: `spa/src/contexts/OllamaContext.tsx`

**변경 사항:**
- `chatStream()` 함수 추가
- `analyzeImageStream()` 수정: thinking/content 분리 파싱
- API 요청에 `think: true` 추가

### 4. 이미지 분석 스트리밍 함수

**파일**: `spa/src/lib/analysis/image-analyzer.ts`

**변경 사항:**
- `analyzeImageStream()` 함수 추가
- `format` 제거, 프롬프트에 JSON 형식 요청 포함
- `num_ctx: 16384`로 확장

### 5. useAnalysisSession 스트리밍 상태 추가

**파일**: `spa/src/hooks/useAnalysisSession.ts`

**변경 사항:**
- `streaming` 상태 추가
- 스트리밍 콜백 함수 추가

### 6. Orchestrator 스트리밍 연동

**파일**: `spa/src/lib/analysis/orchestrator.ts`

**변경 사항:**
- 스트리밍 의존성 추가
- 스트리밍 분석 옵션 추가

### 7. UI 스트리밍 표시

**파일**: `spa/src/components/analysis/AnalysisProgress.tsx`

**변경 사항:**
- `streaming` props 추가
- Thinking 표시 UI 추가

---

## 데이터 흐름 변경

### Before (비스트리밍)
```
startAnalysis()
  → orchestrator.run()
    → analyzeImages() [비스트리밍]
      → chat() [stream: false, format: JSON_SCHEMA]
      ← 전체 응답 대기 (간헐적 빈 content)
```

### After (스트리밍)
```
startAnalysis()
  → orchestrator.run()
    → analyzeImagesStreaming()
      → chatStream() [stream: true, think: true]
        ← yield thinking chunks → UI 업데이트
        ← yield content chunks → UI 업데이트
      ← StreamResult (thinking + content)
      → extractJsonFromContent(content) → 파싱
```

---

## 수정 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `spa/src/lib/ai/types.ts` | StreamChunk, StreamOptions, StreamResult 타입 추가 |
| `spa/src/lib/ai/stream-parser.ts` | JSON 추출 유틸리티 (신규) |
| `spa/src/contexts/OllamaContext.tsx` | chatStream() 함수 추가, think 파라미터 지원 |
| `spa/src/lib/analysis/image-analyzer.ts` | analyzeImageStream() 추가, num_ctx 확장 |
| `spa/src/lib/analysis/orchestrator.ts` | 스트리밍 분석 연동 |
| `spa/src/hooks/useAnalysisSession.ts` | streaming 상태 추가, 콜백 처리 |
| `spa/src/components/analysis/AnalysisProgress.tsx` | thinking UI 표시 |

---

## 주의사항

1. **JSON 파싱 실패 대비**: `extractJsonFromContent()`로 다양한 형식 지원
2. **num_ctx 확장**: 8192 → 16384 (VRAM 사용량 증가)
3. **AbortController 전파**: 스트림 중단 시 정상 처리
4. **기존 비스트리밍 유지**: 폴백용으로 기존 함수 유지

---

## 테스트 체크리스트

- [ ] thinking이 UI에 실시간 표시되는지 확인
- [ ] content가 thinking 이후에 표시되는지 확인
- [ ] JSON 파싱이 다양한 형식에서 동작하는지 확인
- [ ] 분석 중단 시 정상 처리되는지 확인
- [ ] 에러 발생 시 적절히 표시되는지 확인
- [ ] 여러 이미지 순차 분석 시 각각 스트리밍 표시
- [ ] 종합 분석도 스트리밍으로 동작하는지 확인
- [ ] content 빈 응답 문제가 해결되었는지 확인
