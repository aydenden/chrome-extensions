# Feature 36: 이미지 캐싱 최적화

## 개요

이미지 데이터의 효율적인 캐싱 전략을 구현합니다.

## 범위

- React Query 캐싱 최적화
- 썸네일 프리로딩
- 이미지 LRU 캐시
- 메모리 관리

## 의존성

- Feature 15: React Query + Query Key Factory

## 구현 상세

### spa/src/lib/cache/image-cache.ts

```typescript
interface CacheEntry<T> {
  data: T;
  size: number;
  lastAccessed: number;
}

/** LRU 기반 이미지 캐시 */
export class ImageCache<T = string> {
  private cache = new Map<string, CacheEntry<T>>();
  private currentSize = 0;
  private readonly maxSize: number;

  constructor(maxSizeMB: number = 50) {
    this.maxSize = maxSizeMB * 1024 * 1024; // MB → bytes
  }

  /** 캐시에서 조회 */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.data;
    }
    return undefined;
  }

  /** 캐시에 저장 */
  set(key: string, data: T, sizeBytes: number): void {
    // 기존 항목이 있으면 제거
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // 공간 확보
    while (this.currentSize + sizeBytes > this.maxSize && this.cache.size > 0) {
      this.evictOldest();
    }

    // 저장
    this.cache.set(key, {
      data,
      size: sizeBytes,
      lastAccessed: Date.now(),
    });
    this.currentSize += sizeBytes;
  }

  /** 캐시에서 삭제 */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }

  /** 가장 오래된 항목 제거 */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  /** 캐시 통계 */
  getStats(): { entries: number; sizeBytes: number; maxBytes: number } {
    return {
      entries: this.cache.size,
      sizeBytes: this.currentSize,
      maxBytes: this.maxSize,
    };
  }

  /** 캐시 비우기 */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /** 키 존재 여부 */
  has(key: string): boolean {
    return this.cache.has(key);
  }
}

/** 전역 이미지 캐시 인스턴스 */
export const imageCache = new ImageCache<string>(50); // 50MB
export const thumbnailCache = new ImageCache<string>(20); // 20MB
```

### spa/src/hooks/useImageWithCache.ts

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getExtensionClient } from '@/lib/extension-client';
import { queryKeys } from '@/lib/query/keys';
import { imageCache, thumbnailCache } from '@/lib/cache/image-cache';

/** 캐시 최적화된 이미지 데이터 훅 */
export function useImageWithCache(imageId: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.imageData(imageId!),
    queryFn: async () => {
      // 메모리 캐시 확인
      const cached = imageCache.get(imageId!);
      if (cached) {
        return { dataUrl: cached };
      }

      // Extension에서 로드
      const client = getExtensionClient();
      const result = await client.send('GET_IMAGE_DATA', { imageId: imageId! });

      // 메모리 캐시에 저장
      const sizeBytes = result.dataUrl.length * 2; // UTF-16 기준
      imageCache.set(imageId!, result.dataUrl, sizeBytes);

      return result;
    },
    enabled: !!imageId,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000, // 1시간
  });
}

/** 캐시 최적화된 썸네일 훅 */
export function useThumbnailWithCache(imageId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.thumbnail(imageId!),
    queryFn: async () => {
      const cached = thumbnailCache.get(imageId!);
      if (cached) {
        return { dataUrl: cached };
      }

      const client = getExtensionClient();
      const result = await client.send('GET_IMAGE_THUMBNAIL', {
        imageId: imageId!,
        maxWidth: 200,
        maxHeight: 200,
      });

      const sizeBytes = result.dataUrl.length * 2;
      thumbnailCache.set(imageId!, result.dataUrl, sizeBytes);

      return result;
    },
    enabled: !!imageId,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
  });
}

/** 썸네일 프리로딩 */
export function usePrefetchThumbnails(imageIds: string[]) {
  const queryClient = useQueryClient();

  const prefetch = async () => {
    const client = getExtensionClient();

    // 캐시에 없는 것만 프리로드
    const uncached = imageIds.filter(id => !thumbnailCache.has(id));

    // 병렬로 로드 (최대 5개씩)
    const batchSize = 5;
    for (let i = 0; i < uncached.length; i += batchSize) {
      const batch = uncached.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (imageId) => {
          try {
            const result = await client.send('GET_IMAGE_THUMBNAIL', {
              imageId,
              maxWidth: 200,
              maxHeight: 200,
            });

            thumbnailCache.set(imageId, result.dataUrl, result.dataUrl.length * 2);

            // React Query 캐시에도 저장
            queryClient.setQueryData(queryKeys.thumbnail(imageId), result);
          } catch {
            // 실패 무시
          }
        })
      );
    }
  };

  return { prefetch };
}
```

### spa/src/lib/cache/index.ts

```typescript
export { ImageCache, imageCache, thumbnailCache } from './image-cache';
```

### spa/src/components/image/ImageCard.tsx (캐시 적용)

```tsx
import { useEffect } from 'react';
import { useThumbnailWithCache, usePrefetchThumbnails } from '@/hooks/useImageWithCache';
// ...

// 이미지 그리드에서 프리로딩 적용
export function ImageGridWithPrefetch({ images, ...props }) {
  const imageIds = images.map(img => img.id);
  const { prefetch } = usePrefetchThumbnails(imageIds);

  useEffect(() => {
    prefetch();
  }, [imageIds.join(',')]);

  // ...
}
```

## 완료 기준

- [ ] ImageCache: LRU 기반 메모리 캐시
- [ ] 최대 용량 관리 (50MB)
- [ ] useImageWithCache: React Query + 메모리 캐시
- [ ] useThumbnailWithCache: 썸네일 캐시
- [ ] usePrefetchThumbnails: 프리로딩
- [ ] 캐시 통계 조회

## 참조 문서

- spec/04-data-flow.md Section 5 (캐싱 전략)
