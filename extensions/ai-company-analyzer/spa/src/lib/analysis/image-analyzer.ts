/**
 * 개별 이미지 AI 분석 서비스
 */
import type { ImageSubCategory } from '@shared/constants/categories';
import type { ChatOptions, StreamOptions, StreamChunk, StreamResult } from '@/lib/ai/types';
import {
  IMAGE_ANALYSIS_SCHEMA,
  createImageAnalysisPrompt,
  parseAnalysisResult,
} from '@/lib/ai/prompts/image-analysis';
import { extractJsonFromContent } from '@/lib/ai/stream-parser';
import { DEFAULT_IMAGE_ANALYSIS_PROMPT, interpolatePrompt } from '@/lib/prompts';
import type { AnalysisResultItem, LoadedImage } from './types';

/** analyzeImage 함수 타입 (비스트리밍) */
export type AnalyzeImageFn = (
  imageBase64: string,
  prompt: string,
  options?: ChatOptions
) => Promise<string>;

/** analyzeImageStream 함수 타입 (스트리밍) */
export type AnalyzeImageStreamFn = (
  imageBase64: string,
  prompt: string,
  options?: StreamOptions
) => AsyncGenerator<StreamChunk, StreamResult, unknown>;

/** 분석 옵션 기본값 (비스트리밍) */
const DEFAULT_ANALYSIS_OPTIONS: ChatOptions = {
  temperature: 0.3,
  num_predict: 1024,
  num_gpu: 999,
  num_ctx: 8192,
  num_batch: 512,
  use_mmap: true,
  use_mlock: true,
  format: IMAGE_ANALYSIS_SCHEMA,
};

/** 스트리밍 분석 옵션 기본값 */
const STREAMING_ANALYSIS_OPTIONS: StreamOptions = {
  temperature: 0.3,
  num_predict: -1,     // 무제한 (stop 조건까지 생성)
  num_gpu: 999,
  num_ctx: 16384,      // 16k로 확장
  num_batch: 512,
  use_mmap: true,
  use_mlock: true,
  think: true,         // thinking 활성화
  // format 제거 - thinking과 충돌
};

/** 이미지 분석 파라미터 */
export interface AnalyzeImageParams {
  image: LoadedImage;
  companyName: string;
  /** 이미지별 메모 (프롬프트에 포함) */
  memo?: string;
  /** 커스텀 프롬프트 템플릿 (미제공 시 기본값 사용) */
  promptTemplate?: string;
  /** 중단 신호 */
  abortSignal?: AbortSignal;
}

/**
 * 개별 이미지 AI 분석 (비스트리밍)
 * @param params 분석 파라미터
 * @param analyzeImageFn Ollama analyzeImage 함수
 * @returns 분석 결과
 */
export async function analyzeImage(
  params: AnalyzeImageParams,
  analyzeImageFn: AnalyzeImageFn
): Promise<AnalysisResultItem> {
  const { image, companyName } = params;
  const prompt = createImageAnalysisPrompt(companyName);

  try {
    const result = await analyzeImageFn(image.base64, prompt, DEFAULT_ANALYSIS_OPTIONS);
    const parsed = parseAnalysisResult(result);

    return {
      imageId: image.id,
      category: parsed?.category ?? 'unknown',
      rawText: parsed?.extractedText ?? '',
      analysis: result, // 원본 JSON 문자열 유지
    };
  } catch (error) {
    // 에러 발생 시에도 결과 반환 (에러 상태로)
    const errorMessage = error instanceof Error ? error.message : '분석 실패';
    return {
      imageId: image.id,
      category: 'unknown' as ImageSubCategory,
      rawText: '',
      analysis: JSON.stringify({ error: errorMessage }),
    };
  }
}

/**
 * 여러 이미지 순차 분석 (에러 격리)
 * 개별 이미지 에러 시 계속 진행
 */
export async function analyzeImages(
  images: LoadedImage[],
  companyName: string,
  analyzeImageFn: AnalyzeImageFn,
  options?: {
    onProgress?: (current: number, total: number) => void;
    onImageComplete?: (result: AnalysisResultItem) => void;
    abortSignal?: AbortSignal;
  }
): Promise<{
  results: AnalysisResultItem[];
  completedIds: string[];
  failedIds: string[];
}> {
  const results: AnalysisResultItem[] = [];
  const completedIds: string[] = [];
  const failedIds: string[] = [];

  for (let i = 0; i < images.length; i++) {
    // 중단 체크
    if (options?.abortSignal?.aborted) {
      break;
    }

    const image = images[i];

    try {
      const result = await analyzeImage({ image, companyName }, analyzeImageFn);

      // 에러 결과인지 확인
      const isError = result.analysis.includes('"error"');
      if (isError) {
        failedIds.push(image.id);
      } else {
        completedIds.push(image.id);
      }

      results.push(result);
      options?.onImageComplete?.(result);
    } catch (error) {
      // 예상치 못한 에러도 처리
      console.error(`이미지 ${image.id} 분석 실패:`, error);

      const errorResult: AnalysisResultItem = {
        imageId: image.id,
        category: 'unknown',
        rawText: '',
        analysis: JSON.stringify({
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        }),
      };

      results.push(errorResult);
      failedIds.push(image.id);
      options?.onImageComplete?.(errorResult);
    }

    // 진행률 콜백
    options?.onProgress?.(i + 1, images.length);
  }

  return { results, completedIds, failedIds };
}

// ============================================================================
// Streaming Analysis
// ============================================================================

/**
 * 스트리밍용 이미지 분석 프롬프트 생성
 * 커스텀 템플릿을 사용하여 변수를 치환
 */
function createStreamingAnalysisPrompt(
  promptTemplate: string,
  companyName: string,
  memo?: string
): string {
  return interpolatePrompt(promptTemplate, {
    companyName,
    memo,
  });
}

/** 스트리밍 분석 결과 타입 */
export interface StreamingAnalysisCallbacks {
  onThinking?: (text: string, accumulated: string) => void;
  onContent?: (text: string, accumulated: string) => void;
}

/**
 * 개별 이미지 AI 분석 (스트리밍)
 * thinking 과정을 실시간으로 콜백하고, 완료 시 JSON 파싱
 */
export async function analyzeImageWithStream(
  params: AnalyzeImageParams,
  analyzeStreamFn: AnalyzeImageStreamFn,
  callbacks?: StreamingAnalysisCallbacks
): Promise<AnalysisResultItem> {
  const { image, companyName, memo, promptTemplate, abortSignal } = params;
  const template = promptTemplate || DEFAULT_IMAGE_ANALYSIS_PROMPT;
  const prompt = createStreamingAnalysisPrompt(template, companyName, memo || image.memo);

  try {
    let finalResult: StreamResult | null = null;

    const generator = analyzeStreamFn(image.base64, prompt, {
      ...STREAMING_ANALYSIS_OPTIONS,
      onThinking: callbacks?.onThinking,
      onContent: callbacks?.onContent,
      abortSignal,
    });

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

    // generator가 끝나면 return 값 확인
    if (!finalResult) {
      // done 청크가 없는 경우 - 비정상
      throw new Error('스트림이 비정상 종료됨');
    }

    // content에서 JSON 추출
    const parsed = extractJsonFromContent(finalResult.content);
    const validatedResult = parsed ? validateStreamingResult(parsed) : null;

    return {
      imageId: image.id,
      category: validatedResult?.category ?? 'unknown',
      rawText: validatedResult?.extractedText ?? '',
      analysis: finalResult.content, // 원본 content 저장
      thinking: finalResult.thinking, // thinking도 저장
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '분석 실패';
    return {
      imageId: image.id,
      category: 'unknown' as ImageSubCategory,
      rawText: '',
      analysis: JSON.stringify({ error: errorMessage }),
    };
  }
}

/**
 * 스트리밍 결과 유효성 검사 및 변환
 */
function validateStreamingResult(parsed: object): {
  category: ImageSubCategory;
  extractedText: string;
} | null {
  const data = parsed as Record<string, unknown>;

  // 카테고리 유효성 검증
  const validCategories: ImageSubCategory[] = [
    'revenue_trend',
    'balance_sheet',
    'income_statement',
    'employee_trend',
    'review_positive',
    'review_negative',
    'company_overview',
    'unknown',
  ];

  const category: ImageSubCategory = validCategories.includes(data.category as ImageSubCategory)
    ? (data.category as ImageSubCategory)
    : 'unknown';

  return {
    category,
    extractedText: typeof data.extractedText === 'string' ? data.extractedText : '',
  };
}

/**
 * 여러 이미지 순차 스트리밍 분석 (에러 격리)
 */
export async function analyzeImagesWithStream(
  images: LoadedImage[],
  companyName: string,
  analyzeStreamFn: AnalyzeImageStreamFn,
  options?: {
    onProgress?: (current: number, total: number) => void;
    onImageComplete?: (result: AnalysisResultItem) => void;
    onStreamChunk?: (imageId: string, chunk: StreamChunk) => void;
    abortSignal?: AbortSignal;
    /** 커스텀 프롬프트 템플릿 */
    promptTemplate?: string;
  }
): Promise<{
  results: AnalysisResultItem[];
  completedIds: string[];
  failedIds: string[];
}> {
  const results: AnalysisResultItem[] = [];
  const completedIds: string[] = [];
  const failedIds: string[] = [];

  for (let i = 0; i < images.length; i++) {
    if (options?.abortSignal?.aborted) {
      break;
    }

    const image = images[i];

    try {
      const result = await analyzeImageWithStream(
        {
          image,
          companyName,
          memo: image.memo,
          promptTemplate: options?.promptTemplate,
          abortSignal: options?.abortSignal,
        },
        analyzeStreamFn,
        {
          onThinking: (text, accumulated) => {
            options?.onStreamChunk?.(image.id, {
              type: 'thinking',
              text,
              accumulated: { thinking: accumulated, content: '' },
            });
          },
          onContent: (text, accumulated) => {
            options?.onStreamChunk?.(image.id, {
              type: 'content',
              text,
              accumulated: { thinking: '', content: accumulated },
            });
          },
        }
      );

      const isError = result.analysis.includes('"error"');
      if (isError) {
        failedIds.push(image.id);
      } else {
        completedIds.push(image.id);
      }

      results.push(result);
      options?.onImageComplete?.(result);
    } catch (error) {
      console.error(`이미지 ${image.id} 스트리밍 분석 실패:`, error);

      const errorResult: AnalysisResultItem = {
        imageId: image.id,
        category: 'unknown',
        rawText: '',
        analysis: JSON.stringify({
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        }),
      };

      results.push(errorResult);
      failedIds.push(image.id);
      options?.onImageComplete?.(errorResult);
    }

    options?.onProgress?.(i + 1, images.length);
  }

  return { results, completedIds, failedIds };
}
