# Feature 15: React Query + Query Key Factory

## 개요

TanStack Query 설정 및 Query Key Factory 패턴을 구현합니다.

## 범위

- QueryClient 설정
- queryKeys.ts (팩토리 패턴)
- useCompanies, useCompany, useImages 훅

## 의존성

- Feature 14: SPA Extension Context

## 구현 상세

### spa/src/lib/query/client.ts

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30초 후 stale
      gcTime: 5 * 60_000,          // 5분 후 GC
      refetchOnWindowFocus: false, // 포커스 시 자동 refetch 비활성화
      retry: 1,                    // 1회 재시도
    },
    mutations: {
      retry: 0,
    },
  },
});
```

### spa/src/lib/query/keys.ts

```typescript
/** Query Key Factory */
export const queryKeys = {
  // 최상위 키
  all: ['extension'] as const,

  // Companies
  companies: () => [...queryKeys.all, 'companies'] as const,
  companiesFiltered: (filters: { siteType?: string; sortBy?: string }) =>
    [...queryKeys.companies(), filters] as const,

  // Company (단일)
  company: (id: string) => [...queryKeys.all, 'company', id] as const,

  // Images
  images: (companyId: string) => [...queryKeys.all, 'images', companyId] as const,
  imagesFiltered: (companyId: string, filters: { category?: string; hasAnalysis?: boolean }) =>
    [...queryKeys.images(companyId), filters] as const,

  // Image Data (개별 이미지)
  imageData: (id: string) => [...queryKeys.all, 'imageData', id] as const,

  // Thumbnail
  thumbnail: (id: string) => [...queryKeys.all, 'thumbnail', id] as const,

  // Stats
  stats: () => [...queryKeys.all, 'stats'] as const,
} as const;
```

### spa/src/hooks/useCompanies.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExtensionClient } from '@/lib/extension-client';
import { queryKeys } from '@/lib/query/keys';
import type { DataType } from '@shared/constants/categories';

interface CompanyFilters {
  siteType?: DataType;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/** 회사 목록 조회 */
export function useCompanies(filters?: CompanyFilters) {
  const client = getExtensionClient();

  return useQuery({
    queryKey: filters
      ? queryKeys.companiesFiltered(filters)
      : queryKeys.companies(),
    queryFn: () => client.send('GET_COMPANIES', filters),
    staleTime: 30_000,
  });
}

/** 회사 상세 조회 */
export function useCompany(companyId: string | undefined) {
  const client = getExtensionClient();

  return useQuery({
    queryKey: queryKeys.company(companyId!),
    queryFn: () => client.send('GET_COMPANY', { companyId: companyId! }),
    enabled: !!companyId,
    staleTime: 60_000, // 1분
  });
}

/** 회사 삭제 */
export function useDeleteCompany() {
  const client = getExtensionClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (companyId: string) =>
      client.send('DELETE_COMPANY', { companyId }),

    onSuccess: (_, companyId) => {
      // 회사 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.companies() });
      // 해당 회사 캐시 제거
      queryClient.removeQueries({ queryKey: queryKeys.company(companyId) });
      // 해당 회사 이미지 캐시 제거
      queryClient.removeQueries({ queryKey: queryKeys.images(companyId) });
    },
  });
}
```

### spa/src/hooks/useImages.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExtensionClient } from '@/lib/extension-client';
import { queryKeys } from '@/lib/query/keys';
import type { ImageSubCategory } from '@shared/constants/categories';

interface ImageFilters {
  category?: ImageSubCategory;
  hasAnalysis?: boolean;
}

/** 이미지 목록 조회 */
export function useImages(companyId: string | undefined, filters?: ImageFilters) {
  const client = getExtensionClient();

  return useQuery({
    queryKey: filters
      ? queryKeys.imagesFiltered(companyId!, filters)
      : queryKeys.images(companyId!),
    queryFn: () => client.send('GET_IMAGES', { companyId: companyId!, filter: filters }),
    enabled: !!companyId,
    staleTime: 30_000,
  });
}

/** 이미지 데이터 조회 (Base64) */
export function useImageData(imageId: string | undefined) {
  const client = getExtensionClient();

  return useQuery({
    queryKey: queryKeys.imageData(imageId!),
    queryFn: () => client.send('GET_IMAGE_DATA', { imageId: imageId! }),
    enabled: !!imageId,
    staleTime: Infinity,     // 이미지는 변경되지 않음
    gcTime: 30 * 60_000,     // 30분 후 GC
  });
}

/** 썸네일 조회 */
export function useThumbnail(imageId: string | undefined) {
  const client = getExtensionClient();

  return useQuery({
    queryKey: queryKeys.thumbnail(imageId!),
    queryFn: () => client.send('GET_IMAGE_THUMBNAIL', {
      imageId: imageId!,
      maxWidth: 200,
      maxHeight: 200,
    }),
    enabled: !!imageId,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

/** 이미지 삭제 */
export function useDeleteImage(companyId: string) {
  const client = getExtensionClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: string) =>
      client.send('DELETE_IMAGE', { imageId }),

    // 낙관적 업데이트
    onMutate: async (imageId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.images(companyId) });

      const previousImages = queryClient.getQueryData(queryKeys.images(companyId));

      queryClient.setQueryData(
        queryKeys.images(companyId),
        (old: any[]) => old?.filter(img => img.id !== imageId) ?? []
      );

      return { previousImages };
    },

    onError: (err, imageId, context) => {
      // 롤백
      queryClient.setQueryData(
        queryKeys.images(companyId),
        context?.previousImages
      );
    },

    onSuccess: (_, imageId) => {
      // 이미지 데이터 캐시 제거
      queryClient.removeQueries({ queryKey: queryKeys.imageData(imageId) });
      queryClient.removeQueries({ queryKey: queryKeys.thumbnail(imageId) });
      // 회사 목록 캐시 무효화 (imageCount 변경)
      queryClient.invalidateQueries({ queryKey: queryKeys.companies() });
    },
  });
}
```

### spa/src/hooks/useStats.ts

```typescript
import { useQuery } from '@tanstack/react-query';
import { getExtensionClient } from '@/lib/extension-client';
import { queryKeys } from '@/lib/query/keys';

/** 통계 조회 */
export function useStats() {
  const client = getExtensionClient();

  return useQuery({
    queryKey: queryKeys.stats(),
    queryFn: () => client.send('GET_STATS'),
    staleTime: 60_000, // 1분
  });
}
```

### spa/src/main.tsx에서 사용

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query/client';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

## 완료 기준

- [ ] QueryClient 전역 설정
- [ ] Query Key Factory 패턴 구현
- [ ] useCompanies: 회사 목록 조회
- [ ] useCompany: 회사 상세 조회
- [ ] useImages: 이미지 목록 조회
- [ ] useImageData: 이미지 데이터 조회 (영구 캐시)
- [ ] useDeleteCompany: 회사 삭제 + 캐시 무효화
- [ ] useDeleteImage: 이미지 삭제 + 낙관적 업데이트

## 참조 문서

- spec/03-spa-structure.md Section 4 (상태 관리)
- spec/04-data-flow.md Section 5 (캐싱 전략)
