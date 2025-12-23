/**
 * 기본 AI 프롬프트 템플릿
 * 설정에서 커스터마이징 가능
 */

/** 개별 이미지 분석 기본 프롬프트 */
export const DEFAULT_IMAGE_ANALYSIS_PROMPT = `{{companyName}} 회사의 스크린샷을 분석하세요.
{{#if memo}}

## 사용자 메모
이 이미지에 대해 사용자가 제공한 추가 정보입니다:
{{memo}}
{{/if}}

## 카테고리
다음 중 하나를 선택하세요:
- revenue_trend: 매출/수익 추이 그래프
- balance_sheet: 재무상태표
- income_statement: 손익계산서
- employee_trend: 직원수/입퇴사 추이
- review_positive: 긍정적 리뷰
- review_negative: 부정적 리뷰
- company_overview: 회사 개요/소개
- unknown: 분류 불가

## 분석 요청
1. 이미지에서 텍스트와 수치 데이터를 추출하세요
2. 적절한 카테고리를 선택하세요
3. 핵심 내용을 요약하세요

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:

\`\`\`json
{
  "category": "카테고리명",
  "summary": "2-3문장 요약",
  "keyPoints": ["핵심포인트1", "핵심포인트2", "핵심포인트3"],
  "sentiment": "positive 또는 neutral 또는 negative",
  "extractedText": "이미지에서 추출한 주요 텍스트/수치"
}
\`\`\``;

/** 종합 분석 기본 프롬프트 */
export const DEFAULT_SYNTHESIS_PROMPT = `다음은 {{companyName}} 회사에 대한 개별 분석 결과입니다:
{{#if analysisContext}}

## 분석 컨텍스트
사용자가 제공한 추가 정보입니다:
{{analysisContext}}
{{/if}}

## 개별 분석 결과
{{analyses}}

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

/** 개별 분석 변수 목록 */
export const IMAGE_ANALYSIS_VARIABLES = [
  { name: 'companyName', label: '회사명', description: '분석 대상 회사 이름' },
  { name: 'memo', label: '메모', description: '이미지별 사용자 메모 (없으면 생략)' },
] as const;

/** 종합 분석 변수 목록 */
export const SYNTHESIS_VARIABLES = [
  { name: 'companyName', label: '회사명', description: '분석 대상 회사 이름' },
  { name: 'analysisContext', label: '컨텍스트', description: '전체 분석 컨텍스트 (없으면 생략)' },
  { name: 'analyses', label: '분석결과', description: '개별 이미지 분석 결과 목록' },
] as const;

/**
 * 프롬프트 템플릿에서 변수를 치환합니다.
 * 지원 문법:
 * - {{variable}}: 변수 치환
 * - {{#if variable}}...{{/if}}: 조건부 블록 (변수가 있을 때만 표시)
 */
export function interpolatePrompt(
  template: string,
  variables: Record<string, string | undefined>
): string {
  let result = template;

  // 1. 조건부 블록 처리: {{#if variable}}...{{/if}}
  const ifBlockRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(ifBlockRegex, (_, varName, content) => {
    const value = variables[varName];
    if (value && value.trim()) {
      // 조건이 참이면 내부 변수도 치환
      return content.replace(/\{\{(\w+)\}\}/g, (match: string, innerVar: string) => {
        return variables[innerVar] ?? match;
      });
    }
    return ''; // 조건이 거짓이면 블록 제거
  });

  // 2. 일반 변수 치환: {{variable}}
  result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] ?? match;
  });

  return result;
}
