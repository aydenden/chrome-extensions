/**
 * Qwen3 텍스트 LM 엔진
 * 텍스트 분류 및 분석을 위한 경량 언어 모델
 *
 * 사용 모델: onnx-community/Qwen3-0.6B-ONNX
 * - transformers.js WebGPU 지원
 * - q4f16 양자화로 메모리/속도 최적화
 */

import { pipeline, type TextGenerationPipeline } from '@huggingface/transformers';

// 모델 설정
const MODEL_ID = 'onnx-community/Qwen3-0.6B-ONNX';
const DEFAULT_MAX_TOKENS = 256;
const GENERATION_TIMEOUT = 90000; // 90초 (긴 텍스트 분석 대응)

// 엔진 상태 타입
export interface TextLLMStatus {
  isReady: boolean;
  isLoading: boolean;
  loadProgress: number;
  error?: string;
}

// 엔진 싱글톤
let generator: TextGenerationPipeline | null = null;
let isLoading = false;
let loadProgress = 0;
let loadError: string | undefined = undefined;

/**
 * 텍스트 LM 엔진 초기화
 */
export async function initTextLLM(
  onProgress?: (progress: { text: string; progress: number }) => void
): Promise<void> {
  // 중복 초기화 방지
  if (generator) {
    console.log('Qwen3 텍스트 LM이 이미 초기화되어 있습니다.');
    return;
  }

  if (isLoading) {
    console.log('Qwen3 텍스트 LM 로딩 중입니다...');
    return;
  }

  // WebGPU 지원 확인
  if (!(navigator as any).gpu) {
    const error = 'WebGPU가 지원되지 않는 브라우저입니다.';
    console.error(error);
    loadError = error;
    throw new Error(error);
  }

  try {
    isLoading = true;
    loadProgress = 0;
    loadError = undefined;

    console.log(`Qwen3 텍스트 LM 초기화 시작: ${MODEL_ID}`);

    generator = await pipeline('text-generation', MODEL_ID, {
      dtype: 'q4f16', // 양자화로 메모리/속도 최적화
      device: 'webgpu',
      progress_callback: (progress: { status: string; progress?: number }) => {
        if (progress.progress !== undefined) {
          loadProgress = progress.progress;
          onProgress?.({
            text: `텍스트 LM 로딩: ${progress.status}`,
            progress: loadProgress,
          });
        }
      },
    }) as TextGenerationPipeline;

    console.log('Qwen3 텍스트 LM 초기화 완료');
    loadProgress = 1;
    isLoading = false;
  } catch (error) {
    isLoading = false;
    loadError = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('Qwen3 텍스트 LM 초기화 실패:', error);
    throw error;
  }
}

/**
 * 엔진 상태 확인
 */
export function isTextLLMReady(): boolean {
  return generator !== null && !isLoading;
}

/**
 * 엔진 상태 조회
 */
export function getTextLLMStatus(): TextLLMStatus {
  return {
    isReady: isTextLLMReady(),
    isLoading,
    loadProgress,
    error: loadError,
  };
}

/**
 * 텍스트 생성
 */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = DEFAULT_MAX_TOKENS
): Promise<string> {
  if (!generator) {
    throw new Error('Qwen3 텍스트 LM이 초기화되지 않았습니다. initTextLLM()을 먼저 호출하세요.');
  }

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    // 타임아웃 설정
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('텍스트 생성 시간 초과'));
      }, GENERATION_TIMEOUT);
    });

    const generationPromise = (async () => {
      console.log('[TextLLM] 생성 시작...');
      const output = await generator!(messages, {
        max_new_tokens: maxTokens,
        do_sample: false,
      });

      // 결과 추출
      const result = output as any[];
      if (result && result.length > 0) {
        const generatedText = result[0].generated_text;
        if (Array.isArray(generatedText)) {
          // 마지막 assistant 응답 추출
          const lastMessage = generatedText.at(-1);
          if (lastMessage && lastMessage.role === 'assistant') {
            return lastMessage.content as string;
          }
        }
      }

      return '';
    })();

    return await Promise.race([generationPromise, timeoutPromise]);
  } catch (error) {
    console.error('텍스트 생성 실패:', error);
    throw error;
  }
}

/**
 * 단순 텍스트 생성 (시스템 프롬프트 없이)
 */
export async function generateSimple(
  prompt: string,
  maxTokens: number = DEFAULT_MAX_TOKENS
): Promise<string> {
  return generateText('You are a helpful assistant.', prompt, maxTokens);
}

/**
 * 엔진 정리
 */
export async function disposeTextLLM(): Promise<void> {
  if (generator) {
    try {
      console.log('Qwen3 텍스트 LM 정리 중...');
      generator = null;
      loadProgress = 0;
      isLoading = false;
      loadError = undefined;
      console.log('Qwen3 텍스트 LM 정리 완료');
    } catch (error) {
      console.error('Qwen3 텍스트 LM 정리 실패:', error);
    }
  }
}
