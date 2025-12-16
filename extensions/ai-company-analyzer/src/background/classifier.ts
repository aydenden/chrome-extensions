/**
 * 이미지 분류기
 * AI를 사용하여 이미지 종류를 자동 분류
 */

import { analyzeImage, isEngineReady, initEngine } from './smolvlm-engine';
import {
  getClassificationPromptWithHint,
  extractCategoryFromResponse,
  getFallbackCategory,
} from '@/lib/prompts';
import type { DataType, ImageSubCategory } from '@/types/storage';

/**
 * 이미지 분류 수행
 * @param imageBlob 분류할 이미지 Blob
 * @param siteType 사이트 타입 (힌트로 사용)
 * @returns 분류된 카테고리
 */
export async function classifyImage(
  imageBlob: Blob,
  siteType?: DataType
): Promise<ImageSubCategory> {
  try {
    // 엔진 준비 확인
    if (!isEngineReady()) {
      console.log('[Classifier] 엔진 초기화 중...');
      await initEngine();
    }

    // 사이트 힌트를 포함한 프롬프트 생성
    const prompt = siteType
      ? getClassificationPromptWithHint(siteType)
      : getClassificationPromptWithHint('company_info'); // 기본값

    console.log('[Classifier] 이미지 분류 시작...', {
      blobSize: imageBlob.size,
      siteType,
    });

    // AI로 분류 수행
    const response = await analyzeImage(imageBlob, prompt);
    console.log('[Classifier] AI 응답:', response);

    // 응답에서 카테고리 추출 (siteType으로 부분 매칭 개선)
    const category = extractCategoryFromResponse(response, siteType);
    console.log('[Classifier] 추출된 카테고리:', category);

    return category;
  } catch (error) {
    console.error('[Classifier] 분류 실패:', error);

    // fallback: 사이트 기반 기본 카테고리
    if (siteType) {
      const fallback = getFallbackCategory(siteType);
      console.log('[Classifier] Fallback 카테고리 사용:', fallback);
      return fallback;
    }

    return 'unknown';
  }
}
