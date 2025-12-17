/**
 * Donut OCR 엔진
 *
 * NAVER Donut (Document Understanding Transformer) 기반 OCR
 * transformers.js를 사용하여 Service Worker에서 동작
 *
 * - 한국어/영어/일본어 지원 (SynthDoG 데이터로 학습)
 * - WebGPU 가속
 * - ~240MB (q4f16 양자화)
 */

import { pipeline, type DocumentQuestionAnsweringPipeline } from '@huggingface/transformers';

// Donut 모델 ID
const MODEL_ID = 'Xenova/donut-base-finetuned-docvqa';

// 엔진 상태 타입
export interface DonutStatus {
  isReady: boolean;
  isLoading: boolean;
  loadProgress: number;
  error?: string;
}

// 엔진 싱글톤
let ocrPipeline: DocumentQuestionAnsweringPipeline | null = null;
let isLoading = false;
let loadProgress = 0;
let loadError: string | undefined = undefined;

/**
 * Donut OCR 엔진 초기화
 */
export async function initDonut(
  onProgress?: (progress: { text: string; progress: number }) => void
): Promise<void> {
  // 중복 초기화 방지
  if (ocrPipeline) {
    console.log('Donut OCR이 이미 초기화되어 있습니다.');
    return;
  }

  if (isLoading) {
    console.log('Donut OCR 로딩 중입니다...');
    return;
  }

  try {
    isLoading = true;
    loadProgress = 0;
    loadError = undefined;

    console.log('Donut OCR 초기화 시작...');

    ocrPipeline = await pipeline('document-question-answering', MODEL_ID, {
      dtype: 'q4f16',
      device: 'webgpu',
      progress_callback: (progress: { status?: string; progress?: number }) => {
        if (progress.progress !== undefined) {
          loadProgress = progress.progress;
          onProgress?.({
            text: `Donut OCR: ${progress.status || 'Loading...'}`,
            progress: loadProgress,
          });
        }
        console.log(`[Donut] ${progress.status || 'Loading...'}`, progress.progress ?? '');
      },
    }) as DocumentQuestionAnsweringPipeline;

    console.log('Donut OCR 초기화 완료');
    loadProgress = 1;
    isLoading = false;
  } catch (error) {
    isLoading = false;
    loadError = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('Donut OCR 초기화 실패:', error);
    throw error;
  }
}

/**
 * 엔진 상태 확인
 */
export function isDonutReady(): boolean {
  return ocrPipeline !== null && !isLoading;
}

/**
 * 엔진 상태 조회
 */
export function getDonutStatus(): DonutStatus {
  return {
    isReady: isDonutReady(),
    isLoading,
    loadProgress,
    error: loadError,
  };
}

/**
 * 이미지에서 텍스트 인식
 * Document QA 방식으로 텍스트 추출
 */
export async function recognizeText(imageBlob: Blob): Promise<string> {
  if (!ocrPipeline) {
    throw new Error('Donut OCR이 초기화되지 않았습니다. initDonut()을 먼저 호출하세요.');
  }

  try {
    console.log(`[Donut] OCR 시작 - 이미지 크기: ${imageBlob.size} bytes`);

    // Blob → base64 data URL
    const base64 = await blobToBase64(imageBlob);

    // Document QA로 텍스트 추출
    // "What is all the text in this document?" 질문으로 전체 텍스트 추출 시도
    const result = await ocrPipeline(base64, 'What is the text content in this document?');

    const text = result[0]?.answer || '';
    console.log(`[Donut] OCR 완료 - 텍스트 길이: ${text.length}자`);

    return text;
  } catch (error) {
    console.error('Donut OCR 실패:', error);
    throw error;
  }
}

/**
 * 이미지 URL에서 텍스트 인식
 */
export async function recognizeTextFromUrl(imageUrl: string): Promise<string> {
  if (!ocrPipeline) {
    throw new Error('Donut OCR이 초기화되지 않았습니다.');
  }

  try {
    console.log(`[Donut] URL OCR 시작: ${imageUrl.slice(0, 50)}...`);

    const result = await ocrPipeline(imageUrl, 'What is the text content in this document?');
    const text = result[0]?.answer || '';

    console.log(`[Donut] URL OCR 완료 - 텍스트 길이: ${text.length}자`);

    return text;
  } catch (error) {
    console.error('Donut URL OCR 실패:', error);
    throw error;
  }
}

/**
 * 엔진 정리
 */
export async function disposeDonut(): Promise<void> {
  if (ocrPipeline) {
    try {
      console.log('Donut OCR 정리 중...');
      // transformers.js pipeline은 명시적 dispose 메서드 없음
      ocrPipeline = null;
      loadProgress = 0;
      isLoading = false;
      loadError = undefined;
      console.log('Donut OCR 정리 완료');
    } catch (error) {
      console.error('Donut OCR 정리 실패:', error);
    }
  }
}

/**
 * Blob을 base64 data URL로 변환
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const mimeType = blob.type || 'image/png';
  return `data:${mimeType};base64,${base64}`;
}
