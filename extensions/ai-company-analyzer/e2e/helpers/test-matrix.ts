/**
 * AI 분류 및 점수 테스트 매트릭스
 *
 * Fixture별 예상 카테고리와 점수 범위 정의
 */

import type { DataType, ImageSubCategory } from '../../src/types/storage';

export interface TestCase {
  /** Fixture 파일명 */
  fixture: string;
  /** 데이터 타입 (사이트 기반) */
  dataType: DataType;
  /** 허용되는 카테고리 목록 (AI 변동성 고려) */
  expectedCategories: ImageSubCategory[];
  /** 예상 점수 범위 [min, max] (1-5 스케일) */
  scoreRange: [number, number];
  /** 테스트 설명 */
  description: string;
}

/**
 * AI 테스트 매트릭스
 *
 * 각 fixture에 대한 예상 결과 정의
 */
export const AI_TEST_MATRIX: TestCase[] = [
  // ============ Company Info (기업 정보) ============
  {
    fixture: 'company-info-small.png',
    dataType: 'company_info',
    expectedCategories: ['company_overview', 'table_data'],
    scoreRange: [2, 4],
    description: '소규모 기업 (8명, 3억) - 중립~약간 부정',
  },
  {
    fixture: 'company-info-medium.png',
    dataType: 'company_info',
    expectedCategories: ['company_overview', 'table_data'],
    scoreRange: [3, 4],
    description: '중규모 기업 (52명, 45억) - 중립~긍정',
  },
  {
    fixture: 'company-info-large.png',
    dataType: 'company_info',
    expectedCategories: ['company_overview', 'table_data'],
    scoreRange: [4, 5],
    description: '대규모 기업 (185명, 320억) - 긍정',
  },

  // ============ Employment (고용 현황) ============
  {
    fixture: 'employment-growing.png',
    dataType: 'finance_inno',
    expectedCategories: ['employee_trend', 'bar_chart', 'line_chart'],
    scoreRange: [4, 5],
    description: '고용 증가 (+28.5%) - 긍정',
  },
  {
    fixture: 'employment-stable.png',
    dataType: 'finance_inno',
    expectedCategories: ['employee_trend', 'bar_chart', 'line_chart'],
    scoreRange: [2, 4],
    description: '고용 안정 (+2.9%) - 중립',
  },
  {
    fixture: 'employment-shrinking.png',
    dataType: 'finance_inno',
    expectedCategories: ['employee_trend', 'bar_chart', 'line_chart'],
    scoreRange: [1, 3],
    description: '고용 감소 (-35.7%) - 부정',
  },

  // ============ Finance (재무 정보) ============
  {
    fixture: 'finance-good.png',
    dataType: 'finance_inno',
    expectedCategories: ['revenue_trend', 'bar_chart', 'income_statement', 'financial_ratio'],
    scoreRange: [4, 5],
    description: '재무 양호 (매출 180% 성장, 흑자) - 긍정',
  },
  {
    fixture: 'finance-average.png',
    dataType: 'finance_inno',
    expectedCategories: ['revenue_trend', 'bar_chart', 'income_statement', 'financial_ratio'],
    scoreRange: [2, 4],
    description: '재무 보통 (횡보, 손익분기) - 중립',
  },
  {
    fixture: 'finance-bad.png',
    dataType: 'finance_inno',
    expectedCategories: ['revenue_trend', 'bar_chart', 'income_statement', 'financial_ratio'],
    scoreRange: [1, 2],
    description: '재무 불량 (매출 감소, 적자, 자본잠식) - 부정',
  },

  // ============ Review (리뷰) ============
  {
    fixture: 'review-positive.png',
    dataType: 'review_jobplanet',
    expectedCategories: ['review_positive', 'review_mixed', 'rating_summary'],
    scoreRange: [4, 5],
    description: '긍정 리뷰 (4.5점, 추천) - 긍정',
  },
  {
    fixture: 'review-neutral.png',
    dataType: 'review_jobplanet',
    expectedCategories: ['review_mixed', 'rating_summary'],
    scoreRange: [2, 4],
    description: '중립 리뷰 (3.0점, 보류) - 중립',
  },
  {
    fixture: 'review-negative.png',
    dataType: 'review_jobplanet',
    expectedCategories: ['review_negative', 'review_mixed', 'rating_summary'],
    scoreRange: [1, 2],
    description: '부정 리뷰 (1.5점, 비추천) - 부정',
  },
];

/**
 * 카테고리별 테스트 케이스 필터링
 */
export function getTestCasesByCategory(
  category: 'company' | 'employment' | 'finance' | 'review'
): TestCase[] {
  const prefixMap = {
    company: 'company-info',
    employment: 'employment',
    finance: 'finance',
    review: 'review',
  };

  const prefix = prefixMap[category];
  return AI_TEST_MATRIX.filter((tc) => tc.fixture.startsWith(prefix));
}
