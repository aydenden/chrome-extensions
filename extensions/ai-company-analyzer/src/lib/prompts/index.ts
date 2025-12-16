/**
 * 프롬프트 모듈 통합 export
 */

// 분류 프롬프트
export {
  CLASSIFICATION_PROMPT,
  VALID_CATEGORIES,
  SITE_DEFAULT_CATEGORIES,
  getClassificationPromptWithHint,
  getFallbackCategory,
  isValidCategory,
  extractCategoryFromResponse,
} from './classification';

// 분석 프롬프트
export {
  ANALYSIS_PROMPTS,
  getAnalysisPrompt,
  buildAnalysisPrompt,
} from './analysis';

export type { AnalysisPrompt } from './analysis';
