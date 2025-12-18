# Analysis 페이지 흐름 변경

## 개요

OCR을 제거하고 Ollama Vision 모델로 이미지를 직접 분석합니다.
**하이브리드 접근법**을 사용하여 각 이미지를 독립 분석한 후, 최종 종합 분석을 수행합니다.

---

## 분석 전략: 하이브리드 접근법

### 배경 연구

| 연구 | 핵심 내용 |
|------|----------|
| [Multimodal Chain-of-Thought Reasoning](https://arxiv.org/abs/2302.00923) | 이전 분석 결과를 컨텍스트로 활용하면 추론 정확도 향상 |
| [Apple: Improve VLM CoT](https://machinelearning.apple.com/research/chain-of-thought) | Long CoT가 복잡한 multi-hop 질문에서 더 나은 결과 |
| [Ollama Multi-turn Vision](https://www.markhneedham.com/blog/2024/10/06/ollama-multi-prompts-vision-models/) | Ollama chat API로 누적 컨텍스트 대화 가능 |
| [Long Context RAG Performance](https://www.databricks.com/blog/long-context-rag-performance-llms) | 32k+ 토큰 이후 정확도 하락 가능성 |

### 방식 비교

| 방식 | 장점 | 단점 |
|------|------|------|
| **독립 분석** | 빠름, 메모리 효율적 | 이미지 간 연관성 파악 불가 |
| **누적 컨텍스트** | 맥락 유지, 연관성 파악 | Context Window 제약, 후반 희석 |
| **하이브리드 (채택)** | 상세 분석 + 종합 인사이트 | 약간의 추가 처리 시간 |

### 하이브리드 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase 1: 독립 분석                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  이미지 1 → [AI 분석] → 결과 1 (원티드 회사정보)             │
│  이미지 2 → [AI 분석] → 결과 2 (혁신의숲 입퇴사 그래프)      │
│  이미지 3 → [AI 분석] → 결과 3 (혁신의숲 재무정보)          │
│  이미지 4 → [AI 분석] → 결과 4 (잡플래닛 리뷰1)             │
│  이미지 5 → [AI 분석] → 결과 5 (잡플래닛 리뷰2)             │
│  이미지 6 → [AI 분석] → 결과 6 (잡플래닛 리뷰3)             │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    Phase 2: 종합 분석                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [결과 1~6 요약] + "이 회사에 대해 종합 분석해줘"            │
│         ↓                                                    │
│  최종 종합 인사이트                                          │
│  - 회사 전반 평가                                            │
│  - 재무 상태와 직원 만족도 상관관계                          │
│  - 투자/취업 추천 여부                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Context Window 설정

```typescript
// Ollama 기본 context: 2048 토큰 (부족함)
// 종합 분석을 위해 num_ctx 증가 필요

const response = await fetch(`${endpoint}/api/chat`, {
  body: JSON.stringify({
    model: 'gemma3',
    messages: [...],
    stream: false,
    options: {
      num_ctx: 8192  // 8k 토큰으로 증가
    }
  })
});
```

> **참고**: [Ollama Context Window](https://atlassc.net/2025/01/15/specifying-ollama-s-context-window-size) - 더 큰 컨텍스트는 더 많은 VRAM 필요

---

## 흐름 비교

### Before (OCR + AI)
```
이미지 로드
    ↓
OCR 처리 (Tesseract.js)
    ↓
    ├── 텍스트 추출
    ↓
AI 분류 (이미지 + OCR 텍스트)
    ↓
AI 분석 (OCR 텍스트)
    ↓
결과 저장
```

### After (Ollama Vision)
```
이미지 로드
    ↓
AI 분류 + 분석 (이미지 직접)
    ↓
결과 저장
```

---

## 주요 변경점

| 항목 | Before | After |
|------|--------|-------|
| OCR | Tesseract.js | 없음 |
| 텍스트 추출 | OCR로 추출 | AI가 이미지에서 직접 읽음 |
| 분류 | OCR 텍스트 기반 | 이미지 기반 |
| 분석 | OCR 텍스트 기반 | 이미지 기반 |
| 단계 수 | 4단계 | 2단계 |

---

## 프롬프트 변경

### 분류 프롬프트

```typescript
// Before (OCR 텍스트 사용)
const CLASSIFICATION_PROMPT = `
다음 텍스트를 분석하여 카테고리를 분류하세요:

{{OCR_TEXT}}

카테고리: WANTED, BLIND, JOBPLANET, SARAMIN, INNOFOREST, DART, UNKNOWN
`;

// After (이미지 직접 분석)
const CLASSIFICATION_PROMPT = `
이 스크린샷 이미지를 분석하여 어떤 사이트의 어떤 정보인지 분류해주세요.

가능한 사이트:
- WANTED: 원티드 채용 정보
- BLIND: 블라인드 기업 리뷰
- JOBPLANET: 잡플래닛 기업 정보
- SARAMIN: 사람인 채용 정보
- INNOFOREST: 혁신의숲 스타트업 정보
- DART: 전자공시시스템 재무 정보
- UNKNOWN: 알 수 없음

응답 형식 (JSON):
{
  "category": "WANTED",
  "subCategory": "JOB_POSTING",
  "confidence": 0.95,
  "reasoning": "원티드 채용공고 페이지로 보임"
}
`;
```

### 분석 프롬프트

```typescript
// Before (OCR 텍스트 사용)
const ANALYSIS_PROMPT = `
{{COMPANY_NAME}} 회사에 대한 다음 텍스트를 분석하세요:

{{TEXT}}

분석 결과를 JSON으로 출력하세요.
`;

// After (이미지 직접 분석)
const ANALYSIS_PROMPT = `
이 스크린샷은 {{COMPANY_NAME}} 회사의 정보입니다.
이미지에서 다음 정보를 추출하고 분석해주세요:

1. 핵심 내용 요약 (2-3문장)
2. 주요 키포인트 (3-5개)
3. 수치 데이터 (있는 경우)
4. 전반적인 감정/톤

응답 형식 (JSON):
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "metrics": { "key": "value" },
  "sentiment": "positive" | "neutral" | "negative",
  "keywords": ["...", "..."],
  "extractedText": "이미지에서 읽은 주요 텍스트"
}
`;
```

---

## Analysis.tsx 수정

### 제거할 코드

```typescript
// 삭제: OCR 관련 import
import { useOCR } from '@/contexts/OCRContext';
import { useOCRBatch } from '@/hooks/useOCRBatch';

// 삭제: OCR hooks
const { isReady: ocrReady } = useOCR();
const { processBatch: processOCRBatch } = useOCRBatch();

// 삭제: OCR 처리 단계
const ocrResults = await processOCRBatch(imageDataList);
```

### 변경할 코드

```typescript
// spa/src/pages/Analysis.tsx

// React
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';

// 내부 모듈
import { useOllama } from '@/contexts/OllamaContext';
import { useCompany, useImages } from '@/hooks';
import { getExtensionClient } from '@/lib/extension-client';
import { PageHeader } from '@/components/layout';
import { Card, Button, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';

// 타입
import type { AnalysisResultItem, StepProgress } from '@/types';

// Pages는 default export 사용
export default function Analysis() {
  const { companyId } = useParams<{ companyId: string }>();
  const client = getExtensionClient();

  // Hooks (React Query 기반)
  const { isConnected: ollamaConnected, selectedModel, analyzeImage } = useOllama();
  const { data: company } = useCompany(companyId);
  const { data: images } = useImages(companyId);

  // State
  const [stepProgress, setStepProgress] = useState<StepProgress>({
    step: 'init',
    current: 0,
    total: 0,
    message: '분석 대기 중...',
  });
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<AnalysisResultItem[]>([]);

  // 분석 시작
  const startAnalysis = async () => {
    if (!images || images.length === 0) {
      alert('분석할 이미지가 없습니다.');
      return;
    }

    if (!ollamaConnected || !selectedModel) {
      alert('Ollama가 연결되지 않았거나 모델이 선택되지 않았습니다.');
      return;
    }

    setIsRunning(true);
    setResults([]);

    try {
      // Step 1: 이미지 데이터 로드
      setStepProgress({
        step: 'loading-images',
        current: 0,
        total: images.length,
        message: '이미지 데이터 로드 중...'
      });

      const imageDataList: Array<{ id: string; base64: string }> = [];
      for (let i = 0; i < images.length; i++) {
        const imageData = await client.send('GET_IMAGE_DATA', { imageId: images[i].id });
        imageDataList.push({
          id: imageData.id,
          base64: imageData.base64  // data:image/... 접두사 없이
        });
        setStepProgress({
          step: 'loading-images',
          current: i + 1,
          total: images.length,
          message: `이미지 ${i + 1}/${images.length} 로드 중...`
        });
      }

      // Step 2: Ollama로 직접 분석
      setStepProgress({
        step: 'analyzing',
        current: 0,
        total: images.length,
        message: 'AI 분석 시작...'
      });

      const analysisResults: AnalysisResultItem[] = [];

      for (let i = 0; i < imageDataList.length; i++) {
        const { id, base64 } = imageDataList[i];

        // 분류
        const classificationResult = await analyzeImage(
          base64,
          CLASSIFICATION_PROMPT
        );
        const classification = parseJSON(classificationResult);

        // 분석
        const analysisPrompt = ANALYSIS_PROMPT
          .replace('{{COMPANY_NAME}}', company?.name || '');
        const analysisResult = await analyzeImage(base64, analysisPrompt);
        const analysis = parseJSON(analysisResult);

        analysisResults.push({
          imageId: id,
          category: classification?.subCategory || 'UNKNOWN',
          rawText: analysis?.extractedText || '',  // AI가 추출한 텍스트
          analysis: JSON.stringify(analysis, null, 2)
        });

        setStepProgress({
          step: 'analyzing',
          current: i + 1,
          total: images.length,
          message: `AI 분석 ${i + 1}/${images.length}`
        });
      }

      setResults(analysisResults);

      // Step 3: 결과 저장
      setStepProgress({
        step: 'saving',
        current: 0,
        total: 1,
        message: '분석 결과 저장 중...'
      });

      const saveResult = await client.send('BATCH_SAVE_ANALYSIS', {
        results: analysisResults
      });

      setStepProgress({
        step: 'done',
        current: analysisResults.length,
        total: analysisResults.length,
        message: `분석 완료! (${saveResult.savedCount}개 저장)`
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      setStepProgress({ step: 'error', current: 0, total: 0, message });
      console.error('분석 실패:', error);
    } finally {
      setIsRunning(false);
    }
  };

  // 분석 가능 여부
  const canAnalyze = ollamaConnected && selectedModel && images && images.length > 0;

  return (
    <>
      {/* AI 엔진 카드 → Ollama 상태 카드로 변경 */}
      <Card>
        <h2>Ollama</h2>
        <div>모델: {selectedModel || '미선택'}</div>
        <div>상태: {ollamaConnected ? '연결됨' : '연결 안됨'}</div>
        {!ollamaConnected && (
          <Link to="/settings">설정에서 Ollama 연결</Link>
        )}
      </Card>

      {/* 분석 버튼 */}
      <Button onClick={startAnalysis} disabled={!canAnalyze || isRunning}>
        분석 시작
      </Button>
    </>
  );
}
```

---

## 단계 표시 변경

### Before (3단계)
```
1. 이미지 로딩
2. OCR + AI 분석
3. 결과 저장
```

### After (2단계)
```
1. 이미지 로딩
2. AI 분석 (분류 + 분석)
3. 결과 저장
```

---

## 에러 처리

### Ollama 연결 안됨
```typescript
if (!ollamaConnected) {
  return (
    <div className="text-center py-8">
      <p>Ollama 서버에 연결되지 않았습니다</p>
      <Link to="/settings">설정으로 이동</Link>
    </div>
  );
}
```

### 모델 미선택
```typescript
if (!selectedModel) {
  return (
    <div className="text-center py-8">
      <p>분석에 사용할 모델을 선택해주세요</p>
      <Link to="/settings">설정으로 이동</Link>
    </div>
  );
}
```

### 분석 타임아웃
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  controller.abort();
  setStepProgress({
    step: 'error',
    current: i,
    total: images.length,
    message: '분석 시간 초과 (60초)'
  });
}, 60000);
```

---

## 저장 데이터 변경

### AnalysisResultItem
```typescript
interface AnalysisResultItem {
  imageId: string;
  category: ImageSubCategory;
  rawText: string;      // Before: OCR 텍스트, After: AI가 추출한 텍스트
  analysis: string;     // JSON 문자열
}
```

rawText 필드는 호환성을 위해 유지하되, AI가 이미지에서 직접 추출한 텍스트를 저장합니다.
