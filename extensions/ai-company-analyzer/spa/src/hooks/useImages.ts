import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExtensionClient } from '@/lib/extension-client';
import { queryKeys } from '@/lib/query/keys';

export function useImages(companyId: string | undefined) {
  const client = getExtensionClient();
  return useQuery({
    queryKey: queryKeys.images(companyId!),
    queryFn: () => client.send('GET_IMAGES', { companyId: companyId! }),
    enabled: !!companyId,
    staleTime: 5 * 60_000, // 5분 - 분석 중 refetch 방지
  });
}

export function useImageData(imageId: string | undefined) {
  const client = getExtensionClient();
  return useQuery({
    queryKey: queryKeys.imageData(imageId!),
    queryFn: () => client.send('GET_IMAGE_DATA', { imageId: imageId! }),
    enabled: !!imageId,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

export function useDeleteImage(companyId: string) {
  const client = getExtensionClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => client.send('DELETE_IMAGE', { imageId }),
    onMutate: async (imageId) => {
      await qc.cancelQueries({ queryKey: queryKeys.images(companyId) });
      const previousImages = qc.getQueryData(queryKeys.images(companyId));
      qc.setQueryData(queryKeys.images(companyId), (old: any[]) => old?.filter(img => img.id !== imageId) ?? []);
      return { previousImages };
    },
    onError: (_err, _imageId, context) => {
      qc.setQueryData(queryKeys.images(companyId), context?.previousImages);
    },
    onSuccess: (_, imageId) => {
      qc.removeQueries({ queryKey: queryKeys.imageData(imageId) });
      qc.invalidateQueries({ queryKey: queryKeys.companies() });
    },
  });
}
