import { registerHandler } from '../external-api';
import { getImage, updateImageAnalysis, getCompany, updateCompany } from '@/lib/storage';
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
   * UPDATE_IMAGE_MEMO: 이미지 메모 업데이트
   */
  registerHandler('UPDATE_IMAGE_MEMO', async (payload) => {
    const { imageId, memo } = payload;

    const image = await getImage(imageId);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    await updateImageAnalysis(imageId, {
      memo,
    });

    return {
      updatedAt: new Date().toISOString(),
    };
  });

  /**
   * UPDATE_COMPANY_CONTEXT: 회사 분석 컨텍스트 업데이트
   */
  registerHandler('UPDATE_COMPANY_CONTEXT', async (payload) => {
    const { companyId, analysisContext } = payload;

    const company = await getCompany(companyId);
    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    await updateCompany(companyId, {
      analysisContext,
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
      const { imageId, category, rawText, analysis, analyzedModel } = result;

      try {
        // 이미지 존재 확인
        const image = await getImage(imageId);
        if (!image) {
          failedIds.push(imageId);
          continue;
        }

        // 분석 결과 저장 (analyzedModel 포함)
        await updateImageAnalysis(imageId, {
          category,
          rawText,
          analysis,
          analyzedModel,
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

  /**
   * UPDATE_COMPANY_ANALYSIS: 기업 분석 결과 업데이트
   */
  registerHandler('UPDATE_COMPANY_ANALYSIS', async (payload) => {
    const { companyId, analysis } = payload;

    const company = await getCompany(companyId);
    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    await updateCompany(companyId, {
      analysis: {
        ...analysis,
        analyzedAt: new Date().toISOString(),
      },
    });

    return {
      updatedAt: new Date().toISOString(),
    };
  });
}
