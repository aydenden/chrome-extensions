/**
 * RAG 기반 분석 프롬프트 생성
 * 검색된 컨텍스트를 LLM 프롬프트에 통합
 */

import { searchByGroup, searchByCompany } from '@/lib/vector-search';
import { getExtractedText, getExtractedTextsByCompany } from '@/lib/storage';
import type { ExtractedNumber, ImageSubCategory } from '@/types/storage';

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

/**
 * 회사 분석용 컨텍스트 수집
 */
export async function gatherAnalysisContext(companyId: string): Promise<RAGContext> {
  // 병렬로 각 그룹 검색
  const [financialResults, reviewResults, companyResults] = await Promise.all([
    searchByGroup(companyId, '매출 영업이익 재무상태 현금흐름 자산 부채', 'financial', {
      topK: 5,
      minSimilarity: 0.2,
    }),
    searchByGroup(companyId, '워라밸 급여 문화 성장 장점 단점 직원 리뷰', 'review', {
      topK: 5,
      minSimilarity: 0.2,
    }),
    searchByGroup(companyId, '회사 개요 팀 구성 복지 기술스택', 'company', {
      topK: 3,
      minSimilarity: 0.2,
    }),
  ]);

  // 컨텍스트 텍스트 구성
  const financialContext = financialResults
    .map(r => `[${formatCategory(r.category)}] ${r.chunkText}`)
    .join('\n\n');

  const reviewContext = reviewResults
    .map(r => `[${formatCategory(r.category)}] ${r.chunkText}`)
    .join('\n\n');

  const companyContext = companyResults
    .map(r => `[${formatCategory(r.category)}] ${r.chunkText}`)
    .join('\n\n');

  // 숫자 데이터 수집
  const allTextIds = new Set([
    ...financialResults.map(r => r.extractedDataId),
    ...reviewResults.map(r => r.extractedDataId),
  ]);

  const relevantNumbers: ExtractedNumber[] = [];
  for (const textId of allTextIds) {
    const textData = await getExtractedText(textId);
    if (textData?.metadata?.numbers) {
      relevantNumbers.push(...textData.metadata.numbers);
    }
  }

  // 카테고리별 데이터 수 집계
  const allTexts = await getExtractedTextsByCompany(companyId);
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
  // 쿼리 기반 검색
  const searchResults = await searchByCompany(companyId, userQuery, {
    topK: 8,
    minSimilarity: 0.25,
  });

  const contextText = searchResults
    .map(r => `[${formatCategory(r.category)}] ${r.chunkText}`)
    .join('\n\n');

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
 * 재무 전용 분석 프롬프트
 */
export async function buildFinancialAnalysisPrompt(companyId: string): Promise<string> {
  const results = await searchByGroup(
    companyId,
    '매출 영업이익 순이익 자산 부채 자본 현금흐름 성장률',
    'financial',
    { topK: 10, minSimilarity: 0.2 }
  );

  const contextText = results
    .map(r => `[${formatCategory(r.category)}] ${r.chunkText}`)
    .join('\n\n');

  // 숫자 데이터 수집
  const numbers: ExtractedNumber[] = [];
  for (const result of results) {
    const textData = await getExtractedText(result.extractedDataId);
    if (textData?.metadata?.numbers) {
      numbers.push(...textData.metadata.numbers);
    }
  }

  const numbersSection = numbers.length > 0
    ? numbers
        .slice(0, 20)
        .map(n => `- ${n.label}: ${n.value}${n.unit}${n.year ? ` (${n.year}년)` : ''}`)
        .join('\n')
    : '(숫자 데이터 없음)';

  return `Analyze the company's financial health based on the following data.

## Financial Documents
${contextText || '(재무 데이터 없음)'}

## Key Numbers
${numbersSection}

---

Provide a detailed financial analysis in JSON format:
{
  "score": 1-5,
  "profitability": {
    "score": 1-5,
    "analysis": "수익성 분석 (한국어)"
  },
  "stability": {
    "score": 1-5,
    "analysis": "재무안정성 분석 (한국어)"
  },
  "growth": {
    "score": 1-5,
    "analysis": "성장성 분석 (한국어)"
  },
  "cashflow": {
    "score": 1-5,
    "analysis": "현금흐름 분석 (한국어)"
  },
  "risks": ["위험요소1", "위험요소2"],
  "strengths": ["강점1", "강점2"],
  "summary": "종합 재무 평가 (한국어, 3-4문장)"
}

IMPORTANT: Respond ONLY with valid JSON.`;
}

/**
 * 리뷰 전용 분석 프롬프트
 */
export async function buildReviewAnalysisPrompt(companyId: string): Promise<string> {
  const results = await searchByGroup(
    companyId,
    '워라밸 급여 복지 문화 경영진 성장 장점 단점',
    'review',
    { topK: 10, minSimilarity: 0.2 }
  );

  const contextText = results
    .map(r => `[${formatCategory(r.category)}] ${r.chunkText}`)
    .join('\n\n');

  return `Analyze employee reviews and sentiment based on the following data.

## Employee Reviews
${contextText || '(직원 리뷰 데이터 없음)'}

---

Provide a detailed review analysis in JSON format:
{
  "score": 1-5,
  "workLifeBalance": {
    "score": 1-5,
    "analysis": "워라밸 분석 (한국어)"
  },
  "compensation": {
    "score": 1-5,
    "analysis": "급여/복지 분석 (한국어)"
  },
  "culture": {
    "score": 1-5,
    "analysis": "조직문화 분석 (한국어)"
  },
  "growth": {
    "score": 1-5,
    "analysis": "성장기회 분석 (한국어)"
  },
  "management": {
    "score": 1-5,
    "analysis": "경영진 평가 (한국어)"
  },
  "positives": ["장점1", "장점2"],
  "negatives": ["단점1", "단점2"],
  "summary": "종합 직원 평가 (한국어, 3-4문장)"
}

IMPORTANT: Respond ONLY with valid JSON.`;
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

  const financialCategories = new Set([
    'balance_sheet',
    'income_statement',
    'cash_flow',
    'financial_ratio',
    'revenue_trend',
    'employee_trend',
  ]);

  const reviewCategories = new Set([
    'review_positive',
    'review_negative',
    'review_mixed',
    'rating_summary',
  ]);

  const companyCategories = new Set([
    'company_overview',
    'team_info',
    'benefits_info',
    'tech_stack',
  ]);

  return {
    hasFinancial: texts.some(t => financialCategories.has(t.category)),
    hasReview: texts.some(t => reviewCategories.has(t.category)),
    hasCompany: texts.some(t => companyCategories.has(t.category)),
    totalDocuments: texts.length,
  };
}
