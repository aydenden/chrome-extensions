import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getExtensionClient } from '@/lib/extension-client';
import { queryKeys } from '@/lib/query/keys';
import { imageCache, thumbnailCache } from '@/lib/cache';
import type { ImageDataDTO } from '@shared/types/models';

function estimateDataSize(data: ImageDataDTO | { base64: string }): number {
  // Base64 string size estimation: ~1.33x the original binary size
  // For more accurate estimation, we count the actual string length in bytes
  return new Blob([data.base64]).size;
}

export function useImageWithCache(imageId: string | undefined) {
  const client = getExtensionClient();

  return useQuery({
    queryKey: queryKeys.imageData(imageId!),
    queryFn: async () => {
      // Check cache first
      const cached = imageCache.get(imageId!);
      if (cached) {
        return cached;
      }

      // Fetch from extension
      const data = await client.send('GET_IMAGE_DATA', { imageId: imageId! });

      // Store in cache
      const size = estimateDataSize(data);
      imageCache.set(imageId!, data, size);

      return data;
    },
    enabled: !!imageId,
    staleTime: Infinity,
    gcTime: 60 * 60_000, // 1 hour
  });
}

export function useThumbnailWithCache(imageId: string | undefined) {
  const client = getExtensionClient();

  return useQuery({
    queryKey: queryKeys.thumbnail(imageId!),
    queryFn: async () => {
      // Check cache first
      const cached = thumbnailCache.get(imageId!);
      if (cached) {
        return cached;
      }

      // Fetch from extension
      const data = await client.send('GET_IMAGE_THUMBNAIL', { imageId: imageId! });

      // Store in cache
      const size = estimateDataSize(data);
      thumbnailCache.set(imageId!, data, size);

      return data;
    },
    enabled: !!imageId,
    staleTime: Infinity,
    gcTime: 60 * 60_000, // 1 hour
  });
}

export function usePrefetchThumbnails(imageIds: string[]) {
  const client = getExtensionClient();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['prefetch-thumbnails', imageIds],
    queryFn: async () => {
      // Filter out already cached images
      const uncachedIds = imageIds.filter(id => !thumbnailCache.has(id));

      if (uncachedIds.length === 0) {
        return { cached: imageIds.length, fetched: 0 };
      }

      // Batch prefetch: 5 images at a time
      const BATCH_SIZE = 5;
      let fetchedCount = 0;

      for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
        const batch = uncachedIds.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (imageId) => {
            try {
              const data = await client.send('GET_IMAGE_THUMBNAIL', { imageId });
              const size = estimateDataSize(data);

              // Store in both cache and React Query cache
              thumbnailCache.set(imageId, data, size);
              queryClient.setQueryData(queryKeys.thumbnail(imageId), data);

              fetchedCount++;
            } catch (error) {
              console.error(`Failed to prefetch thumbnail ${imageId}:`, error);
            }
          })
        );
      }

      return {
        cached: imageIds.length - uncachedIds.length,
        fetched: fetchedCount,
      };
    },
    enabled: imageIds.length > 0,
    staleTime: Infinity,
  });
}
