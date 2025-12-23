import { registerHandler } from '../external-api';
import { getImage, getImagesByCompany, deleteImage } from '@/lib/storage';
import { db } from '@/lib/db';
import type { StoredImage } from '@/lib/db';
import type { ImageMetaDTO, ImageDataDTO } from '@shared/types';
import type { ImageSubCategory } from '@shared/constants/categories';

/**
 * Blob을 Base64 문자열로 변환
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // data:image/png;base64,XXX 형식에서 base64 부분만 추출
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 이미지 썸네일 생성 (OffscreenCanvas 사용)
 */
async function createThumbnail(
  blob: Blob,
  maxWidth: number = 200,
  maxHeight: number = 200
): Promise<{ base64: string; width: number; height: number }> {
  // Blob을 ImageBitmap으로 변환
  const imageBitmap = await createImageBitmap(blob);
  const { width: originalWidth, height: originalHeight } = imageBitmap;

  // 비율 유지하면서 리사이즈 계산
  let targetWidth = originalWidth;
  let targetHeight = originalHeight;

  if (originalWidth > maxWidth || originalHeight > maxHeight) {
    const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
    targetWidth = Math.round(originalWidth * ratio);
    targetHeight = Math.round(originalHeight * ratio);
  }

  // OffscreenCanvas로 리사이즈
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

  // JPEG로 변환
  const thumbnailBlob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: 0.8,
  });

  const base64 = await blobToBase64(thumbnailBlob);

  return {
    base64,
    width: targetWidth,
    height: targetHeight,
  };
}

/**
 * StoredImage를 ImageMetaDTO로 변환
 */
function toImageMetaDTO(image: StoredImage): ImageMetaDTO {
  return {
    id: image.id,
    companyId: image.companyId,
    mimeType: image.mimeType,
    size: image.size,
    width: image.width,
    height: image.height,
    category: image.category,
    hasRawText: !!image.rawText,
    hasAnalysis: !!image.analysis,
    analyzedModel: image.analyzedModel,
    memo: image.memo,
    createdAt: image.createdAt.toISOString(),
  };
}

/**
 * 이미지 관련 External API 핸들러 등록
 */
export function registerImageHandlers(): void {
  /**
   * GET_IMAGES: 회사별 이미지 목록 조회
   */
  registerHandler('GET_IMAGES', async (payload) => {
    const { companyId, filter } = payload;

    let images = await getImagesByCompany(companyId);

    // category 필터링
    if (filter?.category) {
      images = images.filter(img => img.category === filter.category);
    }

    // hasAnalysis 필터링
    if (filter?.hasAnalysis !== undefined) {
      if (filter.hasAnalysis) {
        images = images.filter(img => !!img.analysis);
      } else {
        images = images.filter(img => !img.analysis);
      }
    }

    return images.map(toImageMetaDTO);
  });

  /**
   * GET_IMAGE_DATA: 이미지 Base64 데이터 조회
   */
  registerHandler('GET_IMAGE_DATA', async (payload) => {
    const { imageId, includeRawText = false, includeAnalysis = false } = payload;

    const image = await getImage(imageId);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    const base64 = await blobToBase64(image.blob);

    const result: ImageDataDTO = {
      id: image.id,
      base64,
      mimeType: image.mimeType,
      category: image.category,
      memo: image.memo,
    };

    if (includeRawText && image.rawText) {
      result.rawText = image.rawText;
    }

    if (includeAnalysis && image.analysis) {
      result.analysis = image.analysis;
    }

    return result;
  });

  /**
   * GET_IMAGE_THUMBNAIL: 썸네일 생성
   */
  registerHandler('GET_IMAGE_THUMBNAIL', async (payload) => {
    const { imageId, maxWidth = 200, maxHeight = 200 } = payload;

    const image = await getImage(imageId);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    const { base64, width, height } = await createThumbnail(image.blob, maxWidth, maxHeight);

    return {
      base64,
      mimeType: 'image/jpeg' as const,
      width,
      height,
    };
  });

  /**
   * DELETE_IMAGE: 이미지 삭제
   */
  registerHandler('DELETE_IMAGE', async (payload) => {
    const { imageId } = payload;

    const image = await getImage(imageId);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    await deleteImage(imageId);

    return null;
  });
}
