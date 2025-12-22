# 07. 종합 분석 결과 표시 버그 수정

## 문제

AI 분석을 완료하고 종합 분석까지 마쳤지만:

1. **홈 회사 카드**: "완료"만 표시되고 평점이 안 나옴
2. **기업 상세 상위 박스(CompanyMeta)**: "완료"만 표시되고 평점이 안 나옴
3. **분석 결과 탭**: 개별 분석만 표시되고 종합 분석이 안 나옴

## 원인

### 1. GET_COMPANY 핸들러 버그 (치명적)

`toCompanyDetailDTO()`에서 `company.analysis`를 반환하지 않았음:

```typescript
// extension/src/background/handlers/company-handlers.ts (수정 전)
async function toCompanyDetailDTO(company: any) {
  const dto = await toCompanyDTO(company);
  return {
    ...dto,
    metadata: company.metadata,
    // analysis 누락!
  };
}
```

### 2. GET_COMPANIES 핸들러 미비

`toCompanyDTO()`에서 홈 카드용 분석 정보를 반환하지 않았음:

```typescript
// 수정 전: analysisScore, analysisRecommendation 없음
return {
  id: company.id,
  name: company.name,
  // ... 기타 필드
  analyzedCount,  // 이것만 있었음
};
```

### 3. 분석 결과 탭에 종합 분석 미표시

`AnalysisReport` 컴포넌트가 개별 분석만 표시했음.

## 해결

### 1. Extension - company-handlers.ts

```typescript
// toCompanyDTO에 분석 정보 추가
return {
  // ... 기존 필드
  analysisScore: company.analysis?.score,
  analysisRecommendation: company.analysis?.recommendation,
};

// toCompanyDetailDTO에 analysis 추가
async function toCompanyDetailDTO(company: any) {
  const dto = await toCompanyDTO(company);
  return {
    ...dto,
    metadata: company.metadata,
    analysis: company.analysis,  // 추가
  };
}
```

### 2. Shared Types - models.ts

```typescript
export interface CompanyDTO {
  // ... 기존 필드
  analysisScore?: number;
  analysisRecommendation?: 'recommend' | 'neutral' | 'not_recommend';
}
```

### 3. SPA - CompanyCard.tsx

```typescript
<span className="ml-2 font-semibold">
  {company.analysisScore != null ? (
    <>
      <span className="text-ink">{company.analysisScore}점</span>
      {company.analysisRecommendation && (
        <span className={`ml-1 ${
          company.analysisRecommendation === 'recommend' ? 'text-signal-positive' :
          company.analysisRecommendation === 'not_recommend' ? 'text-signal-negative' :
          'text-ink-muted'
        }`}>
          {company.analysisRecommendation === 'recommend' ? '추천' :
           company.analysisRecommendation === 'not_recommend' ? '비추천' : '중립'}
        </span>
      )}
    </>
  ) : company.analyzedCount > 0 ? '완료' : '미완료'}
</span>
```

### 4. SPA - CompanyMeta.tsx

동일한 패턴으로 평점 + 추천 상태 표시.

### 5. SPA - AnalysisReport.tsx

```typescript
interface AnalysisReportProps {
  companyId: string;
  synthesis?: CompanyDetailDTO['analysis'];  // 추가
}

export default function AnalysisReport({ companyId, synthesis }: AnalysisReportProps) {
  return (
    <div className="space-y-8">
      {/* 종합 분석 추가 */}
      {synthesis && <SynthesisCard synthesis={synthesis} />}

      {/* 개별 분석 */}
      <div>
        <h3>상세 분석 ({analyzedImages.length}개)</h3>
        ...
      </div>
    </div>
  );
}
```

### 6. SPA - CompanyDetail.tsx

```typescript
{activeTab === 'analysis' && (
  <AnalysisReport companyId={companyId!} synthesis={company.analysis} />
)}
```

### 7. SPA - SynthesisCard.tsx (타입 호환성)

```typescript
type SynthesisData = SynthesisResult | NonNullable<CompanyDetailDTO['analysis']>;

interface SynthesisCardProps {
  synthesis: SynthesisData;
  showTitle?: boolean;
}
```

## 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `extension/src/background/handlers/company-handlers.ts` | analysis, analysisScore, analysisRecommendation 반환 |
| `shared/types/models.ts` | CompanyDTO 타입 확장 |
| `spa/src/components/company/CompanyCard.tsx` | 평점 + 추천 상태 표시 |
| `spa/src/components/company/CompanyMeta.tsx` | 평점 + 추천 상태 표시 |
| `spa/src/pages/CompanyDetail.tsx` | AnalysisReport에 synthesis 전달 |
| `spa/src/components/analysis/AnalysisReport.tsx` | 종합 분석 카드 추가 |
| `spa/src/components/analysis/SynthesisCard.tsx` | 타입 호환성 개선 |

## 결과

- 홈 카드: `85점 추천` 형식으로 표시
- 상위 박스: `85점 추천` 형식으로 표시
- 분석 결과 탭: 종합 분석 카드 + 개별 분석 목록
- 탭 밖 종합 분석: 기존과 동일하게 유지

## 교훈

1. **DTO 변환 함수 검증**: 새 필드 추가 시 모든 DTO 변환 함수 확인 필요
2. **타입 안전성**: TypeScript 타입만 추가하면 끝이 아니라, 실제 데이터 반환도 확인 필요
3. **E2E 테스트**: 데이터 저장 → 조회 → UI 표시까지의 전체 흐름 테스트 필요
