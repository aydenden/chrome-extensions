import { registerHandler } from '../external-api';
import { getImage, updateImageAnalysis } from '@/lib/storage';
import type { ImageSubCategory } from '@shared/constants/categories';

/**
 * 분석 결과 저장 관련 External API 핸들러 등록
 */
export function registerAnalysisHandlers(): void {
  /**
   * SAVE_ANALYSIS: 단일 이미지 분석 결과 저장
   */
  registerHandler('SAVE_ANALYSIS', async (payload) => {
    const { imageId, category, rawText, analysis } = payload;

    // 이미지 존재 확인
    const image = await getImage(imageId);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    // 분석 결과 저장
    await updateImageAnalysis(imageId, {
      category,
      rawText,
      analysis,
    });

    return {
      updatedAt: new Date().toISOString(),
    };
  });

  /**
   * BATCH_SAVE_ANALYSIS: 여러 이미지 분석 결과 일괄 저장
   */
  registerHandler('BATCH_SAVE_ANALYSIS', async (payload) => {
    const { results } = payload;

    const savedIds: string[] = [];
    const failedIds: string[] = [];

    // 각 결과를 순회하며 저장
    for (const result of results) {
      const { imageId, category, rawText, analysis } = result;

      try {
        // 이미지 존재 확인
        const image = await getImage(imageId);
        if (!image) {
          failedIds.push(imageId);
          continue;
        }

        // 분석 결과 저장
        await updateImageAnalysis(imageId, {
          category,
          rawText,
          analysis,
        });

        savedIds.push(imageId);
      } catch (error) {
        failedIds.push(imageId);
      }
    }

    return {
      savedCount: savedIds.length,
      failedIds,
    };
  });
}
