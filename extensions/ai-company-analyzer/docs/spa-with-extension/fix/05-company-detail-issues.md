# 05. 회사 상세 페이지 이슈

## 발견 일시
2025-12-19

## 대상 URL
`/ai-company-analyzer/company/{companyId}`

---

## 이슈 목록

### 1. 이미지 탭 - 이미지 카드 엑박

**증상**
- 이미지 카드에서 이미지가 엑박으로 표시됨
- data URL이 바인딩되고 있으나 실제로 노출 안됨

**원인**
`ImageCard.tsx:22`에서 base64 문자열만 전달하여 브라우저가 이미지로 인식하지 못함.

```tsx
// 현재 (잘못됨)
<img src={thumbnail.base64} ... />
```

**올바른 구현 (ImageViewer.tsx:165)**
```tsx
<img src={`data:${imageData.mimeType};base64,${imageData.base64}`} ... />
```

**해결**
data URL 형식(`data:{mimeType};base64,{base64}`)으로 변경

---

### 2. 분석 결과탭 - 종합 분석 전 점수 표시

**증상**
- 종합 분석 전일 경우 점수가 숫자(0.0)로 표시됨

**요구사항**
- 분석 전에는 점수를 `-`로 표시

**위치**
`CompanyDetail.tsx:104-109`

```tsx
// 현재
{company.analysis.score !== undefined && (
  <div className="text-4xl font-bold">{company.analysis.score}</div>
)}
```

**해결**
점수가 없으면 `-` 표시하도록 조건 수정

---

### 3. 상세 분석 카드 - 분류 코드값 노출

**증상**
- 상세 분석 카드에서 분류가 `revenue_trend` 등 코드값으로 표시됨

**원인**
`AnalysisReport.tsx:208`에서 `CATEGORY_LABELS` 매핑 없이 직접 표시

```tsx
// 현재 (잘못됨)
{analysis.category && <span className="label">{analysis.category}</span>}
```

**해결**
`CATEGORY_LABELS` 매핑 적용

```tsx
{analysis.category && (
  <span className="label">{CATEGORY_LABELS[analysis.category] || analysis.category}</span>
)}
```

---

### 4. 상세 분석 카드 - 분석 결과 요약 공란

**증상**
- 상세 분석 카드에서 분석 결과 요약이 공란으로 표시됨

**원인**
`AnalysisReport.tsx:57-71`에서 실제 분석 데이터를 조회하지 않고 하드코딩된 값 사용

```tsx
// 현재 (하드코딩)
analyses.push({
  imageId: img.id,
  data: {
    summary: '분석 결과 요약',  // 실제 데이터 아님
    keyPoints: [],
    keywords: [],
  },
  category: img.category,
});
```

**해결**
- `useImageData` 훅 또는 `GET_IMAGE_DATA` 메시지로 각 이미지의 `ImageDataDTO.analysis` 조회
- 분석 데이터(JSON 문자열)를 파싱하여 실제 요약 표시

---

## 수정 파일

| 파일 | 수정 내용 |
|------|----------|
| `spa/src/components/image/ImageCard.tsx` | data URL 형식 수정 |
| `spa/src/pages/CompanyDetail.tsx` | 분석 전 점수 `-` 표시 |
| `spa/src/components/analysis/AnalysisReport.tsx` | 분류 매핑 + 분석 데이터 조회 |

---

---

### 5. 상세 분석 카드 - 분석 데이터 조회 누락 (추가)

**증상**
- 상세 분석 카드에서 분류는 정상 표시되지만 요약/키포인트가 "분석 데이터 없음"으로 표시

**원인**
`GET_IMAGE_DATA` 핸들러는 `includeAnalysis: true`일 때만 analysis 필드 반환하지만,
`useImageData` 훅에서 이 옵션을 전달하지 않아 기본값 `false`로 동작

```typescript
// GET_IMAGE_DATA 핸들러 (image-handlers.ts:121-147)
if (includeAnalysis && image.analysis) {
  result.analysis = image.analysis;  // includeAnalysis가 true여야 반환
}

// useImageData 훅 - includeAnalysis 미전달
queryFn: () => client.send('GET_IMAGE_DATA', { imageId: imageId! }),
```

**해결**
1. `useImages.ts` - useImageData에 options 파라미터 추가
2. `AnalysisReport.tsx` - useImageData 호출 시 `{ includeAnalysis: true }` 전달

---

## 관련 타입

### ImageDataDTO (models.ts:49-54)
```typescript
interface ImageDataDTO {
  id: string;
  base64: string;
  mimeType: string;
  rawText?: string;
  analysis?: string;  // JSON 문자열로 저장된 분석 결과
}
```

### CATEGORY_LABELS (categories.ts)
```typescript
const CATEGORY_LABELS: Record<ImageSubCategory, string> = {
  revenue_trend: '매출 추이',
  balance_sheet: '재무상태표',
  income_statement: '손익계산서',
  employee_trend: '직원 추이',
  review_positive: '긍정 리뷰',
  review_negative: '부정 리뷰',
  company_overview: '회사 개요',
  unknown: '미분류',
};
```
