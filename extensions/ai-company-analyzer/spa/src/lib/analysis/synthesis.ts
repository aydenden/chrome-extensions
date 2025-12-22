/**
 * 종합 분석 (Synthesis) 함수
 * 개별 이미지 분석 결과를 종합하여 회사 전체 평가 생성
 */
import type { ChatMessage, ChatOptions as BaseChatOptions, StreamOptions, StreamChunk, StreamResult } from '@/lib/ai/types';
import { extractJsonFromContent } from '@/lib/ai/stream-parser';

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

type ChatFunction = (
  messages: ChatMessage[],
  options?: BaseChatOptions
) => Promise<string>;

/** 스트리밍 채팅 함수 타입 */
export type ChatStreamFunction = (
  messages: ChatMessage[],
  options?: StreamOptions
) => AsyncGenerator<StreamChunk, StreamResult, unknown>;

/** 스트리밍용 프롬프트 (format 없이 JSON 형식 요청) */
const STREAMING_SYNTHESIS_PROMPT = `다음은 {{COMPANY_NAME}} 회사에 대한 개별 분석 결과입니다:

{{ANALYSES}}

위 분석 결과를 종합하여 회사 전체를 평가해주세요.

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:

\`\`\`json
{
  "score": 0-100 사이 숫자,
  "summary": "회사 종합 요약 (2-3문장)",
  "strengths": ["강점1", "강점2", "강점3"],
  "weaknesses": ["약점1", "약점2", "약점3"],
  "recommendation": "recommend" 또는 "neutral" 또는 "not_recommend",
  "reasoning": "추천 이유 (1-2문장)"
}
\`\`\``;

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
  const options: BaseChatOptions = {
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

// ============================================================================
// 스트리밍 종합 분석
// ============================================================================

/** 스트리밍 종합 분석 콜백 */
export interface SynthesisStreamCallbacks {
  onThinking?: (text: string, accumulated: string) => void;
  onContent?: (text: string, accumulated: string) => void;
}

/**
 * 스트리밍 종합 분석 생성
 * format 파라미터 없이 프롬프트로 JSON 형식 유도
 */
export async function generateSynthesisWithStream(
  companyName: string,
  analysisResults: AnalysisResultItem[],
  chatStream: ChatStreamFunction,
  callbacks?: SynthesisStreamCallbacks
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

  const prompt = STREAMING_SYNTHESIS_PROMPT
    .replace('{{COMPANY_NAME}}', companyName)
    .replace('{{ANALYSES}}', analysesText);

  const options: StreamOptions = {
    num_ctx: 16384,
    num_predict: -1,   // 무제한 (stop 조건까지 생성)
    temperature: 0.3,
    think: true,
    onThinking: callbacks?.onThinking,
    onContent: callbacks?.onContent,
  };

  try {
    const generator = chatStream([{ role: 'user', content: prompt }], options);

    let finalResult: StreamResult | null = null;

    // 스트림 소비
    for await (const chunk of generator) {
      if (chunk.type === 'done') {
        finalResult = {
          thinking: chunk.accumulated.thinking,
          content: chunk.accumulated.content,
          success: true,
        };
      }
    }

    if (!finalResult || !finalResult.content) {
      console.error('[Synthesis] 스트림 결과가 비어있음');
      console.error('[Synthesis] finalResult:', finalResult);
      return null;
    }

    // 디버깅 로그
    console.log('[Synthesis] content 길이:', finalResult.content.length);
    console.log('[Synthesis] content:', finalResult.content.substring(0, 500));

    // content에서 JSON 추출
    const parsed = extractJsonFromContent(finalResult.content);
    console.log('[Synthesis] parsed:', parsed);

    if (!parsed) {
      console.error('[Synthesis] JSON 파싱 실패');
      console.error('[Synthesis] 전체 content:', finalResult.content);
      return null;
    }

    const validated = validateSynthesisResult(parsed);
    console.log('[Synthesis] validated:', validated);

    return validated;
  } catch (error) {
    console.error('스트리밍 종합 분석 생성 실패:', error);
    return null;
  }
}

/**
 * 종합 분석 결과 유효성 검사
 */
function validateSynthesisResult(parsed: object): SynthesisResult | null {
  const data = parsed as Record<string, unknown>;

  // 필수 필드 확인
  if (typeof data.score !== 'number') return null;
  if (typeof data.summary !== 'string') return null;
  if (!Array.isArray(data.strengths)) return null;
  if (!Array.isArray(data.weaknesses)) return null;
  if (!['recommend', 'neutral', 'not_recommend'].includes(data.recommendation as string)) return null;
  if (typeof data.reasoning !== 'string') return null;

  return {
    score: Math.min(100, Math.max(0, data.score)),
    summary: data.summary,
    strengths: data.strengths.slice(0, 3).map(String),
    weaknesses: data.weaknesses.slice(0, 3).map(String),
    recommendation: data.recommendation as 'recommend' | 'neutral' | 'not_recommend',
    reasoning: data.reasoning,
  };
}
