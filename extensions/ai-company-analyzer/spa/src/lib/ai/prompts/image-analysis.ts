/**
 * 이미지 분석용 프롬프트 및 JSON Schema
 * Analysis.tsx에서 분리
 */
import { IMAGE_SUB_CATEGORIES, type ImageSubCategory } from '@shared/constants/categories';

// ============================================================================
// JSON Schema
// ============================================================================

/** 이미지 분석 결과 JSON Schema (Structured Output) */
export const IMAGE_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      enum: [...IMAGE_SUB_CATEGORIES],
    },
    summary: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    extractedText: { type: 'string' },
  },
  required: ['category', 'summary', 'keyPoints', 'sentiment', 'extractedText'],
} as const;

// ============================================================================
// 프롬프트
// ============================================================================

/** 통합 분석 프롬프트 템플릿 */
const UNIFIED_ANALYSIS_PROMPT_TEMPLATE = `{{COMPANY_NAME}} 회사 스크린샷을 분석하세요.

카테고리:
- revenue_trend: 매출/수익 추이 그래프
- balance_sheet: 재무상태표
- income_statement: 손익계산서
- employee_trend: 직원수/입퇴사 추이
- review_positive: 긍정적 리뷰
- review_negative: 부정적 리뷰
- company_overview: 회사 개요/소개
- unknown: 분류 불가

이미지에서 텍스트와 수치를 추출하고, 적절한 카테고리를 선택하세요.`;

/**
 * 이미지 분석 프롬프트 생성
 * @param companyName 회사명
 * @returns 프롬프트 문자열
 */
export function createImageAnalysisPrompt(companyName: string): string {
  return UNIFIED_ANALYSIS_PROMPT_TEMPLATE.replace('{{COMPANY_NAME}}', companyName || '');
}

// ============================================================================
// 유효성 검증
// ============================================================================

/** 유효한 카테고리 목록 (배열) */
export const VALID_CATEGORIES: readonly ImageSubCategory[] = IMAGE_SUB_CATEGORIES;

/** 이미지 분석 결과 타입 */
export interface ParsedAnalysisResult {
  category: ImageSubCategory;
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  extractedText: string;
}

/**
 * 분석 결과 JSON 파싱 및 유효성 검증
 * @param rawJson JSON 문자열
 * @returns 파싱된 결과 또는 null
 */
export function parseAnalysisResult(rawJson: string): ParsedAnalysisResult | null {
  try {
    const parsed = JSON.parse(rawJson);

    // 카테고리 유효성 검증
    const category: ImageSubCategory = VALID_CATEGORIES.includes(parsed?.category)
      ? parsed.category
      : 'unknown';

    // sentiment 유효성 검증
    const validSentiments = ['positive', 'neutral', 'negative'] as const;
    const sentiment = validSentiments.includes(parsed?.sentiment)
      ? parsed.sentiment
      : 'neutral';

    return {
      category,
      summary: parsed?.summary || '',
      keyPoints: Array.isArray(parsed?.keyPoints) ? parsed.keyPoints : [],
      sentiment,
      extractedText: parsed?.extractedText || '',
    };
  } catch {
    return null;
  }
}
