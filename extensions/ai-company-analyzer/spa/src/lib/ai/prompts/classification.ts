export const CLASSIFICATION_PROMPT = `당신은 채용/기업 정보 이미지 분류 전문가입니다.

다음 OCR 텍스트를 분석하여 이미지의 카테고리를 분류해주세요.

## 카테고리 정의

### WANTED (원티드)
- JOB_POSTING: 채용공고, 포지션 상세
- COMPANY_PROFILE: 회사 소개, 팀 소개
- COMPENSATION: 연봉, 복리후생 정보

### BLIND (블라인드)
- SALARY_REVIEW: 연봉 정보, 연봉 협상
- COMPANY_REVIEW: 회사 리뷰, 장단점
- INTERVIEW_REVIEW: 면접 후기

### JOBPLANET (잡플래닛)
- COMPANY_RATING: 회사 평점, 별점
- REVIEW: 리뷰, 평가
- SALARY_INFO: 연봉 정보

### SARAMIN (사람인)
- JOB_POSTING: 채용공고
- COMPANY_INFO: 기업 정보

### INNOFOREST (이노포레스트)
- INVESTMENT: 투자 정보
- FINANCIAL: 재무 정보

### DART (다트)
- FINANCIAL_STATEMENT: 재무제표
- DISCLOSURE: 공시 정보

## OCR 텍스트
{{OCR_TEXT}}

## 응답 형식 (JSON)
\`\`\`json
{
  "category": "WANTED | BLIND | JOBPLANET | SARAMIN | INNOFOREST | DART | UNKNOWN",
  "subCategory": "위 하위 카테고리 중 하나",
  "confidence": 0.0-1.0,
  "reasoning": "분류 근거 간단히"
}
\`\`\`

JSON만 응답하세요.`;

export const CLASSIFICATION_PROMPT_SIMPLE = `이미지 분류:
- 텍스트: {{OCR_TEXT}}
- 카테고리: WANTED(채용), BLIND(리뷰), JOBPLANET(평점), SARAMIN(공고), INNOFOREST(투자), DART(재무)

JSON 응답: {"category": "...", "subCategory": "...", "confidence": 0.8}`;
