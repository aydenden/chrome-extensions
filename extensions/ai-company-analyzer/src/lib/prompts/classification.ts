/**
 * 이미지 분류 프롬프트
 * AI가 이미지 종류를 판단하기 위한 프롬프트 정의
 */

import type { DataType, ImageSubCategory } from '@/types/storage';

// 유효한 카테고리 목록
export const VALID_CATEGORIES: ImageSubCategory[] = [
  'balance_sheet',
  'income_statement',
  'cash_flow',
  'financial_ratio',
  'revenue_trend',
  'employee_trend',
  'review_positive',
  'review_negative',
  'review_mixed',
  'rating_summary',
  'bar_chart',
  'line_chart',
  'pie_chart',
  'table_data',
  'company_overview',
  'team_info',
  'benefits_info',
  'tech_stack',
  'unknown',
];

// 기본 분류 프롬프트 (간소화 - 토큰 절약)
// 핵심 카테고리만 나열, 설명 최소화
export const CLASSIFICATION_PROMPT = `What type of image is this? Reply with ONE word only.

Categories:
- company_overview (회사정보)
- revenue_trend (매출추이)
- employee_trend (인원추이)
- balance_sheet (재무제표)
- review_positive (긍정리뷰)
- review_negative (부정리뷰)
- review_mixed (복합리뷰)
- rating_summary (평점)
- bar_chart (막대그래프)
- line_chart (라인차트)
- table_data (표)
- unknown

Answer:`;

// 사이트별 힌트 (간소화)
const SITE_HINTS: Record<DataType, string> = {
  company_info: 'Hint: company_overview, table_data',
  finance_inno: 'Hint: revenue_trend, employee_trend, bar_chart',
  finance_dart: 'Hint: balance_sheet, table_data',
  finance_smes: 'Hint: balance_sheet, table_data',
  review_blind: 'Hint: review_positive, review_negative, review_mixed',
  review_jobplanet: 'Hint: review_positive, review_negative, review_mixed',
};

// 사이트 힌트를 포함한 분류 프롬프트 생성
export function getClassificationPromptWithHint(siteType: DataType): string {
  const hint = SITE_HINTS[siteType];
  if (hint) {
    return `Context: ${hint}\n\n${CLASSIFICATION_PROMPT}`;
  }
  return CLASSIFICATION_PROMPT;
}

// 사이트 기반 기본 카테고리 (fallback용)
export const SITE_DEFAULT_CATEGORIES: Record<DataType, ImageSubCategory> = {
  company_info: 'company_overview',
  finance_inno: 'revenue_trend',
  finance_dart: 'income_statement',
  finance_smes: 'balance_sheet',
  review_blind: 'review_mixed',
  review_jobplanet: 'review_mixed',
};

// fallback 카테고리 조회
export function getFallbackCategory(siteType: DataType): ImageSubCategory {
  return SITE_DEFAULT_CATEGORIES[siteType] || 'unknown';
}

// 카테고리 유효성 검증
export function isValidCategory(category: string): category is ImageSubCategory {
  return VALID_CATEGORIES.includes(category as ImageSubCategory);
}

// 리뷰 사이트 목록 (rev 충돌 해결용)
const REVIEW_SITES: DataType[] = ['review_blind', 'review_jobplanet'];

// 응답에서 카테고리 추출 (함수형 스타일)
export function extractCategoryFromResponse(
  response: string,
  siteType?: DataType
): ImageSubCategory {
  const cleaned = response.trim().toLowerCase();

  // 정확히 일치 또는 카테고리 ID 포함 (긴 것 우선)
  const sorted = [...VALID_CATEGORIES].sort((a, b) => b.length - a.length);
  const exactOrContains = sorted.find(c => cleaned === c || cleaned.includes(c));
  if (exactOrContains) return exactOrContains;

  // 접두사 매칭 (앞 4글자)
  const prefixMatch = sorted.find(c => cleaned.includes(c.slice(0, 4)));
  if (prefixMatch) {
    // "rev" 충돌: review vs revenue → 사이트로 구분
    const isRevConflict = prefixMatch.startsWith('rev');
    if (isRevConflict) {
      return siteType && REVIEW_SITES.includes(siteType)
        ? 'review_mixed'
        : (siteType ? getFallbackCategory(siteType) : 'unknown');
    }
    return prefixMatch;
  }

  return siteType ? getFallbackCategory(siteType) : 'unknown';
}
