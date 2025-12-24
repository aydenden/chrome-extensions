# 이미지 카테고리 선택 UI

## 개요

### 문제 요약
현재 이미지 캡처 시 카테고리가 지정되지 않고, AI 분석 단계에서만 카테고리가 결정됩니다. 사용자가 캡처 시점에 카테고리를 직접 선택할 수 있으면 분류 정확도가 높아지고, AI 분석 전에도 이미지를 체계적으로 관리할 수 있습니다.

### 개선 목표
1. 캡처 확인 팝업에 카테고리 Select UI 추가
2. 사이트 타입별 기본 카테고리 자동 설정
3. AI 분석이 기존 카테고리를 덮어쓰지 않도록 옵션 제공

---

## AS-IS (현재 상태)

### 현재 흐름

```
[이미지 캡처]
    ↓
[확인 팝업: 회사 선택만]
    ↓
[저장: category = undefined]
    ↓
[AI 분석 후 카테고리 결정]
```

### 문제점

1. **캡처 시 카테고리 미지정**
   - 모든 이미지가 "미분류" 상태로 저장
   - AI 분석 전까지 카테고리 없음

2. **사이트 특성 미반영**
   - DART(금감원)는 주로 재무제표
   - JOBPLANET은 주로 리뷰
   - 하지만 기본값이 없음

3. **수동 수정 불가**
   - 캡처 후 카테고리 변경 UI 없음
   - AI 분석 결과만 반영됨

### 관련 코드

#### ImageSubCategory 정의
**파일**: `shared/constants/categories.ts:14-25`
```typescript
export const IMAGE_SUB_CATEGORIES = [
  'revenue_trend',      // 매출 추이
  'balance_sheet',      // 재무상태표
  'income_statement',   // 손익계산서
  'employee_trend',     // 직원 추이
  'review_positive',    // 긍정 리뷰
  'review_negative',    // 부정 리뷰
  'company_overview',   // 회사 개요
  'unknown',            // 미분류
] as const;

export type ImageSubCategory = (typeof IMAGE_SUB_CATEGORIES)[number];
```

#### 한글 라벨
**파일**: `shared/constants/categories.ts:28-37`
```typescript
export const CATEGORY_LABELS: Record<ImageSubCategory, string> = {
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

#### 이미지 저장 시 카테고리 미지정
**파일**: `extension/src/lib/storage.ts:70-89`
```typescript
export async function saveImage(data: {
  companyId: string;
  blob: Blob;
  mimeType: string;
  siteType: DataType;
  // category는 없음!
}): Promise<StoredImage> {
  const image: StoredImage = {
    id: crypto.randomUUID(),
    companyId: data.companyId,
    blob: data.blob,
    mimeType: data.mimeType,
    siteType: data.siteType,
    // category: undefined (저장 안 됨)
    createdAt: new Date(),
  };
  await db.images.add(image);
  return image;
}
```

#### 확인 팝업 - 카테고리 UI 없음
**파일**: `extension/src/content/confirm-popup.tsx:69-147`
```typescript
// 현재 확인 팝업에서 수집하는 정보:
// - 미리보기 이미지
// - 데이터 타입 (사이트) - 읽기 전용
// - 저장 대상 (새 회사 / 기존 회사)
// - 회사명 또는 기존 회사 선택
// 카테고리 선택 UI 없음!
```

#### DB 스키마
**파일**: `extension/src/lib/db.ts:40`
```typescript
interface StoredImage {
  // ...
  category?: ImageSubCategory;  // 옵셔널로 정의됨
  // ...
}
```

---

## TO-BE (개선 후)

### 개선된 흐름

```
[이미지 캡처]
    ↓
[확인 팝업]
  - 회사 선택
  - 카테고리 선택 (사이트별 기본값 자동 선택) ← 추가
    ↓
[저장: category = 사용자 선택값]
    ↓
[AI 분석 시]
  - 기존 카테고리 있으면 유지 (옵션)
  - 또는 AI 결과로 업데이트
```

### 구현 상세

#### 1. 사이트별 기본 카테고리 매핑
```typescript
// shared/constants/categories.ts

import { DataType } from '../types';

/**
 * 사이트 타입별 기본 카테고리
 * - 사이트 특성에 맞는 가장 일반적인 카테고리
 */
export const DEFAULT_CATEGORY_BY_SITE: Record<DataType, ImageSubCategory> = {
  DART: 'balance_sheet',        // 금감원 공시 → 재무제표
  WANTED: 'company_overview',   // 원티드 → 회사 개요
  JOBPLANET: 'review_positive', // 잡플래닛 → 리뷰 (긍정 기본)
  SARAMIN: 'company_overview',  // 사람인 → 회사 개요
  INNOFOREST: 'company_overview', // 이노포레스트 → 회사 개요
  BLIND: 'review_positive',     // 블라인드 → 리뷰
  SMES: 'company_overview',     // 중기부 → 회사 개요
  OTHER: 'unknown',             // 기타 → 미분류
};

/**
 * 사이트별 관련 카테고리 (Select에서 우선 표시)
 */
export const RELEVANT_CATEGORIES_BY_SITE: Record<DataType, ImageSubCategory[]> = {
  DART: ['balance_sheet', 'income_statement', 'revenue_trend', 'employee_trend'],
  WANTED: ['company_overview', 'employee_trend'],
  JOBPLANET: ['review_positive', 'review_negative', 'company_overview'],
  SARAMIN: ['company_overview', 'employee_trend'],
  INNOFOREST: ['company_overview', 'revenue_trend'],
  BLIND: ['review_positive', 'review_negative'],
  SMES: ['company_overview', 'revenue_trend'],
  OTHER: ['unknown', 'company_overview'],
};
```

#### 2. 확인 팝업에 카테고리 Select 추가
```typescript
// extension/src/content/confirm-popup.tsx

import {
  IMAGE_SUB_CATEGORIES,
  CATEGORY_LABELS,
  DEFAULT_CATEGORY_BY_SITE,
  RELEVANT_CATEGORIES_BY_SITE,
} from '../../../shared/constants/categories';

const ConfirmPopup: React.FC<ConfirmPopupProps> = ({
  imageDataUrl,
  detectedCompanyName,
  siteType,
  siteName,
  onSave,
  onCancel,
}) => {
  // 기존 상태...
  const [companyName, setCompanyName] = useState(detectedCompanyName);
  const [saveTarget, setSaveTarget] = useState<'new' | 'existing'>('new');

  // 카테고리 상태 추가
  const [category, setCategory] = useState<ImageSubCategory>(
    DEFAULT_CATEGORY_BY_SITE[siteType] || 'unknown'
  );

  // 관련 카테고리 우선, 나머지 뒤에
  const sortedCategories = useMemo(() => {
    const relevant = RELEVANT_CATEGORIES_BY_SITE[siteType] || [];
    const others = IMAGE_SUB_CATEGORIES.filter(c => !relevant.includes(c));
    return [...relevant, ...others];
  }, [siteType]);

  const handleSave = () => {
    onSave({
      companyName: companyName.trim(),
      saveTarget,
      existingCompanyId: saveTarget === 'existing' ? existingCompanyId : undefined,
      category,  // 카테고리 추가
    });
  };

  return (
    <div className="aca-overlay">
      <div className="aca-modal">
        {/* 기존 섹션들... */}

        {/* 카테고리 선택 섹션 추가 */}
        <div className="aca-section">
          <h3 className="aca-label">카테고리</h3>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ImageSubCategory)}
            className="aca-select"
          >
            {sortedCategories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
                {cat === DEFAULT_CATEGORY_BY_SITE[siteType] && ' (추천)'}
              </option>
            ))}
          </select>
          <p className="aca-hint">
            {siteType} 사이트에서는 '{CATEGORY_LABELS[DEFAULT_CATEGORY_BY_SITE[siteType]]}'이
            기본 선택됩니다.
          </p>
        </div>

        {/* 액션 버튼 */}
      </div>
    </div>
  );
};
```

#### 3. CAPTURE_REGION 메시지에 카테고리 추가
```typescript
// shared/types/messages.ts

interface CaptureRegionPayload {
  dataUrl: string;
  companyName: string;
  companyUrl: string;
  siteType: DataType;
  existingCompanyId?: string;
  category?: ImageSubCategory;  // 추가
}
```

#### 4. 이미지 저장 시 카테고리 반영
```typescript
// extension/src/lib/storage.ts

export async function saveImage(data: {
  companyId: string;
  blob: Blob;
  mimeType: string;
  siteType: DataType;
  category?: ImageSubCategory;  // 추가
}): Promise<StoredImage> {
  const image: StoredImage = {
    id: crypto.randomUUID(),
    companyId: data.companyId,
    blob: data.blob,
    mimeType: data.mimeType,
    siteType: data.siteType,
    category: data.category,  // 저장
    createdAt: new Date(),
  };
  await db.images.add(image);
  return image;
}
```

#### 5. AI 분석 시 기존 카테고리 우선 옵션
```typescript
// spa/src/lib/analysis/image-analyzer.ts

interface AnalyzeOptions {
  // ...
  preserveExistingCategory?: boolean;  // 기존 카테고리 유지 옵션
}

async function analyzeImage(
  image: StoredImage,
  options: AnalyzeOptions
): Promise<AnalysisResult> {
  const aiResult = await callOllamaVision(image);

  // 기존 카테고리가 있고, 유지 옵션이면 AI 결과 무시
  if (options.preserveExistingCategory && image.category && image.category !== 'unknown') {
    return {
      ...aiResult,
      category: image.category,  // 기존 카테고리 유지
    };
  }

  return aiResult;
}
```

### UI/UX 변경사항

#### 확인 팝업 변경
```
기존:
┌─────────────────────────────────────────┐
│ 캡처 저장 확인                          │
├─────────────────────────────────────────┤
│ [미리보기 이미지]                       │
│                                         │
│ 데이터 타입: Wanted                     │
│                                         │
│ 저장 대상:                              │
│ ● 새 회사 생성                          │
│ ○ 기존 회사에 추가                      │
│                                         │
│ 회사명: [Naver          ]               │
│                                         │
│ [취소]                    [저장]        │
└─────────────────────────────────────────┘

개선 후:
┌─────────────────────────────────────────┐
│ 캡처 저장 확인                          │
├─────────────────────────────────────────┤
│ [미리보기 이미지]                       │
│                                         │
│ 데이터 타입: Wanted                     │
│                                         │
│ 카테고리: [회사 개요 (추천)      ▼]     │  ← 추가
│ ℹ Wanted에서는 '회사 개요'가 기본       │
│                                         │
│ 저장 대상:                              │
│ ● 새 회사 생성                          │
│ ○ 기존 회사에 추가                      │
│                                         │
│ 회사명: [Naver          ]               │
│                                         │
│ [취소]                    [저장]        │
└─────────────────────────────────────────┘
```

#### 카테고리 Select 옵션 순서
```
DART (금감원 공시) 사이트의 경우:
┌─────────────────────────┐
│ 재무상태표 (추천)       │ ← 관련 카테고리 먼저
│ 손익계산서              │
│ 매출 추이               │
│ 직원 추이               │
├─────────────────────────┤
│ 긍정 리뷰               │ ← 나머지 카테고리
│ 부정 리뷰               │
│ 회사 개요               │
│ 미분류                  │
└─────────────────────────┘

JOBPLANET (잡플래닛) 사이트의 경우:
┌─────────────────────────┐
│ 긍정 리뷰 (추천)        │ ← 관련 카테고리 먼저
│ 부정 리뷰               │
│ 회사 개요               │
├─────────────────────────┤
│ 재무상태표              │ ← 나머지 카테고리
│ 손익계산서              │
│ ...                     │
└─────────────────────────┘
```

---

## 수정 대상 파일

| 파일 경로 | 변경 내용 |
|-----------|----------|
| `shared/constants/categories.ts` | `DEFAULT_CATEGORY_BY_SITE`, `RELEVANT_CATEGORIES_BY_SITE` 추가 |
| `shared/types/messages.ts` | `CaptureRegionPayload`에 `category` 필드 추가 |
| `extension/src/content/confirm-popup.tsx` | 카테고리 Select UI 추가 |
| `extension/src/content/index.ts` | CAPTURE_REGION 메시지에 category 전달 |
| `extension/src/lib/storage.ts` | `saveImage`에 category 파라미터 추가 |
| `extension/src/background/handlers/image-handlers.ts` | 카테고리 저장 로직 |
| `spa/src/lib/analysis/image-analyzer.ts` | 기존 카테고리 유지 옵션 (선택) |

---

## 구현 체크리스트

### Phase 1: 상수 정의
- [ ] `DEFAULT_CATEGORY_BY_SITE` 매핑 추가
- [ ] `RELEVANT_CATEGORIES_BY_SITE` 매핑 추가
- [ ] 타입 export 확인

### Phase 2: 메시지 타입 확장
- [ ] `CaptureRegionPayload`에 `category` 필드 추가
- [ ] 관련 핸들러 타입 업데이트

### Phase 3: 확인 팝업 UI
- [ ] 카테고리 상태 추가
- [ ] 사이트별 기본값으로 초기화
- [ ] Select 컴포넌트 추가
- [ ] 관련 카테고리 우선 정렬
- [ ] 힌트 텍스트 표시

### Phase 4: 저장 로직
- [ ] `saveImage` 함수에 category 파라미터 추가
- [ ] CAPTURE_REGION 핸들러에서 category 전달
- [ ] DB에 category 저장 확인

### Phase 5: AI 분석 통합 (선택)
- [ ] `preserveExistingCategory` 옵션 추가
- [ ] 기존 카테고리 있으면 유지 로직

### Phase 6: 테스트
- [ ] DART에서 캡처 → 기본값 "재무상태표" 확인
- [ ] JOBPLANET에서 캡처 → 기본값 "긍정 리뷰" 확인
- [ ] 카테고리 변경 후 저장 → DB 확인
- [ ] SPA에서 카테고리 필터링 동작 확인

---

## 참고사항

### 카테고리 선택 가이드라인

| 사이트 | 주요 콘텐츠 | 기본 카테고리 |
|--------|------------|--------------|
| DART | 재무제표, 공시 | balance_sheet |
| WANTED | 회사 소개, 채용 | company_overview |
| JOBPLANET | 직원 리뷰, 연봉 | review_positive |
| SARAMIN | 회사 소개 | company_overview |
| INNOFOREST | 스타트업 정보 | company_overview |
| BLIND | 익명 리뷰 | review_positive |
| SMES | 정부 지원 정보 | company_overview |

### AI 분석과의 관계
- 사용자가 선택한 카테고리는 "힌트" 역할
- AI 분석 시 기존 카테고리를 참고할 수 있음
- `preserveExistingCategory` 옵션으로 덮어쓰기 방지 가능

### 향후 확장
- 사용자 정의 카테고리 추가 가능
- 카테고리별 색상 커스터마이징
- 자주 사용하는 카테고리 학습
