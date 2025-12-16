/**
 * 컨텍스트 기반 분석 프롬프트 생성
 * 추출된 텍스트의 metadata(summary, keyPoints)를 LLM 프롬프트에 통합
 */

import { getExtractedTextsByCompany } from '@/lib/storage';
import type { ExtractedNumber, ImageSubCategory, ExtractedText } from '@/types/storage';

export interface RAGContext {
  financialContext: string;
  reviewContext: string;
  companyContext: string;
  relevantNumbers: ExtractedNumber[];
  categoryCounts: Record<string, number>;
}

export interface RAGAnalysisResult {
  overallScore: number;
  financialHealth: {
    score: number;
    summary: string;
    strengths: string[];
    concerns: string[];
  };
  employeeSentiment: {
    score: number;
    summary: string;
    positives: string[];
    negatives: string[];
  };
  recommendation: string;
}

// 카테고리 그룹 정의
const FINANCIAL_CATEGORIES: ImageSubCategory[] = [
  'balance_sheet',
  'income_statement',
  'cash_flow',
  'financial_ratio',
  'revenue_trend',
  'employee_trend',
];

const REVIEW_CATEGORIES: ImageSubCategory[] = [
  'review_positive',
  'review_negative',
  'review_mixed',
  'rating_summary',
];

const COMPANY_CATEGORIES: ImageSubCategory[] = [
  'company_overview',
  'team_info',
  'benefits_info',
  'tech_stack',
];

/**
 * 카테고리별로 텍스트 필터링
 */
function filterByCategories(
  texts: ExtractedText[],
  categories: ImageSubCategory[]
): ExtractedText[] {
  const categorySet = new Set(categories);
  return texts.filter(t => categorySet.has(t.category as ImageSubCategory));
}

/**
 * 텍스트 데이터를 컨텍스트 문자열로 변환 (metadata 사용)
 */
function buildContextFromTexts(texts: ExtractedText[]): string {
  if (texts.length === 0) return '';

  return texts
    .map(t => {
      const parts: string[] = [`[${formatCategory(t.category as ImageSubCategory)}]`];

      // summary 추가
      if (t.metadata?.summary) {
        parts.push(t.metadata.summary);
      }

      // keyPoints 추가
      if (t.metadata?.keyPoints && t.metadata.keyPoints.length > 0) {
        parts.push('핵심 포인트:');
        t.metadata.keyPoints.forEach(point => {
          parts.push(`- ${point}`);
        });
      }

      return parts.join('\n');
    })
    .join('\n\n');
}

/**
 * 회사 분석용 컨텍스트 수집
 */
export async function gatherAnalysisContext(companyId: string): Promise<RAGContext> {
  // 회사의 모든 추출 텍스트 조회
  const allTexts = await getExtractedTextsByCompany(companyId);

  // 카테고리별 필터링
  const financialTexts = filterByCategories(allTexts, FINANCIAL_CATEGORIES);
  const reviewTexts = filterByCategories(allTexts, REVIEW_CATEGORIES);
  const companyTexts = filterByCategories(allTexts, COMPANY_CATEGORIES);

  // 컨텍스트 텍스트 구성
  const financialContext = buildContextFromTexts(financialTexts);
  const reviewContext = buildContextFromTexts(reviewTexts);
  const companyContext = buildContextFromTexts(companyTexts);

  // 숫자 데이터 수집
  const relevantNumbers: ExtractedNumber[] = [];
  for (const text of [...financialTexts, ...reviewTexts]) {
    if (text.metadata?.numbers) {
      relevantNumbers.push(...text.metadata.numbers);
    }
  }

  // 카테고리별 데이터 수 집계
  const categoryCounts: Record<string, number> = {};
  for (const text of allTexts) {
    categoryCounts[text.category] = (categoryCounts[text.category] || 0) + 1;
  }

  return {
    financialContext,
    reviewContext,
    companyContext,
    relevantNumbers,
    categoryCounts,
  };
}

/**
 * 종합 분석 프롬프트 생성
 */
export function buildRAGAnalysisPrompt(context: RAGContext): string {
  const numbersSection = context.relevantNumbers.length > 0
    ? context.relevantNumbers
        .slice(0, 15) // 최대 15개
        .map(n => `- ${n.label}: ${n.value}${n.unit}${n.year ? ` (${n.year}년)` : ''}`)
        .join('\n')
    : '(숫자 데이터 없음)';

  return `Based on the following extracted information, provide a comprehensive company analysis.

## Financial Information
${context.financialContext || '(재무 데이터 없음)'}

## Key Financial Numbers
${numbersSection}

## Employee Reviews
${context.reviewContext || '(직원 리뷰 데이터 없음)'}

## Company Information
${context.companyContext || '(회사 정보 없음)'}

---

Analyze the company's financial health and employee sentiment.
Consider both quantitative metrics and qualitative feedback.

Provide your analysis in JSON format (ONLY JSON, no markdown):
{
  "overallScore": 1-5,
  "financialHealth": {
    "score": 1-5,
    "summary": "재무 건전성 요약 (한국어, 2-3문장)",
    "strengths": ["재무적 강점1", "강점2"],
    "concerns": ["우려점1", "우려점2"]
  },
  "employeeSentiment": {
    "score": 1-5,
    "summary": "직원 평가 요약 (한국어, 2-3문장)",
    "positives": ["장점1", "장점2"],
    "negatives": ["단점1", "단점2"]
  },
  "recommendation": "투자/취업 추천 여부와 이유 (한국어, 3-4문장)"
}

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code blocks.`;
}

/**
 * 커스텀 질문 분석 프롬프트 생성
 */
export async function buildCustomQueryPrompt(
  companyId: string,
  userQuery: string
): Promise<string> {
  // 회사의 모든 추출 텍스트 조회
  const allTexts = await getExtractedTextsByCompany(companyId);

  // 모든 텍스트의 metadata 기반 컨텍스트 생성
  const contextText = buildContextFromTexts(allTexts);

  return `Based on the following extracted information about the company, answer the user's question.

## Relevant Information
${contextText || '(관련 정보 없음)'}

## User Question
${userQuery}

---

Answer the question in Korean based on the provided information.
If the information is insufficient, clearly state what's missing.
Be specific and cite relevant data points when possible.

Provide a clear, concise answer.`;
}

/**
 * 카테고리 한글 표시
 */
function formatCategory(category: ImageSubCategory): string {
  const categoryNames: Record<ImageSubCategory, string> = {
    balance_sheet: '대차대조표',
    income_statement: '손익계산서',
    cash_flow: '현금흐름표',
    financial_ratio: '재무비율',
    revenue_trend: '매출추이',
    employee_trend: '고용추이',
    review_positive: '긍정리뷰',
    review_negative: '부정리뷰',
    review_mixed: '복합리뷰',
    rating_summary: '평점요약',
    bar_chart: '막대차트',
    line_chart: '라인차트',
    pie_chart: '원형차트',
    table_data: '표데이터',
    company_overview: '회사개요',
    team_info: '팀정보',
    benefits_info: '복지정보',
    tech_stack: '기술스택',
    unknown: '미분류',
    pending: '대기중',
  };

  return categoryNames[category] || category;
}

/**
 * 컨텍스트 가용성 체크
 */
export async function checkContextAvailability(companyId: string): Promise<{
  hasFinancial: boolean;
  hasReview: boolean;
  hasCompany: boolean;
  totalDocuments: number;
}> {
  const texts = await getExtractedTextsByCompany(companyId);

  const financialCategorySet = new Set(FINANCIAL_CATEGORIES);
  const reviewCategorySet = new Set(REVIEW_CATEGORIES);
  const companyCategorySet = new Set(COMPANY_CATEGORIES);

  return {
    hasFinancial: texts.some(t => financialCategorySet.has(t.category as ImageSubCategory)),
    hasReview: texts.some(t => reviewCategorySet.has(t.category as ImageSubCategory)),
    hasCompany: texts.some(t => companyCategorySet.has(t.category as ImageSubCategory)),
    totalDocuments: texts.length,
  };
}
