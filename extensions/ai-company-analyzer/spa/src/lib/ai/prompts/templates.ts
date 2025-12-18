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
