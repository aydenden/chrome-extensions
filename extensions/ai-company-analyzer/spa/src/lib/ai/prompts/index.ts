export * from './classification';
export * from './analysis';
export * from './summary';
export * from './templates';

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
