# 이미지 자동 분류 시스템 설계 문서

## 1. 개요

### 1.1 배경
현재 ai-company-analyzer는 이미지 캡처 시 이미지 종류(리뷰, 회사 정보, 재무 정보 등)를 구분하지 않고 모든 이미지에 동일한 프롬프트를 사용하고 있습니다.

### 1.2 목표
- 이미지 캡처 저장 시점에 AI가 자동으로 이미지 종류를 분류
- 분류 결과에 따라 최적화된 프롬프트로 분석
- 사용자 경험 저하 없이 백그라운드에서 분류 수행

### 1.3 핵심 요구사항
1. **캡처 저장 시 백그라운드 분류**: 사용자에게 지연 없이 저장 완료 후 비동기로 분류
2. **세분화된 카테고리 (18개)**: 재무/리뷰/그래프/회사정보 각각 세분화
3. **카테고리별 최적화 프롬프트**: 분류 결과에 따라 다른 분석 프롬프트 사용

---

## 2. 아키텍처

### 2.1 전체 흐름

```
[사용자 이미지 캡처]
       ↓
[confirm-popup에서 저장 클릭]
       ↓
[SAVE_DATA 메시지 → background/index.ts]
       ↓
[즉시 저장 완료 응답] ←────────── 사용자에게 즉시 피드백
       ↓
[백그라운드 분류 큐에 추가]
       ↓
[분류 프로세서가 비동기 처리]
       ├── 1. 이미지 분류 (classifyImage)
       ├── 2. DB 업데이트 (subCategory 필드)
       └── 3. 분류 완료 시 UI 반영
```

### 2.2 핵심 설계 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 분류 시점 | 저장 직후 비동기 | UX 저하 방지 |
| 분류 결과 저장 | ExtractedData에 subCategory 필드 추가 | 기존 구조 최소 변경 |
| 분류 실패 처리 | 기본값 'unknown' + 재시도 큐 + 수동 분류 UI | 안정성 확보 |
| 프롬프트 관리 | 별도 디렉토리 (lib/prompts/) | 유지보수성 |

---

## 3. 세분화된 카테고리 체계

### 3.1 카테고리 계층 구조

```typescript
// 기존 DataType (대분류) - 사이트 기반
type DataType =
  | 'company_info'      // 원티드
  | 'finance_inno'      // 혁신의숲
  | 'finance_dart'      // DART
  | 'finance_smes'      // 중기부
  | 'review_blind'      // 블라인드
  | 'review_jobplanet'; // 잡플래닛

// 새로운 ImageSubCategory (소분류) - AI 분류
type ImageSubCategory =
  // 재무 관련 (6개)
  | 'balance_sheet'        // 대차대조표
  | 'income_statement'     // 손익계산서
  | 'cash_flow'            // 현금흐름표
  | 'financial_ratio'      // 재무비율
  | 'revenue_trend'        // 매출추이
  | 'employee_trend'       // 고용추이

  // 리뷰 관련 (4개)
  | 'review_positive'      // 긍정 리뷰
  | 'review_negative'      // 부정 리뷰
  | 'review_mixed'         // 복합 리뷰
  | 'rating_summary'       // 평점 요약

  // 그래프/차트 (4개)
  | 'bar_chart'            // 막대그래프
  | 'line_chart'           // 라인차트
  | 'pie_chart'            // 원형차트
  | 'table_data'           // 표 데이터

  // 회사정보 (4개)
  | 'company_overview'     // 기업 개요
  | 'team_info'            // 팀 구성
  | 'benefits_info'        // 복지 정보
  | 'tech_stack'           // 기술스택

  // 기타 (2개)
  | 'unknown'              // 분류 불가
  | 'pending';             // 분류 대기중
```

### 3.2 카테고리별 설명

| 대분류 | 소분류 | 설명 | 관련 사이트 |
|--------|--------|------|-------------|
| 재무 | `balance_sheet` | 자산, 부채, 자본 현황 | DART, 중기부, 혁신의숲 |
| | `income_statement` | 매출, 비용, 이익 현황 | DART, 중기부, 혁신의숲 |
| | `cash_flow` | 현금흐름표 | DART |
| | `financial_ratio` | 재무비율, KPI | 혁신의숲 |
| | `revenue_trend` | 매출 추이 차트 | 혁신의숲 |
| | `employee_trend` | 고용 추이 차트 | 혁신의숲 |
| 리뷰 | `review_positive` | 긍정적 직원 리뷰 | 블라인드, 잡플래닛 |
| | `review_negative` | 부정적 직원 리뷰 | 블라인드, 잡플래닛 |
| | `review_mixed` | 복합적 리뷰 | 블라인드, 잡플래닛 |
| | `rating_summary` | 평점 요약 | 블라인드, 잡플래닛 |
| 차트 | `bar_chart` | 막대/컬럼 차트 | 전체 |
| | `line_chart` | 라인/영역 차트 | 전체 |
| | `pie_chart` | 원형/도넛 차트 | 전체 |
| | `table_data` | 데이터 테이블 | 전체 |
| 회사정보 | `company_overview` | 기업 개요 | 원티드 |
| | `team_info` | 팀 구성/조직도 | 원티드 |
| | `benefits_info` | 복지 정보 | 원티드 |
| | `tech_stack` | 기술 스택 | 원티드 |

---

## 4. 분류 프로세스

### 4.1 분류 프롬프트 설계

```typescript
// 영어 프롬프트 사용 (AI 정확도 향상)
export const CLASSIFICATION_PROMPT = `
Classify this image into ONE of the following categories.
Respond with ONLY the category ID, nothing else.

FINANCIAL DOCUMENTS:
- balance_sheet: Balance sheet showing assets, liabilities, equity
- income_statement: Income/profit & loss statement
- cash_flow: Cash flow statement
- financial_ratio: Financial ratios, KPIs
- revenue_trend: Revenue/sales trend chart
- employee_trend: Employee count trend

REVIEWS:
- review_positive: Positive employee review
- review_negative: Negative employee review
- review_mixed: Mixed positive/negative review
- rating_summary: Rating scores, star ratings

CHARTS:
- bar_chart: Bar/column chart
- line_chart: Line/area chart
- pie_chart: Pie/donut chart
- table_data: Data table

COMPANY INFO:
- company_overview: Company profile, basic info
- team_info: Team structure, organization
- benefits_info: Employee benefits, welfare
- tech_stack: Technology stack

OTHER:
- unknown: Cannot determine category

Category ID:`;
```

### 4.2 사이트 힌트 활용

사이트 정보를 프롬프트에 포함하여 분류 정확도 향상:

```typescript
const hints: Record<DataType, string> = {
  company_info: 'This image is from Wanted (job platform). Likely categories: company_overview, team_info, benefits_info, tech_stack',
  finance_inno: 'This image is from Innoforest (startup finance data). Likely categories: revenue_trend, employee_trend, financial_ratio',
  finance_dart: 'This image is from DART (financial disclosure). Likely categories: balance_sheet, income_statement, cash_flow',
  finance_smes: 'This image is from SMEs portal (financial data). Likely categories: balance_sheet, income_statement',
  review_blind: 'This image is from Blind (employee reviews). Likely categories: review_positive, review_negative, review_mixed, rating_summary',
  review_jobplanet: 'This image is from Jobplanet (employee reviews). Likely categories: review_positive, review_negative, review_mixed, rating_summary',
};
```

### 4.3 분류 큐 시스템

```typescript
class ClassificationQueue {
  private queue: ClassificationTask[] = [];
  private isProcessing = false;

  async enqueue(extractedDataId: string, siteType: DataType): Promise<void> {
    this.queue.push({ extractedDataId, siteType, retryCount: 0 });
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift()!;

    try {
      // 엔진 준비 확인
      if (!isEngineReady()) {
        await initEngine();
      }

      // 분류 수행
      const blob = await getImageBlob(task.extractedDataId);
      const category = await classifyImage(blob, task.siteType);

      // DB 업데이트
      await updateExtractedDataCategory(task.extractedDataId, category);
    } catch (error) {
      // 재시도 로직 (최대 3회)
      if (task.retryCount < 3) {
        task.retryCount++;
        setTimeout(() => {
          this.queue.push(task);
          this.processNext();
        }, 5000 * task.retryCount);
      } else {
        // 실패 시 unknown으로 마킹
        await markClassificationFailed(task.extractedDataId);
      }
    } finally {
      this.isProcessing = false;
      this.processNext();
    }
  }
}
```

---

## 5. 카테고리별 분석 프롬프트

### 5.1 재무 문서 프롬프트

#### 대차대조표 (balance_sheet)
```typescript
{
  systemPrompt: `Analyze this balance sheet and extract key financial metrics.
Focus on: Total Assets, Total Liabilities, Equity, Current Ratio, Debt Ratio.
Identify any warning signs or notable changes.`,
  outputFormat: `{
  "totalAssets": number or null,
  "totalLiabilities": number or null,
  "equity": number or null,
  "currentRatio": number or null,
  "debtRatio": number or null,
  "year": number or null,
  "warnings": string[],
  "summary": string
}`
}
```

#### 손익계산서 (income_statement)
```typescript
{
  systemPrompt: `Analyze this income statement and extract key metrics.
Focus on: Revenue, Operating Profit, Net Profit, Profit Margins.
Calculate growth rates if multiple periods shown.`,
  outputFormat: `{
  "revenue": number or null,
  "operatingProfit": number or null,
  "netProfit": number or null,
  "operatingMargin": number or null,
  "netMargin": number or null,
  "year": number or null,
  "growthRate": number or null,
  "summary": string
}`
}
```

### 5.2 리뷰 프롬프트

#### 긍정 리뷰 (review_positive)
```typescript
{
  systemPrompt: `Analyze this positive employee review.
Extract key positive points about the company.
Identify themes: culture, salary, growth, work-life balance.`,
  outputFormat: `{
  "positivePoints": string[],
  "themes": {
    "culture": string or null,
    "salary": string or null,
    "growth": string or null,
    "workLifeBalance": string or null
  },
  "overallSentiment": number (1-5),
  "summary": string
}`
}
```

#### 부정 리뷰 (review_negative)
```typescript
{
  systemPrompt: `Analyze this negative employee review.
Extract key concerns and pain points.
Identify red flags and warning signs.`,
  outputFormat: `{
  "negativePoints": string[],
  "redFlags": string[],
  "themes": {
    "culture": string or null,
    "management": string or null,
    "workload": string or null,
    "compensation": string or null
  },
  "overallSentiment": number (1-5),
  "summary": string
}`
}
```

---

## 6. 데이터베이스 변경

### 6.1 ExtractedData 확장

```typescript
export interface ExtractedData {
  id: string;
  companyId: string;
  type: DataType;           // 기존: 사이트 기반 대분류
  subCategory?: ImageSubCategory;  // 신규: AI 분류 소분류
  classificationStatus: ClassificationStatus;  // 신규
  source: string;
  extractedAt: number;
}

export type ClassificationStatus = 'pending' | 'completed' | 'failed';
```

### 6.2 Dexie 마이그레이션

```typescript
this.version(2).stores({
  companies: 'id, name, createdAt, updatedAt',
  extractedData: 'id, companyId, type, subCategory, classificationStatus, extractedAt, [companyId+type], [companyId+subCategory]',
  binaryData: 'id',
  analysisResults: 'id, companyId, analyzedAt',
}).upgrade(tx => {
  // 기존 데이터에 기본값 설정
  return tx.table('extractedData').toCollection().modify(data => {
    data.subCategory = data.subCategory || 'pending';
    data.classificationStatus = data.classificationStatus || 'pending';
  });
});
```

---

## 7. UI 컴포넌트

### 7.1 CategoryBadge 컴포넌트

```tsx
// 카테고리별 색상 테마
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  // 재무
  balance_sheet: { bg: '#e3f2fd', text: '#1565c0' },
  income_statement: { bg: '#e3f2fd', text: '#1565c0' },
  // 리뷰
  review_positive: { bg: '#e8f5e9', text: '#2e7d32' },
  review_negative: { bg: '#ffebee', text: '#c62828' },
  // 상태
  pending: { bg: '#f5f5f5', text: '#757575' },
  failed: { bg: '#fff3e0', text: '#e65100' },
};
```

### 7.2 ManualCategorySelect 컴포넌트

분류 실패 시 사용자가 직접 카테고리를 선택할 수 있는 드롭다운 UI 제공.

---

## 8. 예상 문제 및 해결책

| 문제 | 해결책 |
|------|--------|
| WebGPU 모델 로딩 시간 | onInstalled에서 사전 로딩 시도 |
| 분류 실패 | 최대 3회 재시도 + 사이트 기반 fallback + 수동 분류 UI |
| Service Worker 종료 | DB에서 pending 상태 복구 (onStartup) |
| 분류 정확도 | 사이트 힌트를 프롬프트에 포함 |

---

## 9. 참고 자료

### 9.1 AI 이미지 분류 베스트 프랙티스 (2025)
- [Prompt Engineering Guide 2025](https://www.lakera.ai/blog/prompt-engineering-guide)
- [AI Image Classification Best Practices](https://dev.to/james_katherine_dd5f976d6/key-use-cases-and-best-practices-of-ai-image-classification-for-2025-3i17)

### 9.2 Chrome Extension AI 아키텍처
- [Chrome Extension with Local & Cloud AI](https://dev.to/ialijr/how-i-built-a-chrome-extension-that-juggles-local-and-cloud-ai-100n)
- [Hybrid AI System Architecture](https://techwithibrahim.medium.com/engineering-a-hybrid-ai-system-with-chromes-built-in-ai-and-the-cloud-a68c6b24fe71)
- [Chrome Built-in AI](https://developer.chrome.com/docs/ai/built-in)

---

## 10. 구현 파일 목록

| 파일 | 작업 |
|------|------|
| `src/types/storage.ts` | 타입 확장 |
| `src/lib/db.ts` | 스키마 마이그레이션 |
| `src/lib/storage.ts` | CRUD 함수 추가 |
| `src/lib/prompts/classification.ts` | 신규 생성 |
| `src/lib/prompts/analysis.ts` | 신규 생성 |
| `src/lib/prompts/index.ts` | 신규 생성 |
| `src/background/classifier.ts` | 신규 생성 |
| `src/background/classification-queue.ts` | 신규 생성 |
| `src/background/index.ts` | 메시지 핸들러 수정 |
| `src/background/smolvlm-engine.ts` | export 추가 |
| `src/pages/detail/DetailPage.tsx` | UI 업데이트 |
| `src/components/CategoryBadge.tsx` | 신규 생성 |
| `src/components/ManualCategorySelect.tsx` | 신규 생성 |
