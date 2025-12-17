/**
 * 이미지 분류기 v3.0
 * Donut OCR + Qwen3 Text LLM으로 이미지 분류
 */

import { initDonut, isDonutReady, recognizeText } from './donut-engine';
import { initTextLLM, isTextLLMReady, generateText } from './text-llm-engine';
import {
  CLASSIFY_SYSTEM,
  buildClassifyPrompt,
  parseCategory,
} from '@/lib/prompts/text-analysis';
import { getFallbackCategory } from '@/lib/prompts';
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
    // Donut 엔진 준비 확인
    if (!isDonutReady()) {
      console.log('[Classifier] Donut 초기화 중...');
      await initDonut();
    }

    // Text LLM 엔진 준비 확인
    if (!isTextLLMReady()) {
      console.log('[Classifier] Text LLM 초기화 중...');
      await initTextLLM();
    }

    console.log('[Classifier] 이미지 분류 시작...', {
      blobSize: imageBlob.size,
      siteType,
    });

    // 1단계: Donut OCR로 텍스트 추출
    const rawText = await recognizeText(imageBlob);
    console.log('[Classifier] OCR 완료:', rawText.slice(0, 100) + '...');

    if (!rawText || rawText.length < 5) {
      console.warn('[Classifier] OCR 텍스트 부족, fallback 사용');
      return siteType ? getFallbackCategory(siteType) : 'unknown';
    }

    // 2단계: Text LLM으로 분류
    const classifyPrompt = buildClassifyPrompt(rawText);
    const response = await generateText(CLASSIFY_SYSTEM, classifyPrompt, 32);
    console.log('[Classifier] LLM 응답:', response);

    // 응답에서 카테고리 추출
    const category = parseCategory(response);
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
