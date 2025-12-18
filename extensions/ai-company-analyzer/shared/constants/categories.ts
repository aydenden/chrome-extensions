export const DATA_TYPES = [
  'WANTED',
  'JOBPLANET',
  'SARAMIN',
  'INNOFOREST',
  'DART',
  'SMES',
  'BLIND',
  'OTHER',
] as const;

export type DataType = (typeof DATA_TYPES)[number];

export const IMAGE_SUB_CATEGORIES = [
  'revenue_trend',
  'balance_sheet',
  'income_statement',
  'employee_trend',
  'review_positive',
  'review_negative',
  'company_overview',
  'unknown',
] as const;

export type ImageSubCategory = (typeof IMAGE_SUB_CATEGORIES)[number];

/** 카테고리 한글 매핑 */
export const CATEGORY_LABELS: Record<ImageSubCategory, string> = {
  revenue_trend: '매출 추이',
  balance_sheet: '재무상태표',
  income_statement: '손익계산서',
  employee_trend: '직원 추이',
  review_positive: '긍정 리뷰',
  review_negative: '부정 리뷰',
  company_overview: '회사 개요',
  unknown: '미분류',
};

/** 데이터 소스 컬러 */
export const SOURCE_COLORS: Record<DataType, string> = {
  WANTED: '#2563EB',
  JOBPLANET: '#0D9488',
  SARAMIN: '#7C3AED',
  INNOFOREST: '#047857',
  DART: '#1E293B',
  SMES: '#C2410C',
  BLIND: '#CA8A04',
  OTHER: '#6B7280',
};
