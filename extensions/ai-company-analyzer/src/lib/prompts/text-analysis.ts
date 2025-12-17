/**
 * 텍스트 분류 및 분석 프롬프트 (v1.0)
 *
 * Qwen3 텍스트 LM에서 사용하는 프롬프트
 * VLM OCR 결과를 받아서 분류하고 분석
 */

import type { ImageSubCategory } from '@/types/storage';

// ============================================
// 분류 프롬프트
// ============================================

/**
 * 분류 시스템 프롬프트
 * Qwen3의 thinking mode를 비활성화하기 위해 /no_think 지시 포함
 */
export const CLASSIFY_SYSTEM = `You are a document classifier for Korean company data.
Classify the text into exactly one category.
Reply with ONLY the category name, nothing else.
Do not explain or add any other text.
/no_think`;

/**
 * 유효한 분류 카테고리
 * storage.ts의 ImageSubCategory와 일치해야 함
 */
export const VALID_CATEGORIES = [
  // 재무 관련
  'balance_sheet',      // 대차대조표 (자산, 부채, 자본)
  'income_statement',   // 손익계산서 (매출, 비용, 이익)
  'cash_flow',          // 현금흐름표
  'financial_ratio',    // 재무비율 (ROE, ROA, 부채비율)
  'revenue_trend',      // 매출추이 (연도별 매출액)
  'employee_trend',     // 고용추이 (연도별 직원수)
  // 리뷰 관련
  'review_positive',    // 긍정 리뷰
  'review_negative',    // 부정 리뷰
  'review_mixed',       // 복합 리뷰
  'rating_summary',     // 평점 요약
  // 그래프/차트
  'bar_chart',          // 막대그래프
  'line_chart',         // 라인차트
  'pie_chart',          // 원형차트
  'table_data',         // 표 데이터
  // 회사정보
  'company_overview',   // 기업 개요 (회사 소개, 사업 영역)
  'team_info',          // 팀 구성
  'benefits_info',      // 복지 정보
  'tech_stack',         // 기술스택
  // 기타
  'unknown',            // 분류 불가
] as const;

/**
 * 분류 프롬프트 생성
 */
export function buildClassifyPrompt(text: string): string {
  // 텍스트가 너무 길면 잘라내기 (토큰 제한)
  const truncatedText = text.length > 2000 ? text.slice(0, 2000) + '...' : text;

  return `Classify this Korean company document text:

${truncatedText}

Categories:
- balance_sheet: 대차대조표 (자산, 부채, 자본)
- income_statement: 손익계산서 (매출, 비용, 이익)
- cash_flow: 현금흐름표
- financial_ratio: 재무비율 (ROE, ROA, 부채비율 등)
- revenue_trend: 매출추이 (연도별 매출)
- employee_trend: 고용추이 (연도별 직원수)
- review_positive: 긍정적인 회사 리뷰
- review_negative: 부정적인 회사 리뷰
- review_mixed: 긍정/부정 혼합 리뷰
- rating_summary: 평점 요약
- company_overview: 기업 개요
- team_info: 팀 구성
- benefits_info: 복지 정보
- tech_stack: 기술스택
- table_data: 표 데이터
- unknown: 분류 불가

Category:`;
}

/**
 * 분류 결과 파싱
 * Qwen3 thinking mode의 <think> 태그를 제거하고 파싱
 */
export function parseCategory(response: string): ImageSubCategory {
  // 1. Qwen3 thinking mode 태그 제거 (완전한 태그)
  let cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // 2. 불완전한 <think> 태그도 제거 (닫히지 않은 경우)
  cleaned = cleaned.replace(/<think>[\s\S]*/g, '').trim();

  // 3. 소문자 변환 및 공백 제거
  cleaned = cleaned.toLowerCase().trim();

  // 4. 정확히 일치하는 카테고리 찾기
  for (const category of VALID_CATEGORIES) {
    if (cleaned === category || cleaned.startsWith(category)) {
      return category as ImageSubCategory;
    }
  }

  // 5. 부분 매칭 시도 (카테고리가 응답에 포함된 경우)
  for (const category of VALID_CATEGORIES) {
    if (cleaned.includes(category)) {
      return category as ImageSubCategory;
    }
  }

  // 매칭되지 않으면 unknown
  console.warn('[TextAnalysis] 분류 실패, unknown 반환:', response.slice(0, 100));
  return 'unknown';
}

// ============================================
// 분석 프롬프트
// ============================================

/**
 * 분석 시스템 프롬프트
 * Qwen3의 thinking mode를 비활성화하기 위해 /no_think 지시 포함
 */
export const ANALYZE_SYSTEM = `You are a Korean company data analyst.
Summarize the key information concisely in Korean.
Focus on important numbers, trends, and insights.
Keep your response under 200 characters.
/no_think`;

/**
 * 카테고리별 분석 힌트
 */
const ANALYSIS_HINTS: Partial<Record<ImageSubCategory, string>> = {
  balance_sheet: '자산, 부채, 자본의 규모와 구성 비율을 요약하세요.',
  income_statement: '매출액, 영업이익, 순이익과 수익성을 요약하세요.',
  cash_flow: '영업활동, 투자활동, 재무활동 현금흐름을 요약하세요.',
  financial_ratio: '주요 재무비율(ROE, ROA, 부채비율 등)을 요약하세요.',
  revenue_trend: '매출 추이와 성장률을 요약하세요.',
  employee_trend: '직원수 변화와 고용 추이를 요약하세요.',
  review_positive: '긍정적인 요소들을 요약하세요.',
  review_negative: '우려되는 요소들을 요약하세요.',
  review_mixed: '장단점을 균형있게 요약하세요.',
  rating_summary: '평점과 평가 항목별 점수를 요약하세요.',
  company_overview: '회사 개요와 사업 영역을 요약하세요.',
  team_info: '팀 규모와 구성을 요약하세요.',
  benefits_info: '주요 복지 항목들을 요약하세요.',
  tech_stack: '사용 기술들을 요약하세요.',
};

/**
 * 분석 프롬프트 생성
 */
export function buildAnalyzePrompt(
  text: string,
  category: ImageSubCategory
): string {
  // 텍스트가 너무 길면 잘라내기
  const truncatedText = text.length > 1500 ? text.slice(0, 1500) + '...' : text;

  const hint = ANALYSIS_HINTS[category] || '핵심 정보를 요약하세요.';

  return `카테고리: ${category}
분석 지침: ${hint}

텍스트:
${truncatedText}

요약 (한국어, 200자 이내):`;
}

// ============================================
// 핵심 포인트 추출
// ============================================

/**
 * 핵심 포인트 추출 시스템 프롬프트
 */
export const KEYPOINTS_SYSTEM = `You are a data extractor.
Extract 3-5 key data points from the text.
Each point should be a short phrase with a number if available.
Reply in Korean. One point per line. No bullet points or numbering.`;

/**
 * 핵심 포인트 추출 프롬프트
 */
export function buildKeyPointsPrompt(text: string): string {
  const truncatedText = text.length > 1000 ? text.slice(0, 1000) + '...' : text;

  return `텍스트:
${truncatedText}

핵심 포인트 (3-5개):`;
}

/**
 * 핵심 포인트 응답 파싱
 */
export function parseKeyPoints(response: string): string[] {
  return response
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.length < 100)
    .slice(0, 5);
}

// ============================================
// Qwen3 Thinking Mode 유틸리티
// ============================================

/**
 * Qwen3 응답에서 <think> 태그 제거
 *
 * Qwen3 0.6B 모델은 /no_think가 시스템 프롬프트에서 작동하지 않음
 * https://github.com/QwenLM/Qwen3/discussions/1329
 */
export function removeThinkingTags(response: string): string {
  // 1. 완전한 <think>...</think> 태그 제거
  let cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // 2. 불완전한 <think> 태그 제거 (닫히지 않은 경우)
  cleaned = cleaned.replace(/<think>[\s\S]*/g, '').trim();

  return cleaned;
}
