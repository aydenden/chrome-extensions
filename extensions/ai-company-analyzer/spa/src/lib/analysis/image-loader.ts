/**
 * 이미지 로드 및 VLM 최적화 서비스
 */
import { getExtensionClient } from '@/lib/extension-client';
import { optimizeImageForVLM } from '@/lib/image';
import type { LoadedImage } from './types';

/** 이미지 로더 옵션 */
export interface ImageLoaderOptions {
  /** 진행률 콜백 */
  onProgress?: (current: number, total: number) => void;
  /** 중단 시그널 */
  abortSignal?: AbortSignal;
}

/**
 * 이미지 데이터 로드 및 VLM 최적화
 * @param imageIds 이미지 ID 배열
 * @param options 로더 옵션
 * @returns 최적화된 이미지 배열
 */
export async function loadAndOptimizeImages(
  imageIds: string[],
  options?: ImageLoaderOptions
): Promise<LoadedImage[]> {
  const client = getExtensionClient();
  const results: LoadedImage[] = [];

  for (let i = 0; i < imageIds.length; i++) {
    // 중단 체크
    if (options?.abortSignal?.aborted) {
      throw new DOMException('이미지 로드 중단됨', 'AbortError');
    }

    // Extension에서 이미지 데이터 로드
    const imageData = await client.send('GET_IMAGE_DATA', { imageId: imageIds[i] });

    // VLM 최적화: 32배수 정렬 + JPEG 압축
    const optimizedBase64 = await optimizeImageForVLM(imageData.base64);

    results.push({
      id: imageData.id,
      base64: optimizedBase64,
    });

    // 진행률 콜백
    options?.onProgress?.(i + 1, imageIds.length);
  }

  return results;
}
