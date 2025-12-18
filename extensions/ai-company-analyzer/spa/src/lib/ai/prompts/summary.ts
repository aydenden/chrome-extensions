export const SUMMARY_PROMPT = `다음 분석 결과들을 종합하여 {{COMPANY_NAME}}에 대한 최종 리포트를 작성해주세요.

## 개별 분석 결과
{{ANALYSES}}

## 요청사항
1. 전체 요약 (3-5문장)
2. 강점 (3-5개)
3. 약점/주의점 (2-3개)
4. 종합 평가 (1-10점)
5. 추천 여부

## 응답 형식 (JSON)
\`\`\`json
{
  "overallSummary": "종합 요약",
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1"],
  "score": 7.5,
  "recommendation": "추천 | 보통 | 비추천",
  "reasoning": "평가 근거"
}
\`\`\`

JSON만 응답하세요.`;

export const COMPARISON_PROMPT = `다음 두 회사를 비교 분석해주세요.

## 회사 A: {{COMPANY_A}}
{{ANALYSIS_A}}

## 회사 B: {{COMPANY_B}}
{{ANALYSIS_B}}

## 비교 항목
1. 연봉/복리후생
2. 회사 문화
3. 성장 가능성
4. 워라밸

JSON 응답: {"winner": "A|B|tie", "comparison": {...}}`;
