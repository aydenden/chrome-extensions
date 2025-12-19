# Fix 04: AI 분석 흐름 개선

## 개요

AI 분석 페이지에서 발견된 3가지 이슈를 수정하는 계획입니다.

| # | 이슈 | 현재 상태 | 목표 |
|---|------|----------|------|
| 1 | 분석 진행률 문제 | 첫 번째 이미지만 완료 표시 | 모든 이미지 개별 완료 표시 |
| 2 | 중단 시 저장 안됨 | 중단 시 데이터 손실 | 중단 시 완료된 결과 저장 |
| 3 | 종합 분석 미구현 | 독립 분석만 수행 | 독립 → 종합 분석 흐름 완성 |

---

## 이슈 1: 분석 진행률 - 첫 번째 이미지만 완료 표시

### 증상
- 3개의 이미지를 분석할 때
- 분석 진행률이 올라가지만
- 첫 번째 이미지만 100% 완료 표시됨
- 나머지 이미지는 완료 표시 안됨

### 원인 분석

**파일**: `spa/src/pages/Analysis.tsx` (179-217줄)

```typescript
for (let i = 0; i < imageDataList.length; i++) {
  if (abortControllerRef.current.signal.aborted) throw new Error('중단됨');

  const { id, base64 } = imageDataList[i];

  // 분석 로직 - 에러 발생 시 전체 루프 중단!
  const result = await analyzeImage(base64, prompt, analysisOptions);
  const analysis = parseJSON(result);

  // ... 결과 처리 ...

  analysisResults.push(resultItem);
  setCompletedImageIds(prev => new Set([...prev, id]));
}
```

**문제점**:
- for 루프 내부에 try-catch가 없음
- 두 번째 이미지에서 에러 발생 시 전체 루프가 중단됨
- catch 블록으로 이동하여 `step: 'error'`로 설정됨

### 수정 방안

개별 이미지에 try-catch 적용하여 에러 격리:

```typescript
for (let i = 0; i < imageDataList.length; i++) {
  if (abortControllerRef.current.signal.aborted) throw new Error('중단됨');

  const { id, base64 } = imageDataList[i];

  try {
    const result = await analyzeImage(base64, prompt, analysisOptions);
    const analysis = parseJSON(result);

    // ... 결과 처리 ...

    analysisResults.push(resultItem);
    setCompletedImageIds(prev => new Set([...prev, id]));

  } catch (imageError) {
    // 개별 이미지 에러 시 로그 남기고 계속 진행
    console.error(`이미지 ${id} 분석 실패:`, imageError);

    // 실패한 이미지도 결과에 추가 (에러 상태로)
    analysisResults.push({
      imageId: id,
      category: 'unknown' as ImageSubCategory,
      rawText: '',
      analysis: JSON.stringify({ error: imageError.message }),
    });

    // 실패 이미지 별도 추적
    setFailedImageIds(prev => new Set([...prev, id]));
  }

  // 진행률 업데이트는 try-catch 외부에서 항상 실행
  setStepProgress({
    step: 'analyzing',
    current: i + 1,
    total: images.length,
    message: `AI 분석 ${i + 1}/${images.length}`,
  });
}
```

### 추가 수정: UI에 성공/실패 구분 표시

```typescript
// 상태 추가
const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

// UI에서 구분 표시
{images.map((image) => {
  const isCompleted = completedImageIds.has(image.id);
  const isFailed = failedImageIds.has(image.id);
  return (
    <div className={`p-3 border-2 ${
      isFailed ? 'border-signal-negative bg-red-50' :
      isCompleted ? 'border-signal-positive bg-green-50' :
      'border-border-subtle'
    }`}>
      {isCompleted && !isFailed && <div>완료</div>}
      {isFailed && <div>실패</div>}
    </div>
  );
})}
```

---

## 이슈 2: 중단 시 완료된 분석 저장 안됨

### 증상
- 분석 중 "중단" 버튼 클릭
- 이미 완료된 이미지 분석 결과가 저장되지 않음
- 데이터 손실 발생

### 원인 분석

**파일**: `spa/src/pages/Analysis.tsx` (246-252줄)

```typescript
const stopAnalysis = () => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    setIsRunning(false);
    setStepProgress({ step: 'error', current: 0, total: 0, message: '사용자가 중단함' });
  }
};
```

**문제점**:
- 중단 시 저장 로직이 없음
- `analysisResults` 배열은 `startAnalysis` 함수 스코프 내부에 있어서 접근 불가
- 배치 저장은 모든 분석 완료 후에만 수행됨

### 수정 방안

**선택한 방식**: 중단 시에만 저장 (구현 간단)

1. `analysisResultsRef` 추가하여 함수 스코프 외부에서 접근 가능하게 함
2. 중단 신호 감지 시 현재까지 결과 저장 후 throw

```typescript
// ref 추가
const analysisResultsRef = useRef<AnalysisResultItem[]>([]);

// startAnalysis 함수 내
const startAnalysis = async () => {
  // 초기화
  analysisResultsRef.current = [];

  try {
    // ... 이미지 로딩 ...

    for (let i = 0; i < imageDataList.length; i++) {
      // 중단 체크 - 저장 후 throw
      if (abortControllerRef.current.signal.aborted) {
        if (analysisResultsRef.current.length > 0) {
          const saveResult = await client.send('BATCH_SAVE_ANALYSIS', {
            results: analysisResultsRef.current,
          });
          throw new Error(`중단됨 (${saveResult.savedCount}개 저장)`);
        }
        throw new Error('중단됨');
      }

      // ... 분석 로직 ...

      // 결과를 ref에도 저장
      analysisResultsRef.current.push(resultItem);
      analysisResults.push(resultItem);
    }
  } catch (error) {
    // 에러 메시지에 저장 개수 포함
    setStepProgress({
      step: 'error',
      current: 0,
      total: 0,
      message: error.message
    });
  }
};
```

---

## 이슈 3: 종합 분석 미구현

### 증상
- 문서 `05-analysis-flow.md`에서 정의한 흐름:
  - Phase 1: 독립 분석 (각 이미지 개별 분석)
  - Phase 2: 종합 분석 (전체 결과 종합)
- 현재 Phase 1만 구현되어 있음
- 독립 분석 완료 후 종합 분석 없이 종료

### 목표 흐름

```
Phase 1: 이미지 로딩 → AI 분석 (기존)
    ↓
Phase 2: 종합 분석 생성 → 결과 저장 (신규)
    ↓
완료: 분석 페이지 + 회사 상세에 결과 표시
```

### 수정 파일 목록

#### 3-1. 타입 정의 확장

**파일**: `shared/types/models.ts`

```typescript
// CompanyDetailDTO.analysis 필드 확장
export interface CompanyDetailDTO extends CompanyDTO {
  // ... 기존 필드 ...
  analysis?: {
    score?: number;
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    recommendation?: 'recommend' | 'neutral' | 'not_recommend';
    reasoning?: string;
    analyzedAt?: string;
  };
}
```

**파일**: `shared/types/messages.ts`

```typescript
// 새 메시지 타입 추가
export type MessageType =
  | 'GET_COMPANIES'
  // ... 기존 타입 ...
  | 'UPDATE_COMPANY_ANALYSIS';

export interface MessagePayload {
  // ... 기존 payload ...
  UPDATE_COMPANY_ANALYSIS: {
    companyId: string;
    analysis: {
      score: number;
      summary: string;
      strengths: string[];
      weaknesses: string[];
      recommendation: 'recommend' | 'neutral' | 'not_recommend';
      reasoning: string;
    };
  };
}

export interface MessageResponse {
  // ... 기존 response ...
  UPDATE_COMPANY_ANALYSIS: { updatedAt: string };
}
```

#### 3-2. 종합 분석 함수 생성

**파일**: `spa/src/lib/analysis/synthesis.ts` (신규)

```typescript
export interface SynthesisResult {
  score: number;                    // 0-100
  summary: string;                  // 종합 요약
  strengths: string[];              // 강점 목록
  weaknesses: string[];             // 약점 목록
  recommendation: 'recommend' | 'neutral' | 'not_recommend';
  reasoning: string;                // 추천 이유
}

const SYNTHESIS_PROMPT = `
다음은 {{COMPANY_NAME}} 회사에 대한 개별 분석 결과입니다:

{{ANALYSES}}

위 분석 결과를 종합하여 다음 형식으로 응답하세요:
- score: 0-100 점수 (종합 평가)
- summary: 회사 종합 요약 (2-3문장)
- strengths: 주요 강점 (최대 3개)
- weaknesses: 주요 약점 (최대 3개)
- recommendation: 'recommend' | 'neutral' | 'not_recommend'
- reasoning: 추천 이유 (1-2문장)
`;

export async function generateSynthesis(
  companyName: string,
  analysisResults: AnalysisResultItem[],
  chat: ChatFunction
): Promise<SynthesisResult | null> {
  if (analysisResults.length === 0) return null;

  // 분석 결과 요약 텍스트 생성
  const analysesText = analysisResults.map((r, i) => {
    try {
      const data = JSON.parse(r.analysis);
      return `[${i + 1}] ${r.category}: ${data.summary || '요약 없음'}`;
    } catch {
      return `[${i + 1}] ${r.category}: 분석 데이터 파싱 실패`;
    }
  }).join('\n\n');

  const prompt = SYNTHESIS_PROMPT
    .replace('{{COMPANY_NAME}}', companyName)
    .replace('{{ANALYSES}}', analysesText);

  // 종합 분석에는 더 큰 context window 필요
  const options = {
    num_ctx: 8192,
    temperature: 0.3,
    num_predict: 2048
  };

  try {
    const response = await chat([{ role: 'user', content: prompt }], options);
    return JSON.parse(response) as SynthesisResult;
  } catch (error) {
    console.error('종합 분석 생성 실패:', error);
    return null;
  }
}
```

#### 3-3. Extension 핸들러 추가

**파일**: `extension/src/background/handlers/analysis-handlers.ts`

```typescript
registerHandler('UPDATE_COMPANY_ANALYSIS', async (payload) => {
  const { companyId, analysis } = payload;

  const company = await getCompany(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  await updateCompany(companyId, {
    analysis: {
      ...analysis,
      analyzedAt: new Date().toISOString()
    }
  });

  return {
    updatedAt: new Date().toISOString(),
  };
});
```

#### 3-4. Analysis 페이지 수정

**파일**: `spa/src/pages/Analysis.tsx`

```typescript
// 타입 확장
type AnalysisStep = 'init' | 'loading-images' | 'analyzing' | 'synthesizing' | 'saving' | 'done' | 'error';

// startAnalysis 함수에 Phase 2 추가
const startAnalysis = async () => {
  // ... Phase 1: 이미지 로딩 + 독립 분석 (기존) ...

  // Phase 2: 종합 분석 (신규)
  if (analysisResults.length > 0 && !abortControllerRef.current?.signal.aborted) {
    setStepProgress({
      step: 'synthesizing',
      current: 0,
      total: 1,
      message: '종합 분석 생성 중...'
    });

    const synthesisResult = await generateSynthesis(
      company?.name || '',
      analysisResults,
      chat
    );

    if (synthesisResult) {
      setSynthesis(synthesisResult);

      // 종합 분석 결과 저장
      await client.send('UPDATE_COMPANY_ANALYSIS', {
        companyId: companyId!,
        analysis: synthesisResult
      });
    }
  }

  // ... 완료 처리 ...
};

// UI에 종합 분석 단계 표시
<StepIndicator
  label="3. 종합 분석"
  isActive={stepProgress.step === 'synthesizing'}
  isDone={['saving', 'done'].includes(stepProgress.step)}
/>
<StepIndicator
  label="4. 결과 저장"
  isActive={stepProgress.step === 'saving'}
  isDone={stepProgress.step === 'done'}
/>
```

#### 3-5. 회사 상세 페이지 수정

**파일**: `spa/src/pages/CompanyDetail.tsx`

```typescript
// 종합 분석 결과 표시 섹션 추가
{company.analysis && (
  <Card className="p-6">
    <h2 className="headline text-xl mb-4">AI 종합 분석</h2>

    {/* 점수 */}
    <div className="flex items-center gap-4 mb-4">
      <div className="text-4xl font-bold">{company.analysis.score}</div>
      <div className="text-sm text-ink-muted">/ 100</div>
    </div>

    {/* 요약 */}
    <p className="text-ink mb-4">{company.analysis.summary}</p>

    {/* 강점/약점 */}
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <h3 className="text-sm font-semibold text-signal-positive mb-2">강점</h3>
        <ul className="text-sm space-y-1">
          {company.analysis.strengths?.map((s, i) => (
            <li key={i}>• {s}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-signal-negative mb-2">약점</h3>
        <ul className="text-sm space-y-1">
          {company.analysis.weaknesses?.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      </div>
    </div>

    {/* 추천 */}
    <div className="p-3 bg-surface-sunken">
      <span className={`font-semibold ${
        company.analysis.recommendation === 'recommend' ? 'text-signal-positive' :
        company.analysis.recommendation === 'not_recommend' ? 'text-signal-negative' :
        'text-ink-muted'
      }`}>
        {company.analysis.recommendation === 'recommend' ? '추천' :
         company.analysis.recommendation === 'not_recommend' ? '비추천' : '중립'}
      </span>
      <span className="text-sm text-ink-muted ml-2">{company.analysis.reasoning}</span>
    </div>

    {/* 분석 일시 */}
    <div className="text-xs text-ink-muted mt-4">
      분석 일시: {new Date(company.analysis.analyzedAt).toLocaleString()}
    </div>
  </Card>
)}
```

---

## 수정 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `shared/types/models.ts` | `CompanyDetailDTO.analysis` 필드 확장 |
| `shared/types/messages.ts` | `UPDATE_COMPANY_ANALYSIS` 메시지 타입 추가 |
| `extension/src/background/handlers/analysis-handlers.ts` | 종합 분석 저장 핸들러 추가 |
| `spa/src/lib/analysis/synthesis.ts` | 종합 분석 함수 (신규) |
| `spa/src/pages/Analysis.tsx` | 3가지 이슈 모두 수정 |
| `spa/src/pages/CompanyDetail.tsx` | 종합 분석 결과 표시 |

---

## 테스트 체크리스트

- [ ] 이슈 1: 3개 이미지 분석 시 각각 완료 표시 확인
- [ ] 이슈 1: 일부 이미지 분석 실패해도 나머지 계속 진행
- [ ] 이슈 2: 분석 중단 시 "N개 저장됨" 메시지 확인
- [ ] 이슈 2: IndexedDB에서 저장된 데이터 확인
- [ ] 이슈 3: 종합 분석 단계 UI 표시
- [ ] 이슈 3: 분석 페이지 하단에 종합 결과 표시
- [ ] 이슈 3: 회사 상세 페이지에 종합 결과 표시
