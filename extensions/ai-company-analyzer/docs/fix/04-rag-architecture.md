# IndexedDB RAG 아키텍처 설계 문서

## 1. 개요

### 1.1 배경
현재 ai-company-analyzer는 이미지 캡처 시 간단한 카테고리 분류만 수행하고, 분석 요청 시마다 이미지를 다시 AI 모델에 전달하여 처리합니다. 이 방식은:
- 동일 이미지를 여러 번 재처리하여 비효율적
- 텍스트 기반 검색 불가능
- 구조화된 메타데이터 부재

### 1.2 목표
- 저장 시점에 AI로 상세 메타데이터(텍스트, 숫자, 트렌드 등) 추출
- 추출된 텍스트를 벡터 임베딩으로 변환하여 IndexedDB에 저장
- 분석 요청 시 벡터 유사도 검색으로 관련 컨텍스트 조회
- 이미지 재처리 없이 텍스트 기반 RAG(Retrieval-Augmented Generation) 구현

### 1.3 핵심 요구사항
1. **이미지 원본 + 텍스트 둘 다 저장**: 폴백 가능
2. **상세 메타데이터 추출**: 숫자, 트렌드, 핵심 인사이트까지
3. **벡터 유사도 검색**: IndexedDB를 RAG 저장소로 활용

---

## 2. 아키텍처

### 2.1 현재 흐름
```
[이미지 캡처]
     ↓
[IndexedDB에 Blob 저장]
     ↓
[분류 큐에서 카테고리 분류] (Qwen2-VL)
     ↓
[분석 요청 시 이미지 재로드]
     ↓
[Qwen2-VL로 이미지 분석] ← 매번 이미지 재처리
     ↓
[결과 반환]
```

### 2.2 변경 후 흐름
```
[이미지 캡처]
     ↓
[IndexedDB에 Blob 저장]
     ↓
[추출 큐 - 3단계 파이프라인]
     ├── 1. 카테고리 분류 (Qwen2-VL)
     ├── 2. 상세 텍스트 추출 (Qwen2-VL)
     └── 3. 임베딩 생성 (all-MiniLM-L6-v2)
     ↓
[extractedTexts 테이블에 텍스트/메타데이터 저장]
[vectorIndex 테이블에 임베딩 벡터 저장]
     ↓
[분석 요청 시]
     ├── 쿼리 임베딩 생성
     ├── 벡터 유사도 검색
     ├── 관련 텍스트 컨텍스트 조합
     └── LLM 프롬프트로 분석
```

### 2.3 핵심 설계 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 임베딩 모델 | all-MiniLM-L6-v2 (23MB) | 가벼움, @huggingface/transformers 기존 의존성 활용 |
| 벡터 검색 | 직접 코사인 유사도 구현 | 회사당 50개 미만 문서, MeMemo는 과설계 |
| 이미지 원본 | 유지 (binaryData) | 폴백 및 재추출 가능 |
| 상태 관리 | 5단계 ExtractionStatus | 세분화된 진행 상태 추적 |

---

## 3. 데이터 스키마

### 3.1 새로운 타입 정의

```typescript
// 추출 상태 (기존 ClassificationStatus 확장)
export type ExtractionStatus =
  | 'pending'           // 대기
  | 'classifying'       // 분류 중
  | 'extracting_text'   // 텍스트 추출 중
  | 'embedding'         // 임베딩 생성 중
  | 'completed'         // 완료
  | 'failed';           // 실패

// 추출된 텍스트 및 메타데이터 (신규 테이블)
export interface ExtractedText {
  id: string;              // FK → ExtractedData.id
  companyId: string;       // 검색 최적화용
  category: ImageSubCategory;

  // 원본 텍스트
  rawText: string;         // AI가 추출한 전체 텍스트

  // 구조화된 메타데이터
  metadata: {
    summary: string;           // 2-3문장 요약
    keyPoints: string[];       // 핵심 포인트

    // 재무 관련 (선택적)
    numbers?: {
      label: string;           // "매출", "영업이익" 등
      value: number;
      unit: string;            // "억원", "만원", "%" 등
      year?: number;
    }[];

    // 트렌드 정보 (선택적)
    trend?: {
      direction: 'up' | 'down' | 'stable';
      percentage?: number;
      period?: string;         // "YoY", "QoQ", "3년간" 등
    };

    // 리뷰 관련 (선택적)
    sentiment?: {
      score: number;           // -1 ~ 1
      positiveAspects: string[];
      negativeAspects: string[];
    };
  };

  createdAt: number;
}

// 벡터 인덱스 (신규 테이블)
export interface VectorIndex {
  id: string;              // FK → ExtractedData.id
  companyId: string;       // 회사별 검색용
  category: ImageSubCategory;

  // 청크 정보 (긴 텍스트는 여러 청크로 분할)
  chunkIndex: number;      // 0부터 시작
  chunkText: string;       // 원본 청크 텍스트 (검색 결과 표시용)

  // 임베딩 벡터 (384차원 - all-MiniLM-L6-v2)
  embedding: Float32Array;

  createdAt: number;
}
```

### 3.2 Dexie 스키마 (v3)

```typescript
this.version(3).stores({
  companies: 'id, name, createdAt, updatedAt',
  extractedData: 'id, companyId, type, subCategory, extractionStatus, extractedAt, [companyId+type], [companyId+subCategory], [companyId+extractionStatus]',
  binaryData: 'id',
  analysisResults: 'id, companyId, analyzedAt',

  // 신규 테이블
  extractedTexts: 'id, companyId, category, createdAt, [companyId+category]',
  vectorIndex: 'id, companyId, category, [companyId+category], [id+chunkIndex]',
}).upgrade(tx => {
  // 기존 classificationStatus → extractionStatus 마이그레이션
  return tx.table('extractedData').toCollection().modify(data => {
    if (data.classificationStatus) {
      data.extractionStatus = data.classificationStatus === 'completed'
        ? 'completed'  // 기존 완료 항목은 텍스트 추출 대기
        : data.classificationStatus;
    }
  });
});
```

---

## 4. 임베딩 엔진

### 4.1 모델 선택

| 기준 | all-MiniLM-L6-v2 | EmbeddingGemma |
|------|------------------|----------------|
| 모델 크기 | ~23MB | ~100MB+ |
| 차원 | 384 | 768 |
| 최대 토큰 | 128 (권장) | 256 |
| 로딩 시간 | 2-3초 | 5-10초 |
| 한국어 지원 | 제한적 | 양호 |

**선택: all-MiniLM-L6-v2**
- 이유: Qwen2-VL (~2GB)와 동시 로드 시 메모리 부담 최소화
- 한국어 제한은 영어 키워드 추출로 보완

### 4.2 구현 구조

```typescript
// background/embedding-engine.ts
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

export interface EmbeddingResult {
  embedding: Float32Array;
  chunkText: string;
}

// 텍스트 청킹 (200자 단위, 문장 경계 유지)
function chunkText(text: string, maxLength: number = 200): string[];

// 텍스트 임베딩 생성
export async function generateEmbeddings(text: string): Promise<EmbeddingResult[]>;

// 단일 쿼리 임베딩 생성
export async function generateQueryEmbedding(query: string): Promise<Float32Array>;
```

---

## 5. 텍스트 추출 프롬프트

### 5.1 카테고리별 추출 프롬프트

#### 재무 문서 (balance_sheet)
```
Extract ALL text and numbers from this balance sheet image.

Output JSON format:
{
  "rawText": "Complete Korean text transcription of everything visible",
  "summary": "2-3 sentence summary in Korean",
  "keyPoints": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"],
  "numbers": [
    {"label": "자산총계", "value": 1234, "unit": "억원", "year": 2024},
    {"label": "부채총계", "value": 567, "unit": "억원", "year": 2024}
  ],
  "trend": null
}

Extract EVERY visible number with its label. Be thorough.
```

#### 리뷰 문서 (review_positive)
```
Extract the review text and analyze sentiment.

Output JSON format:
{
  "rawText": "Full review text in Korean",
  "summary": "2-3 sentence summary",
  "keyPoints": ["좋은 점1", "좋은 점2"],
  "sentiment": {
    "score": 0.8,
    "positiveAspects": ["워라밸", "급여"],
    "negativeAspects": []
  }
}
```

### 5.2 사이트 힌트 활용

기존 분류 시스템의 사이트 힌트를 추출에도 적용하여 정확도 향상.

---

## 6. 통합 추출 큐

### 6.1 3단계 파이프라인

```typescript
// background/extraction-queue.ts
class ExtractionQueue {
  private queue: ExtractionTask[] = [];
  private isProcessing = false;

  async enqueue(extractedDataId: string, siteType: DataType): Promise<void>;

  private async processNext(): Promise<void> {
    const task = this.queue.shift()!;

    try {
      // 1단계: 분류
      if (task.currentPhase === 'classify') {
        await this.runClassification(task);
        task.currentPhase = 'extract';
      }

      // 2단계: 텍스트 추출
      if (task.currentPhase === 'extract') {
        await this.runTextExtraction(task);
        task.currentPhase = 'embed';
      }

      // 3단계: 임베딩 생성
      if (task.currentPhase === 'embed') {
        await this.runEmbedding(task);
      }

      // 완료
      await updateExtractionStatus(task.extractedDataId, 'completed');

    } catch (error) {
      // 재시도 로직 (최대 3회)
    }
  }
}
```

### 6.2 재시도 및 복구

- 각 단계별 실패 시 최대 3회 재시도
- Service Worker 재시작 시 pending 상태 작업 자동 복구
- 실패 시 현재 단계에서 재개 가능

---

## 7. 벡터 유사도 검색

### 7.1 코사인 유사도 구현

```typescript
// lib/vector-search.ts
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### 7.2 검색 API

```typescript
interface SearchResult {
  extractedDataId: string;
  chunkText: string;
  category: string;
  similarity: number;
}

// 회사별 벡터 검색
export async function searchByCompany(
  companyId: string,
  query: string,
  options?: {
    topK?: number;           // 기본 5
    categories?: string[];   // 특정 카테고리만
    minSimilarity?: number;  // 기본 0.3
  }
): Promise<SearchResult[]>;

// 전체 검색 (크로스 컴퍼니)
export async function searchAll(
  query: string,
  options?: { topK?: number; minSimilarity?: number }
): Promise<SearchResult[]>;
```

### 7.3 성능 예측

| 문서 수 | 검색 시간 |
|--------|----------|
| 50개 | <1ms |
| 500개 | ~5ms |
| 5,000개 | ~50ms |

회사당 평균 20-50개 문서로 O(n) 직접 검색이 충분히 효율적.

---

## 8. RAG 분석 프롬프트

### 8.1 컨텍스트 수집

```typescript
// lib/prompts/rag-analysis.ts
interface RAGContext {
  financialContext: string;
  reviewContext: string;
  relevantNumbers: Array<{label: string; value: number; unit: string}>;
}

export async function gatherAnalysisContext(companyId: string): Promise<RAGContext> {
  // 재무 관련 검색
  const financialResults = await searchByCompany(companyId,
    '매출 영업이익 재무상태 현금흐름', {
    topK: 5,
    categories: ['balance_sheet', 'income_statement', 'cash_flow', 'revenue_trend'],
  });

  // 리뷰 관련 검색
  const reviewResults = await searchByCompany(companyId,
    '워라밸 급여 문화 성장 장점 단점', {
    topK: 5,
    categories: ['review_positive', 'review_negative', 'review_mixed'],
  });

  // 컨텍스트 텍스트 구성
  // ...
}
```

### 8.2 분석 프롬프트 구성

```typescript
export function buildRAGAnalysisPrompt(context: RAGContext): string {
  return `Based on the following extracted information, provide a comprehensive company analysis.

## Financial Information
${context.financialContext || '(No financial data available)'}

## Key Financial Numbers
${context.relevantNumbers.map(n => `- ${n.label}: ${n.value}${n.unit}`).join('\n')}

## Employee Reviews
${context.reviewContext || '(No review data available)'}

---

Provide your analysis in JSON format:
{
  "overallScore": 1-5,
  "financialHealth": {
    "score": 1-5,
    "summary": "재무 건전성 요약 (한국어)",
    "strengths": ["강점1"],
    "concerns": ["우려점1"]
  },
  "employeeSentiment": {
    "score": 1-5,
    "summary": "직원 평가 요약 (한국어)",
    "positives": ["장점1"],
    "negatives": ["단점1"]
  },
  "recommendation": "투자/취업 추천 여부와 이유 (한국어)"
}`;
}
```

---

## 9. 메모리 관리 전략

### 9.1 문제
Qwen2-VL (~2GB) + all-MiniLM-L6-v2 (~100MB) 동시 로드 시 메모리 부담

### 9.2 해결 방안

**옵션 A: 동시 로드 (권장)**
- 총 ~2.1GB로 대부분 환경에서 허용 가능
- 추출 파이프라인 속도 최적화

**옵션 B: 순차 로드/언로드**
```typescript
async function runFullPipeline(task: ExtractionTask) {
  // Vision 모델로 분류 + 텍스트 추출
  await initEngine();
  await runClassification(task);
  await runTextExtraction(task);
  await disposeEngine(); // Vision 모델 해제

  // 임베딩 모델로 벡터 생성
  await initEmbeddingEngine();
  await runEmbedding(task);
}
```

---

## 10. 마이그레이션 전략

### 10.1 점진적 마이그레이션

1. **Phase 1**: v3 스키마 업그레이드 (기존 데이터 유지)
2. **Phase 2**: 신규 저장 시 전체 파이프라인 적용
3. **Phase 3**: 백그라운드에서 기존 데이터 마이그레이션
4. **Phase 4**: 분석 로직을 RAG 기반으로 전환

### 10.2 기존 데이터 처리

```typescript
export async function migrateExistingData(): Promise<void> {
  const pendingData = await db.extractedData
    .where('extractionStatus')
    .equals('completed')
    .filter(d => !d.textExtractedAt)
    .toArray();

  for (const data of pendingData) {
    await db.extractedData.update(data.id, {
      extractionStatus: 'extracting_text',
    });
    extractionQueue.enqueue(data.id, data.type);
  }
}
```

---

## 11. 예상 성능 변화

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| 저장 시간 | 3-5초 | 8-16초 (추출+임베딩) |
| 분석 시간 | 5-10초 (이미지 재처리) | 1-2초 (텍스트 기반) |
| 메모리 | ~2GB | ~2.1GB |
| 검색 기능 | 없음 | 벡터 유사도 검색 |
| 크로스 컴퍼니 검색 | 불가 | 가능 |

---

## 12. 참고 자료

### 12.1 브라우저 기반 RAG
- [MeMemo - Browser Vector Search](https://github.com/poloclub/mememo)
- [Browser-Based RAG with IndexedDB](https://medium.com/@tomkob99_89317/proposing-browser-based-rag-for-session-level-knowledge-a-case-for-indexeddb-vector-storage-45f2c2135365)
- [Building RAG System with WebGPU](https://medium.com/@stramanu/what-i-learned-building-a-browser-based-rag-system-with-webgpu-8f03393f3d18)

### 12.2 임베딩 모델
- [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
- [In-browser Semantic Search with EmbeddingGemma](https://glaforge.dev/posts/2025/09/08/in-browser-semantic-search-with-embeddinggemma/)

### 12.3 벡터 검색
- [SemanticFinder - Client-side Semantic Search](https://do-me.github.io/SemanticFinder/)
- [RxDB JavaScript Vector Database](https://rxdb.info/articles/javascript-vector-database.html)

---

## 13. 구현 파일 목록

| 파일 | 작업 |
|------|------|
| `src/types/storage.ts` | 수정 - ExtractionStatus, ExtractedText, VectorIndex 추가 |
| `src/lib/db.ts` | 수정 - v3 스키마, extractedTexts/vectorIndex 테이블 |
| `src/lib/storage.ts` | 수정 - 신규 CRUD 함수 |
| `src/lib/prompts/extraction.ts` | 신규 - 카테고리별 추출 프롬프트 |
| `src/lib/vector-search.ts` | 신규 - 코사인 유사도, 검색 API |
| `src/lib/prompts/rag-analysis.ts` | 신규 - RAG 컨텍스트 수집, 분석 프롬프트 |
| `src/background/embedding-engine.ts` | 신규 - all-MiniLM-L6-v2 임베딩 |
| `src/background/extraction-queue.ts` | 신규 - 3단계 추출 파이프라인 |
| `src/background/index.ts` | 수정 - 큐 교체, 신규 메시지 핸들러 |
