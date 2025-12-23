/**
 * 프롬프트 설정 타입 정의
 */

/** 개별 프롬프트 설정 */
export interface PromptConfig {
  prompt: string;
  updatedAt: string;
}

/** 전체 프롬프트 설정 */
export interface PromptSettings {
  imageAnalysis: PromptConfig;
  synthesis: PromptConfig;
}

/** 변수 정의 */
export interface PromptVariable {
  name: string;
  label: string;
  description: string;
}
