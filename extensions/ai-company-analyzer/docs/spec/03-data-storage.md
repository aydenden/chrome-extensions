# 데이터 저장 구조

## 저장소 구분

| 저장소 | 용도 | 데이터 |
|--------|------|--------|
| **Chrome Storage** | 메타데이터, 텍스트 | 회사 정보, 설정, 분석 결과 |
| **IndexedDB** | 대용량 바이너리 | 이미지 Blob, PDF Blob |

## Chrome Storage 스키마

```typescript
interface StorageSchema {
  companies: Company[];
  siteConfigs: SiteConfig[];
  aiSettings: AISettings;
}
```

## 회사 데이터

```typescript
interface Company {
  id: string;                    // UUID
  name: string;                  // 회사명
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601

  data: {
    wanted?: WantedData;
    innoforest?: InnoforestData;
    dart?: DartData;
    smes?: SmesData;
    blind?: BlindData;
    jobplanet?: JobplanetData;
  };

  analysis?: AnalysisResult;
}
```

## 소스별 데이터 타입

### 공통 필드

```typescript
interface BaseSourceData {
  collectedAt: string;           // 수집 일시
  sourceUrl: string;             // 원본 URL
  rawText?: string;              // 원본 텍스트
}
```

### 원티드 (WantedData)

```typescript
interface WantedData extends BaseSourceData {
  foundingYear?: number;         // 설립연도
  revenue?: string;              // 매출액
  avgSalary?: string;            // 평균연봉
  employeeCount?: number;        // 사원수
  revenueGraphId?: string;       // IndexedDB 이미지 ID
}
```

### 혁신의숲 (InnoforestData)

```typescript
interface InnoforestData extends BaseSourceData {
  currentEmployees?: number;     // 현재 인원
  turnoverRate?: number;         // 연간 퇴사율 (%)
  hiringGraphId?: string;        // IndexedDB 이미지 ID
  financials?: {
    year: number;
    revenue?: number;
    operatingProfit?: number;
    netProfit?: number;
  }[];
}
```

### DART (DartData)

```typescript
interface DartData extends BaseSourceData {
  pdfImageIds: string[];         // IndexedDB 이미지 ID 목록
  extractedText?: string;        // AI가 추출한 텍스트
}
```

### 중기벤처확인 (SmesData)

```typescript
interface SmesData extends BaseSourceData {
  balanceSheet?: {
    year: number;
    totalAssets?: number;
    totalLiabilities?: number;
    equity?: number;
  }[];
  incomeStatement?: {
    year: number;
    revenue?: number;
    operatingProfit?: number;
    netProfit?: number;
  }[];
}
```

### 블라인드 (BlindData)

```typescript
interface BlindData extends BaseSourceData {
  overallRating?: number;        // 총평 점수
  summary?: string;              // 총평 텍스트
  reviews: string[];             // 선택한 리뷰들
}
```

### 잡플래닛 (JobplanetData)

```typescript
interface JobplanetData extends BaseSourceData {
  rating?: number;               // 총 평점
  reviews: string[];             // 선택한 리뷰들
}
```

## AI 분석 결과

```typescript
interface AnalysisResult {
  analyzedAt: string;            // 분석 일시
  totalScore: number;            // 1-5점

  runway?: {
    months: number;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  };

  financialRisk?: {
    level: 'high' | 'medium' | 'low';
    factors: string[];
  };

  reviewSummary?: {
    positive: string[];
    negative: string[];
    summary: string;
  };
}
```

## IndexedDB 스키마

### Database: `ai-company-analyzer`

#### Object Store: `images`

```typescript
interface ImageRecord {
  id: string;                    // UUID
  companyId: string;             // 연결된 회사 ID
  type: 'graph' | 'pdf_page';    // 이미지 유형
  blob: Blob;                    // 이미지 데이터
  createdAt: string;             // 생성 일시
}
```

**인덱스:**
- `companyId`: 회사별 이미지 조회용

## 덮어쓰기 정책

- 같은 소스에서 재추출 시 **무조건 덮어쓰기**
- 기존 데이터는 새 데이터로 대체됨
- 히스토리 관리 없음

## 데이터 흐름

```
[추출] → [컨펌 팝업] → [저장]
                         ├→ 텍스트 데이터 → Chrome Storage
                         └→ 이미지/PDF → IndexedDB (ID 참조)
```

## 용량 고려사항

| 저장소 | 제한 |
|--------|------|
| Chrome Storage Sync | 100KB 총합 |
| Chrome Storage Local | 5MB 총합 |
| IndexedDB | 브라우저 할당량 (보통 수백 MB~GB) |

**권장사항:**
- 텍스트 데이터: Chrome Storage Local 사용
- 이미지/PDF: IndexedDB 사용
- 대량 회사 저장 시 용량 모니터링 필요
