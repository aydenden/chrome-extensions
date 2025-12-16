/**
 * 카테고리별 분석 프롬프트
 * 분류된 이미지를 상세 분석하기 위한 프롬프트 정의
 *
 * Qwen2-VL 토큰 효율을 위해 간소화된 출력 형식 사용
 * JSON 대신 단순 텍스트 포맷으로 파싱 안정성 향상
 */

import type { ImageSubCategory } from '@/types/storage';

export interface AnalysisPrompt {
  systemPrompt: string;
  outputFormat: string;
}

// 단순화된 출력 형식 (토큰 절약 + 파싱 안정)
// JSON 대신 SCORE|SUMMARY|POINTS 형식
const SIMPLE_OUTPUT_FORMAT = `Reply format:
SCORE: [1-5]
SUMMARY: [one sentence]
POINTS: [point1] | [point2] | [point3]`;

// 카테고리별 분석 프롬프트 (간소화)
export const ANALYSIS_PROMPTS: Record<ImageSubCategory, AnalysisPrompt> = {
  // 재무
  balance_sheet: {
    systemPrompt: 'Analyze: assets, liabilities, debt ratio. Good or bad?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  income_statement: {
    systemPrompt: 'Analyze: revenue, profit, margins. Growing or declining?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  cash_flow: {
    systemPrompt: 'Analyze: cash flow, burn rate. Healthy or concerning?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  financial_ratio: {
    systemPrompt: 'Extract key ratios. Good or bad performance?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  revenue_trend: {
    systemPrompt: 'Trend direction? Growing, declining, or stable?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  employee_trend: {
    systemPrompt: 'Employee count trend? Growing, shrinking, or stable?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },

  // 리뷰
  review_positive: {
    systemPrompt: 'What do employees like? Key positives?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  review_negative: {
    systemPrompt: 'What are the concerns? Key negatives?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  review_mixed: {
    systemPrompt: 'Pros and cons? Overall positive or negative?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  rating_summary: {
    systemPrompt: 'Extract rating scores. Overall rating?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },

  // 차트
  bar_chart: {
    systemPrompt: 'What does this chart show? Key insight?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  line_chart: {
    systemPrompt: 'Trend direction? Increasing, decreasing, or stable?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  pie_chart: {
    systemPrompt: 'What is the distribution? Dominant segment?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  table_data: {
    systemPrompt: 'Extract key values from table. Notable patterns?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },

  // 회사정보
  company_overview: {
    systemPrompt: 'Company info: employees, founding year, industry?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  team_info: {
    systemPrompt: 'Team size and structure? Key info?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  benefits_info: {
    systemPrompt: 'What benefits are offered? Good or average?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  tech_stack: {
    systemPrompt: 'Technologies used? Modern or outdated?',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },

  // 기타
  unknown: {
    systemPrompt: 'Describe this image briefly.',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
  pending: {
    systemPrompt: 'Describe this image briefly.',
    outputFormat: SIMPLE_OUTPUT_FORMAT,
  },
};

// 분석 프롬프트 조회
export function getAnalysisPrompt(category: ImageSubCategory): AnalysisPrompt {
  return ANALYSIS_PROMPTS[category] || ANALYSIS_PROMPTS.unknown;
}

// 전체 분석 프롬프트 생성 (간소화)
export function buildAnalysisPrompt(category: ImageSubCategory): string {
  const { systemPrompt, outputFormat } = getAnalysisPrompt(category);
  return `${systemPrompt}

${outputFormat}`;
}

// 단순 텍스트 응답 파싱 (SCORE|SUMMARY|POINTS 형식)
export interface ParsedAnalysis {
  score: number;
  summary: string;
  keyPoints: string[];
}

export function parseSimpleResponse(response: string): ParsedAnalysis {
  const lines = response.split('\n');
  let score = 3; // 기본값
  let summary = '';
  let keyPoints: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('SCORE:')) {
      const scoreStr = trimmed.replace('SCORE:', '').trim();
      const parsed = parseInt(scoreStr, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
        score = parsed;
      }
    } else if (trimmed.startsWith('SUMMARY:')) {
      summary = trimmed.replace('SUMMARY:', '').trim();
    } else if (trimmed.startsWith('POINTS:')) {
      const pointsStr = trimmed.replace('POINTS:', '').trim();
      keyPoints = pointsStr.split('|').map((p) => p.trim()).filter(Boolean);
    }
  }

  // 파싱 실패 시 응답 전체를 summary로 사용
  if (!summary && response.trim()) {
    summary = response.trim().substring(0, 200);
  }

  return { score, summary, keyPoints };
}
