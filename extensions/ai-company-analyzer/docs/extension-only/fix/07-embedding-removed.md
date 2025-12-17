# 임베딩/RAG 제거 및 텍스트 컨텍스트 방식으로 전환

## 배경

Chrome Extension MV3의 Service Worker에서 `@huggingface/transformers`가 사용하는 `onnxruntime-web`의 동적 import가 금지되어 있어 임베딩 생성이 불가능했습니다. Offscreen Document를 통한 우회도 실패했습니다.

자세한 내용: [06-embedding-issue.md](./06-embedding-issue.md)

---

## 해결 방안

벡터 임베딩 기반 RAG를 제거하고, 추출된 텍스트의 **metadata (summary + keyPoints)**를 직접 LLM 컨텍스트로 사용하는 방식으로 전환했습니다.

### 변경 전/후 파이프라인

```
[변경 전]
이미지 → 분류 → 텍스트추출 → 임베딩❌ → vectorIndex → 벡터검색 → LLM

[변경 후]
이미지 → 분류 → 텍스트추출 → extractedTexts → metadata 수집 → LLM
```

---

## 변경 내역

### 삭제된 파일 (4개)

| 파일 | 용도 |
|------|------|
| `src/offscreen/offscreen.html` | 임베딩 전용 Offscreen Document |
| `src/offscreen/offscreen.ts` | 임베딩 엔진 실제 실행 코드 |
| `src/background/embedding-engine.ts` | 임베딩 프록시 |
| `src/lib/vector-search.ts` | 벡터 검색 (코사인 유사도) |

### 수정된 파일 (10개)

| 파일 | 주요 변경 |
|------|----------|
| `package.json` | `onnxruntime-web` 의존성 제거 |
| `manifest.json` | `offscreen` 권한 제거 |
| `vite.config.ts` | ONNX WASM 파일 복사 로직 제거, offscreen 엔트리 제거 |
| `src/background/extraction-queue.ts` | 3단계(임베딩) 제거, 2단계 완료 후 바로 completed |
| `src/background/index.ts` | 임베딩/벡터 관련 메시지 핸들러 제거 |
| `src/lib/prompts/rag-analysis.ts` | 벡터 검색 → extractedTexts metadata 직접 조회 |
| `src/lib/storage.ts` | 벡터 인덱스 CRUD 함수 제거 |
| `src/lib/db.ts` | vectorIndex 테이블 삭제 (v4 마이그레이션) |
| `src/types/storage.ts` | `ExtractionStatus`에서 'embedding' 제거, `VectorIndex` 타입 제거 |
| `e2e/ai-rag-pipeline.spec.ts` | 임베딩 관련 테스트 제거 |

---

## 새로운 컨텍스트 수집 방식

```typescript
// rag-analysis.ts

// 카테고리별로 extractedTexts 조회
const allTexts = await getExtractedTextsByCompany(companyId);
const financialTexts = filterByCategories(allTexts, FINANCIAL_CATEGORIES);

// metadata (summary + keyPoints) 기반 컨텍스트 생성
const financialContext = financialTexts
  .map(t => {
    const parts = [`[${formatCategory(t.category)}]`];
    if (t.metadata?.summary) parts.push(t.metadata.summary);
    if (t.metadata?.keyPoints?.length > 0) {
      parts.push('핵심 포인트:');
      t.metadata.keyPoints.forEach(p => parts.push(`- ${p}`));
    }
    return parts.join('\n');
  })
  .join('\n\n');
```

---

## DB 스키마 변경

### v4 마이그레이션

```typescript
// db.ts
this.version(4).stores({
  // ... 기존 테이블들
  vectorIndex: null, // 테이블 삭제
});
```

### 삭제된 테이블

- `vectorIndex` - 벡터 임베딩 저장 테이블

### 유지된 테이블

- `extractedTexts` - 추출된 텍스트 및 metadata 저장 (계속 사용)

---

## ExtractionStatus 변경

```typescript
// 변경 전
type ExtractionStatus =
  | 'pending' | 'classifying' | 'extracting_text'
  | 'embedding' | 'completed' | 'failed';

// 변경 후
type ExtractionStatus =
  | 'pending' | 'classifying' | 'extracting_text'
  | 'completed' | 'failed';
```

---

## 제거된 메시지 핸들러

- `INIT_EMBEDDING_ENGINE`
- `GET_EMBEDDING_ENGINE_STATUS`
- `RAG_SEARCH` (벡터 검색)
- `GET_VECTOR_STATS`
- `GET_VECTOR_INDEX`

---

## 장점

1. **복잡성 감소**: ONNX Runtime, Offscreen Document, 벡터 검색 제거
2. **안정성 향상**: Service Worker 재시작 문제 해결
3. **빌드 크기 감소**: onnxruntime-web 의존성 제거

## 단점

1. **검색 기능 제한**: 벡터 유사도 기반 검색 불가
2. **컨텍스트 품질**: 전체 텍스트 대신 요약만 사용하므로 세부 정보 손실 가능

---

## 향후 개선 가능성

1. **외부 임베딩 API**: OpenAI, Cohere 등의 API 사용 (비용 발생)
2. **transformers.js 업데이트**: ONNX Runtime의 Service Worker 지원이 개선되면 재도입 가능
3. **전체 텍스트 사용**: 토큰 한도 내에서 rawText도 컨텍스트에 포함
