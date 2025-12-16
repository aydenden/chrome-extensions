/**
 * 카테고리별 텍스트 추출 프롬프트 (단순화 버전)
 *
 * 주의사항:
 * - JSON 예시에 구체적인 값을 넣지 않음 (모델이 복사함)
 * - 영어로 작성 (모델 성능 향상)
 * - 짧고 명확한 지시
 */

import type { ImageSubCategory, DataType } from '@/types/storage';

// 재무 문서 프롬프트
const FINANCIAL_PROMPTS: Partial<Record<ImageSubCategory, string>> = {
  balance_sheet: `Extract text and numbers from this balance sheet.

Return JSON:
{"rawText":"<all visible text>","summary":"<Korean summary>","keyPoints":["<point1>","<point2>"],"numbers":[{"label":"<name>","value":<num>,"unit":"<unit>"}]}

Include: total assets, liabilities, equity, ratios.`,

  income_statement: `Extract text and numbers from this income statement.

Return JSON:
{"rawText":"<all visible text>","summary":"<Korean summary>","keyPoints":["<point1>","<point2>"],"numbers":[{"label":"<name>","value":<num>,"unit":"<unit>"}],"trend":{"direction":"<up/down/stable>"}}

Include: revenue, operating profit, net income, margins.`,

  cash_flow: `Extract text and numbers from this cash flow statement.

Return JSON:
{"rawText":"<all visible text>","summary":"<Korean summary>","keyPoints":["<point1>","<point2>"],"numbers":[{"label":"<name>","value":<num>,"unit":"<unit>"}]}

Include: operating/investing/financing cash flows.`,

  financial_ratio: `Extract financial ratios from this image.

Return JSON:
{"rawText":"<all visible text>","summary":"<Korean summary>","keyPoints":["<point1>","<point2>"],"numbers":[{"label":"<ratio name>","value":<num>,"unit":"%"}]}

Include: ROE, ROA, debt ratio, current ratio.`,

  revenue_trend: `Extract revenue trend data from this chart.

Return JSON:
{"rawText":"<chart description>","summary":"<Korean summary>","keyPoints":["<point1>","<point2>"],"numbers":[{"label":"<year>","value":<num>,"unit":"<unit>","year":<year>}],"trend":{"direction":"<up/down/stable>","percentage":<change%>}}

Include: all data points, growth rates.`,

  employee_trend: `Extract employee count data from this chart.

Return JSON:
{"rawText":"<chart description>","summary":"<Korean summary>","keyPoints":["<point1>","<point2>"],"numbers":[{"label":"<year>","value":<num>,"unit":"<unit>","year":<year>}],"trend":{"direction":"<up/down/stable>"}}`,
};

// 리뷰 프롬프트
const REVIEW_PROMPTS: Partial<Record<ImageSubCategory, string>> = {
  review_positive: `Extract this positive employee review.

Return JSON:
{"rawText":"<full review text>","summary":"<Korean summary>","keyPoints":["<positive1>","<positive2>"],"sentiment":{"score":0.8,"positiveAspects":["<aspect1>"],"negativeAspects":[]}}

Identify: work-life balance, salary, culture, growth opportunities.`,

  review_negative: `Extract this negative employee review.

Return JSON:
{"rawText":"<full review text>","summary":"<Korean summary>","keyPoints":["<negative1>","<negative2>"],"sentiment":{"score":-0.7,"positiveAspects":[],"negativeAspects":["<concern1>"]}}

Identify: overtime, low pay, rigid culture, limited growth.`,

  review_mixed: `Extract this employee review with both pros and cons.

Return JSON:
{"rawText":"<full review text>","summary":"<Korean summary>","keyPoints":["<pro>","<con>"],"sentiment":{"score":0.1,"positiveAspects":["<aspect>"],"negativeAspects":["<concern>"]}}`,

  rating_summary: `Extract rating scores from this review summary.

Return JSON:
{"rawText":"<all visible text>","summary":"<Korean summary>","keyPoints":["<overall rating>","<review count>"],"numbers":[{"label":"<category>","value":<score>,"unit":"<unit>"}],"sentiment":{"score":<normalized>,"positiveAspects":["<high scores>"],"negativeAspects":["<low scores>"]}}

Include: overall rating, work-life balance, salary/benefits, management scores.`,
};

// 차트/그래프 프롬프트
const CHART_PROMPTS: Partial<Record<ImageSubCategory, string>> = {
  bar_chart: `Extract data from this bar chart.

Return JSON:
{"rawText":"<chart title, labels, values>","summary":"<Korean summary>","keyPoints":["<insight1>","<insight2>"],"numbers":[{"label":"<item>","value":<num>,"unit":"<unit>"}],"trend":{"direction":"<up/down/stable>"}}`,

  line_chart: `Extract data from this line chart.

Return JSON:
{"rawText":"<chart title, axis labels, data points>","summary":"<Korean summary>","keyPoints":["<trend1>","<trend2>"],"numbers":[{"label":"<point>","value":<num>,"unit":"<unit>"}],"trend":{"direction":"<up/down/stable>","percentage":<change%>}}`,

  pie_chart: `Extract data from this pie chart.

Return JSON:
{"rawText":"<chart title, segment labels, percentages>","summary":"<Korean summary>","keyPoints":["<largest>","<smallest>"],"numbers":[{"label":"<segment>","value":<percentage>,"unit":"%"}]}`,

  table_data: `Extract data from this table.

Return JSON:
{"rawText":"<all table content including headers and cells>","summary":"<Korean summary>","keyPoints":["<key data1>","<key data2>"],"numbers":[{"label":"<row_col>","value":<num>,"unit":"<unit>"}]}`,
};

// 회사정보 프롬프트
const COMPANY_PROMPTS: Partial<Record<ImageSubCategory, string>> = {
  company_overview: `Extract company information from this image.

Return JSON:
{"rawText":"<company name, industry, founding date, size, etc>","summary":"<Korean summary>","keyPoints":["<industry>","<founded>","<size>"],"numbers":[{"label":"<metric>","value":<num>,"unit":"<unit>"}]}`,

  team_info: `Extract team information from this image.

Return JSON:
{"rawText":"<team structure, roles, members>","summary":"<Korean summary>","keyPoints":["<team size>","<key roles>"],"numbers":[{"label":"<metric>","value":<num>,"unit":"<unit>"}]}`,

  benefits_info: `Extract employee benefits from this image.

Return JSON:
{"rawText":"<all benefits and perks listed>","summary":"<Korean summary>","keyPoints":["<benefit1>","<benefit2>","<benefit3>"],"sentiment":{"score":0.5,"positiveAspects":["<benefit>"],"negativeAspects":[]}}`,

  tech_stack: `Extract technology stack from this image.

Return JSON:
{"rawText":"<all technologies, frameworks, tools listed>","summary":"<Korean summary>","keyPoints":["<languages>","<frameworks>","<infrastructure>"]}`,
};

// 기본 프롬프트
const DEFAULT_PROMPT = `Extract all text from this image.

Return JSON:
{"rawText":"<all visible text>","summary":"<Korean summary>","keyPoints":["<point1>","<point2>"]}`;

// 언어 제한 지시 (중국어 출력 방지)
const LANGUAGE_INSTRUCTION = `

IMPORTANT: Output ONLY valid JSON. Do NOT output Chinese characters or repeated text.`;

/**
 * 카테고리별 추출 프롬프트 가져오기
 */
export function getExtractionPrompt(category: ImageSubCategory): string {
  const basePrompt = FINANCIAL_PROMPTS[category] ||
    REVIEW_PROMPTS[category] ||
    CHART_PROMPTS[category] ||
    COMPANY_PROMPTS[category] ||
    DEFAULT_PROMPT;

  return basePrompt + LANGUAGE_INSTRUCTION;
}

/**
 * 사이트 컨텍스트 (분류 정확도 향상용)
 */
export function getSiteHint(siteType: DataType): string {
  const hints: Record<DataType, string> = {
    company_info: 'Source: Wanted (job platform). Expected: company info, team, benefits, tech stack.',
    finance_inno: 'Source: Innoforest (startup data). Expected: revenue/employee trends, ratios.',
    finance_dart: 'Source: DART (financial disclosures). Expected: balance sheet, income statement, cash flow.',
    finance_smes: 'Source: SMEs portal. Expected: financial statements.',
    review_blind: 'Source: Blind (employee reviews). Expected: reviews, ratings.',
    review_jobplanet: 'Source: Jobplanet (employee reviews). Expected: reviews, ratings.',
  };

  return hints[siteType] || '';
}

/**
 * 추출 프롬프트에 사이트 힌트 추가
 */
export function buildExtractionPrompt(
  category: ImageSubCategory,
  siteType?: DataType
): string {
  const basePrompt = getExtractionPrompt(category);
  const hint = siteType ? getSiteHint(siteType) : '';

  if (hint) {
    return `${hint}\n\n${basePrompt}`;
  }

  return basePrompt;
}
