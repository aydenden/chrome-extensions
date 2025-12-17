# 데이터 흐름 스펙

## 1. 전체 데이터 흐름

```
┌────────────────────────────────────────────────────────────────────────┐
│                          데이터 수집 흐름                                │
│                                                                        │
│  [사용자] → [원티드/잡플래닛] → [Content Script] → [Extension DB]        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          분석 흐름                                      │
│                                                                        │
│  [SPA] → [Extension API] → [Tesseract OCR] → [Qwen3 LLM] → [저장]       │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. 데이터 수집 상세

### 2.1 스크린샷 캡처

```
[사용자]
    │ 팝업에서 "스크린샷 캡처" 클릭
    ▼
[Popup]
    │ chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' })
    ▼
[Service Worker]
    │ chrome.tabs.captureVisibleTab()
    ▼
[스크린샷 Blob]
    │
    ▼
[데이터 정규화]
    │ - dataUrl → Blob 변환
    │ - 회사 정보 추출 (URL 기반)
    │ - ID 생성
    ▼
[IndexedDB 저장]
    │ - companies 테이블 (없으면 생성)
    │ - images 테이블
    ▼
[완료 알림]
    │ chrome.notifications.create()
```

### 2.2 DOM 스크래핑

```
[Content Script 로드]
    │ 페이지 URL 확인 (원티드/잡플래닛)
    ▼
[회사 정보 추출]
    │ - 회사명
    │ - 업종
    │ - 직원수
    │ - 설립연도
    ▼
[Service Worker로 전송]
    │ chrome.runtime.sendMessage({ type: 'SAVE_COMPANY_DATA' })
    ▼
[IndexedDB 저장/업데이트]
```

## 3. 분석 흐름 상세

### 3.1 회사 목록 조회

```
[SPA: CompanyList]
    │
    ▼
[useCompanies Hook]
    │ React Query: queryFn
    ▼
[extension-client.ts]
    │ chrome.runtime.sendMessage(EXTENSION_ID, { type: 'GET_COMPANIES' })
    ▼
[Extension: external-api.ts]
    │ 보안 검증 (sender.url)
    ▼
[Extension: data-manager.ts]
    │ db.companies.toArray()
    │ + 이미지 개수 집계
    ▼
[Response: CompanyDTO[]]
    │
    ▼
[SPA: 렌더링]
```

### 3.2 상세 페이지 진입 (이미지 Sync)

상세 페이지 진입 시 이미지를 미리 로드하여 그리드에 표시합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      이미지 Sync 시퀀스 다이어그램                 │
└─────────────────────────────────────────────────────────────────┘

[User]              [SPA]                [Extension]
  │                   │                       │
  │── 상세 페이지 ───>│                       │
  │                   │                       │
  │                   │── GET_IMAGES ────────>│
  │                   │<── ImageMetaDTO[] ────│
  │                   │                       │
  │                   │ for each (not cached):│
  │                   │── GET_IMAGE_DATA ────>│
  │                   │<── ImageDataDTO ──────│
  │                   │                       │
  │                   │── cache locally ──────│
  │                   │                       │
  │<── 이미지 그리드 ──│                       │
```

**캐시 전략:**
- SPA 로컬 캐시: IndexedDB 또는 Memory
- 캐시 키: `imageId`
- 새로고침 시 재요청 (Memory 캐시의 경우)

### 3.3 분석 실행

분석 시작 시 로컬 캐시된 이미지를 사용합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      분석 시퀀스 다이어그램                        │
└─────────────────────────────────────────────────────────────────┘

[User]              [SPA]                [OCR]              [LLM]              [Extension]
  │                   │                    │                  │                     │
  │── 분석 시작 ─────>│                    │                  │                     │
  │                   │                    │                  │                     │
  │                   │ for each (from cache):                │                     │
  │                   │                    │                  │                     │
  │                   │── base64ToBlob ──> │                  │                     │
  │                   │                    │                  │                     │
  │                   │── recognize ──────>│                  │                     │
  │                   │<── rawText ────────│                  │                     │
  │                   │                    │                  │                     │
  │                   │── classify ───────────────────────>   │                     │
  │                   │<── category ──────────────────────────│                     │
  │                   │                    │                  │                     │
  │                   │── analyze ────────────────────────>   │                     │
  │                   │<── analysis ──────────────────────────│                     │
  │                   │                    │                  │                     │
  │                   │── SAVE_ANALYSIS ─────────────────────────────────────────> │
  │                   │<── success ────────────────────────────────────────────────│
  │                   │                    │                  │                     │
  │                   │ next image...      │                  │                     │
  │                   │                    │                  │                     │
  │<── 완료 ──────────│                    │                  │                     │
```

### 3.4 상태 관리

```
[분석 시작]
    │
    ├─> [SPA State 업데이트]
    │       - isAnalyzing: true
    │       - currentImageIndex: 0
    │       - totalImages: N
    │
    ▼ (반복)
[이미지 처리]
    │
    ├─> [Progress 업데이트]
    │       - currentImageIndex++
    │       - progress: current/total
    │
    ├─> [OCR 완료]
    │       - rawText 임시 저장
    │
    ├─> [LLM 완료]
    │       - category, analysis 획득
    │
    ├─> [Extension 저장]
    │       - IndexedDB 업데이트
    │
    ├─> [React Query 캐시 무효화]
    │       - images 쿼리 refetch
    │
    ▼
[분석 완료]
    │
    └─> [SPA State 업데이트]
            - isAnalyzing: false
            - 결과 요약 표시
```

## 4. 데이터 모델

### 4.1 Extension (IndexedDB)

```typescript
// companies 테이블
interface Company {
  id: string;              // UUID
  name: string;
  url: string;
  siteType: DataType;
  metadata?: {
    industry?: string;
    employeeCount?: string;
    foundedYear?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// images 테이블
interface StoredImage {
  id: string;              // UUID
  companyId: string;       // FK
  blob: Blob;              // 원본 이미지
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  category?: ImageSubCategory;
  rawText?: string;        // OCR 결과
  analysis?: string;       // LLM 분석
  createdAt: Date;
  updatedAt?: Date;
}
```

### 4.2 SPA (메모리/캐시)

```typescript
// API 응답 타입 (Blob 제외)
interface CompanyDTO {
  id: string;
  name: string;
  url: string;
  siteType: DataType;
  imageCount: number;
  analyzedCount: number;
  createdAt: string;       // ISO string
  updatedAt: string;
}

interface ImageMetaDTO {
  id: string;
  companyId: string;
  mimeType: string;
  size: number;
  category?: ImageSubCategory;
  hasRawText: boolean;
  hasAnalysis: boolean;
  createdAt: string;
}

interface ImageDataDTO {
  id: string;
  base64: string;          // Base64 인코딩
  mimeType: string;
  rawText?: string;
  analysis?: string;
}
```

## 5. 캐싱 전략

### 5.1 React Query 캐시

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30초 후 stale
      gcTime: 5 * 60_000,       // 5분 후 GC
      refetchOnWindowFocus: false,
    },
  },
});

// 캐시 키 구조
{
  ['companies']: CompanyDTO[],
  ['company', companyId]: CompanyDTO,
  ['images', companyId]: ImageMetaDTO[],
  ['imageData', imageId]: ImageDataDTO,  // 개별 이미지는 영구 캐시
}
```

### 5.2 이미지 캐시

```typescript
// 이미지 데이터는 변경되지 않으므로 영구 캐시
export function useImageData(imageId: string | null) {
  return useQuery({
    queryKey: ['imageData', imageId],
    queryFn: () => api.getImageData(imageId!),
    enabled: !!imageId,
    staleTime: Infinity,       // 절대 stale 안 됨
    gcTime: 30 * 60_000,       // 30분 후 GC
  });
}
```

## 6. 에러 처리

### 6.1 에러 유형

```typescript
enum ErrorType {
  // 연결 에러
  EXTENSION_NOT_INSTALLED = 'EXTENSION_NOT_INSTALLED',
  EXTENSION_DISCONNECTED = 'EXTENSION_DISCONNECTED',

  // 데이터 에러
  COMPANY_NOT_FOUND = 'COMPANY_NOT_FOUND',
  IMAGE_NOT_FOUND = 'IMAGE_NOT_FOUND',

  // 처리 에러
  OCR_FAILED = 'OCR_FAILED',
  LLM_FAILED = 'LLM_FAILED',
  SAVE_FAILED = 'SAVE_FAILED',

  // 시스템 에러
  UNKNOWN = 'UNKNOWN',
}
```

### 6.2 에러 복구 흐름

```
[에러 발생]
    │
    ├─> [연결 에러]
    │       - Extension 재연결 시도
    │       - 실패 시 사용자 알림
    │
    ├─> [OCR 에러]
    │       - 이미지 스킵
    │       - 다음 이미지 계속
    │       - 실패 목록 기록
    │
    ├─> [LLM 에러]
    │       - 재시도 (3회)
    │       - 실패 시 카테고리 'unknown'
    │
    └─> [저장 에러]
            - 재시도 (3회)
            - 실패 시 로컬 저장 후 나중에 동기화
```

## 7. 실시간 동기화 (선택)

### 7.1 Port 연결

```
[SPA 시작]
    │
    ▼
[Port 연결]
    │ chrome.runtime.connect(EXTENSION_ID, { name: 'sync' })
    │
    ▼
[이벤트 리스너 등록]
    │ port.onMessage.addListener(handleSyncEvent)
    │
    ▼
[Extension 데이터 변경]
    │ IndexedDB 변경 감지
    │
    ▼
[이벤트 전송]
    │ port.postMessage({ type: 'DATA_CHANGED', ... })
    │
    ▼
[SPA 캐시 무효화]
    │ queryClient.invalidateQueries()
    │
    ▼
[자동 refetch]
```

## 8. 성능 최적화

### 8.1 이미지 지연 로딩

```typescript
// 목록에서는 썸네일만 로드
function ImageList({ images }: { images: ImageMetaDTO[] }) {
  return images.map(img => (
    <ImageThumbnail
      key={img.id}
      imageId={img.id}
      onClick={() => loadFullImage(img.id)}
    />
  ));
}

// 클릭 시 전체 이미지 로드
const { data } = useImageData(selectedImageId);
```

### 8.2 분석 배치 처리

```typescript
// 여러 이미지 분석 시 배치로 저장
const BATCH_SIZE = 5;

async function batchAnalyze(images: ImageMetaDTO[]) {
  const results = [];

  for (const img of images) {
    const result = await analyzeImage(img);
    results.push(result);

    // 배치 사이즈마다 저장
    if (results.length >= BATCH_SIZE) {
      await api.batchSaveAnalysis(results);
      results.length = 0;
    }
  }

  // 남은 결과 저장
  if (results.length > 0) {
    await api.batchSaveAnalysis(results);
  }
}
```

## 9. 데이터 일관성

### 9.1 낙관적 업데이트

```typescript
const saveAnalysis = useMutation({
  mutationFn: api.saveAnalysis,

  // 낙관적 업데이트
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['images', newData.companyId]);

    const previousImages = queryClient.getQueryData(['images', newData.companyId]);

    queryClient.setQueryData(['images', newData.companyId], (old: ImageMetaDTO[]) =>
      old.map(img =>
        img.id === newData.imageId
          ? { ...img, category: newData.category, hasAnalysis: true }
          : img
      )
    );

    return { previousImages };
  },

  // 에러 시 롤백
  onError: (err, newData, context) => {
    queryClient.setQueryData(
      ['images', newData.companyId],
      context?.previousImages
    );
  },
});
```

### 9.2 충돌 해결

Extension에서 데이터 변경 시 SPA 캐시와 충돌 가능:

```typescript
// 충돌 감지
const { data: serverData } = useImages(companyId);
const cachedData = queryClient.getQueryData(['images', companyId]);

if (serverData?.length !== cachedData?.length) {
  // 서버 데이터로 덮어쓰기
  queryClient.setQueryData(['images', companyId], serverData);
}
```

## 10. 삭제 플로우

### 10.1 회사 삭제

회사 삭제 시 연결된 모든 이미지와 분석 결과도 함께 삭제됩니다.

```
[User]              [SPA]                [Extension]
  │                   │                       │
  │── 회사 삭제 ─────>│                       │
  │                   │                       │
  │                   │── DELETE_COMPANY ────>│
  │                   │   (companyId)         │
  │                   │                       │
  │                   │<── success ───────────│
  │                   │                       │
  │                   │── SPA 캐시 삭제 ──────│
  │                   │   (해당 회사 이미지)  │
  │                   │                       │
  │<── 목록 갱신 ─────│                       │
```

**삭제 범위:**

| 대상 | 삭제 내용 |
|------|----------|
| Extension | Company + 연결된 모든 Image + Analysis |
| SPA 캐시 | 해당 회사의 이미지 데이터 |

**캐시 무효화:**

```typescript
// 회사 삭제 후
queryClient.invalidateQueries(['companies']);
queryClient.removeQueries(['company', companyId]);
queryClient.removeQueries(['images', companyId]);
// 해당 회사의 모든 이미지 데이터 캐시 제거
images.forEach(img => {
  queryClient.removeQueries(['imageData', img.id]);
});
```

### 10.2 이미지 삭제

개별 이미지 삭제 시 해당 이미지와 분석 결과만 삭제됩니다.

```
[User]              [SPA]                [Extension]
  │                   │                       │
  │── 이미지 삭제 ───>│                       │
  │                   │                       │
  │                   │── DELETE_IMAGE ──────>│
  │                   │   (imageId)           │
  │                   │                       │
  │                   │<── success ───────────│
  │                   │                       │
  │                   │── SPA 캐시 삭제 ──────│
  │                   │   (해당 이미지)       │
  │                   │                       │
  │<── 그리드 갱신 ───│                       │
```

**삭제 범위:**

| 대상 | 삭제 내용 |
|------|----------|
| Extension | Image + Analysis |
| SPA 캐시 | 해당 이미지 데이터 |

**캐시 무효화:**

```typescript
// 이미지 삭제 후
queryClient.invalidateQueries(['images', companyId]);
queryClient.removeQueries(['imageData', imageId]);
```

### 10.3 낙관적 삭제

사용자 경험을 위해 삭제 요청 전 UI를 먼저 업데이트합니다.

```typescript
const deleteImage = useMutation({
  mutationFn: api.deleteImage,

  onMutate: async ({ imageId, companyId }) => {
    await queryClient.cancelQueries(['images', companyId]);

    const previousImages = queryClient.getQueryData(['images', companyId]);

    // 낙관적으로 이미지 제거
    queryClient.setQueryData(['images', companyId], (old: ImageMetaDTO[]) =>
      old.filter(img => img.id !== imageId)
    );

    return { previousImages };
  },

  onError: (err, { companyId }, context) => {
    // 에러 시 롤백
    queryClient.setQueryData(['images', companyId], context?.previousImages);
  },

  onSuccess: (_, { imageId }) => {
    // 이미지 데이터 캐시 제거
    queryClient.removeQueries(['imageData', imageId]);
  },
});
```
