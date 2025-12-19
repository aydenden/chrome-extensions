/**
 * 종합 분석 (Synthesis) 함수
 * 개별 이미지 분석 결과를 종합하여 회사 전체 평가 생성
 */

export interface SynthesisResult {
  score: number;                    // 0-100
  summary: string;                  // 종합 요약
  strengths: string[];              // 강점 목록
  weaknesses: string[];             // 약점 목록
  recommendation: 'recommend' | 'neutral' | 'not_recommend';
  reasoning: string;                // 추천 이유
}

export interface AnalysisResultItem {
  imageId: string;
  category: string;
  rawText: string;
  analysis: string;
}

const SYNTHESIS_PROMPT = `다음은 {{COMPANY_NAME}} 회사에 대한 개별 분석 결과입니다:

{{ANALYSES}}

위 분석 결과를 종합하여 다음 JSON 형식으로 응답하세요:
{
  "score": 0-100 사이 숫자 (종합 평가 점수),
  "summary": "회사 종합 요약 (2-3문장)",
  "strengths": ["강점1", "강점2", "강점3"],
  "weaknesses": ["약점1", "약점2", "약점3"],
  "recommendation": "recommend" | "neutral" | "not_recommend",
  "reasoning": "추천 이유 (1-2문장)"
}`;

const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    weaknesses: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    recommendation: { type: 'string', enum: ['recommend', 'neutral', 'not_recommend'] },
    reasoning: { type: 'string' }
  },
  required: ['score', 'summary', 'strengths', 'weaknesses', 'recommendation', 'reasoning']
};

interface ChatOptions {
  num_ctx?: number;
  temperature?: number;
  num_predict?: number;
  format?: object;
}

type ChatFunction = (
  messages: Array<{ role: string; content: string }>,
  options?: ChatOptions
) => Promise<string>;

export async function generateSynthesis(
  companyName: string,
  analysisResults: AnalysisResultItem[],
  chat: ChatFunction
): Promise<SynthesisResult | null> {
  if (analysisResults.length === 0) return null;

  // 분석 결과 요약 텍스트 생성
  const analysesText = analysisResults.map((r, i) => {
    try {
      const data = JSON.parse(r.analysis);
      return `[${i + 1}] ${r.category}: ${data.summary || data.extractedText || '요약 없음'}`;
    } catch {
      return `[${i + 1}] ${r.category}: 분석 데이터 없음`;
    }
  }).join('\n\n');

  const prompt = SYNTHESIS_PROMPT
    .replace('{{COMPANY_NAME}}', companyName)
    .replace('{{ANALYSES}}', analysesText);

  // 종합 분석에는 더 큰 context window 필요
  const options: ChatOptions = {
    num_ctx: 8192,
    temperature: 0.3,
    num_predict: 1024,
    format: SYNTHESIS_SCHEMA
  };

  try {
    const response = await chat([{ role: 'user', content: prompt }], options);
    return JSON.parse(response) as SynthesisResult;
  } catch (error) {
    console.error('종합 분석 생성 실패:', error);
    return null;
  }
}
