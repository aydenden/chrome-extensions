# Feature 30: 분류/분석 프롬프트 정의

## 개요

AI 모델에 사용되는 분류 및 분석 프롬프트를 정의합니다.

## 범위

- 이미지 분류 프롬프트
- 텍스트 분석 프롬프트
- 요약 프롬프트
- 프롬프트 템플릿 시스템

## 의존성

- 없음 (독립 유틸리티)

## 구현 상세

### spa/src/lib/ai/prompts/classification.ts

```typescript
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
```

### spa/src/lib/ai/prompts/analysis.ts

```typescript
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
```

### spa/src/lib/ai/prompts/summary.ts

```typescript
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
```

### spa/src/lib/ai/prompts/index.ts

```typescript
export * from './classification';
export * from './analysis';
export * from './summary';

/** 프롬프트 템플릿 변수 치환 */
export function fillTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

/** 프롬프트 토큰 수 추정 (한글 기준) */
export function estimateTokens(text: string): number {
  // 대략적 추정: 한글 1.5자 = 1토큰, 영어 4자 = 1토큰
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars / 1.5 + otherChars / 4);
}

/** 프롬프트 길이 제한 */
export function truncateForTokenLimit(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;

  const ratio = maxTokens / currentTokens;
  const targetLength = Math.floor(text.length * ratio * 0.9); // 10% 여유
  return text.slice(0, targetLength) + '...';
}
```

### spa/src/lib/ai/prompts/templates.ts

```typescript
/** 프롬프트 템플릿 타입 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'classification' | 'analysis' | 'summary' | 'custom';
}

/** 기본 템플릿 목록 */
export const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'classification-default',
    name: '기본 분류',
    description: '이미지 카테고리 분류',
    template: '{{CLASSIFICATION_PROMPT}}',
    variables: ['OCR_TEXT'],
    category: 'classification',
  },
  {
    id: 'analysis-default',
    name: '기본 분석',
    description: '텍스트 상세 분석',
    template: '{{ANALYSIS_PROMPT}}',
    variables: ['COMPANY_NAME', 'TEXT'],
    category: 'analysis',
  },
  {
    id: 'summary-default',
    name: '종합 리포트',
    description: '분석 결과 종합',
    template: '{{SUMMARY_PROMPT}}',
    variables: ['COMPANY_NAME', 'ANALYSES'],
    category: 'summary',
  },
];

/** 사용자 정의 템플릿 저장/로드 */
const STORAGE_KEY = 'ai-analyzer-prompts';

export function saveCustomTemplate(template: PromptTemplate): void {
  const templates = loadCustomTemplates();
  const index = templates.findIndex(t => t.id === template.id);
  if (index >= 0) {
    templates[index] = template;
  } else {
    templates.push(template);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function loadCustomTemplates(): PromptTemplate[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}
```

## 완료 기준

- [ ] CLASSIFICATION_PROMPT: 카테고리별 분류 프롬프트
- [ ] ANALYSIS_PROMPT: 텍스트 분석 프롬프트
- [ ] SUMMARY_PROMPT: 종합 리포트 프롬프트
- [ ] fillTemplate: 변수 치환 함수
- [ ] estimateTokens: 토큰 수 추정
- [ ] truncateForTokenLimit: 길이 제한
- [ ] PromptTemplate 타입 및 저장/로드

## 참조 문서

- spec/03-spa-structure.md Section 6.3 (프롬프트)
