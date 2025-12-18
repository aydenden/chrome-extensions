export const ANALYSIS_PROMPT = `당신은 기업 분석 전문가입니다. 다음 텍스트를 분석해주세요.

## 회사명
{{COMPANY_NAME}}

## 분석할 텍스트
{{TEXT}}

## 요청사항
1. 핵심 내용 요약 (2-3문장)
2. 주요 포인트 추출 (3-5개)
3. 수치 데이터 추출 (연봉, 성장률, 평점 등)
4. 전반적 톤 분석 (긍정/부정/중립)
5. 핵심 키워드 (5-10개)

## 응답 형식 (JSON)
\`\`\`json
{
  "summary": "요약 내용",
  "keyPoints": ["포인트1", "포인트2", "포인트3"],
  "metrics": [
    {"label": "연봉", "value": "5000만원", "trend": "up"},
    {"label": "평점", "value": "4.2"}
  ],
  "sentiment": "positive | negative | neutral",
  "keywords": ["키워드1", "키워드2"]
}
\`\`\`

JSON만 응답하세요.`;

export const ANALYSIS_PROMPT_COMPACT = `{{COMPANY_NAME}} 분석:
{{TEXT}}

JSON: {"summary":"","keyPoints":[],"keywords":[],"sentiment":"neutral"}`;
