/**
 * Qwen2-VL 엔진 - Vision Language Model
 * 이미지와 텍스트를 동시에 이해하는 멀티모달 LLM
 * 한국어 이미지/텍스트 지원
 */

import {
  AutoProcessor,
  Qwen2VLForConditionalGeneration,
  RawImage,
  type Processor,
  type PreTrainedModel,
  InterruptableStoppingCriteria,
} from '@huggingface/transformers';

// 모델 설정
const MODEL_ID = 'onnx-community/Qwen2-VL-2B-Instruct';
const ANALYSIS_TIMEOUT = 120000; // 120초 (모델이 더 크므로 시간 증가)
const IMAGE_SIZE = 448; // Qwen2-VL 권장 이미지 크기

// 엔진 상태 타입
export interface EngineStatus {
  isReady: boolean;
  isLoading: boolean;
  loadProgress: number;
  error?: string;
}

// 분석 결과 타입
export interface FinancialAnalysis {
  revenue: string;
  profit: string;
  growth: string;
  stability: string;
  score: number;
}

export interface ReviewAnalysis {
  workLifeBalance: string;
  salary: string;
  culture: string;
  growth: string;
  score: number;
}

export interface GraphAnalysis {
  description: string;
  trend: string;
  insights: string[];
  score: number;
}

// 엔진 싱글톤
let processor: Processor | null = null;
let model: PreTrainedModel | null = null;
let isLoading = false;
let loadProgress = 0;
let loadError: string | undefined = undefined;
const stoppingCriteria = new InterruptableStoppingCriteria();

/**
 * Qwen2-VL 엔진 초기화
 */
export async function initEngine(
  onProgress?: (progress: { text: string; progress: number }) => void
): Promise<void> {
  // 중복 초기화 방지
  if (model && processor) {
    console.log('Qwen2-VL 엔진이 이미 초기화되어 있습니다.');
    return;
  }

  if (isLoading) {
    console.log('Qwen2-VL 엔진 로딩 중입니다...');
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

    console.log(`Qwen2-VL 엔진 초기화 시작: ${MODEL_ID}`);

    // Processor 로드
    processor = await AutoProcessor.from_pretrained(MODEL_ID, {
      progress_callback: (progress: { status: string; progress?: number }) => {
        if (progress.progress !== undefined) {
          loadProgress = progress.progress * 0.3; // 30%까지
          onProgress?.({
            text: `Processor 로딩: ${progress.status}`,
            progress: loadProgress,
          });
        }
      },
    });

    // 모델 로드
    model = await Qwen2VLForConditionalGeneration.from_pretrained(MODEL_ID, {
      device: 'webgpu',
      progress_callback: (progress: { status: string; progress?: number }) => {
        if (progress.progress !== undefined) {
          loadProgress = 0.3 + progress.progress * 0.7; // 30%~100%
          onProgress?.({
            text: `모델 로딩: ${progress.status}`,
            progress: loadProgress,
          });
        }
      },
    });

    console.log('Qwen2-VL 엔진 초기화 완료');
    loadProgress = 1;
    isLoading = false;
  } catch (error) {
    isLoading = false;
    loadError = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('Qwen2-VL 엔진 초기화 실패:', error);
    throw error;
  }
}

/**
 * 엔진 상태 확인
 */
export function isEngineReady(): boolean {
  return model !== null && processor !== null && !isLoading;
}

/**
 * 엔진 상태 조회
 */
export function getEngineStatus(): EngineStatus {
  return {
    isReady: isEngineReady(),
    isLoading,
    loadProgress,
    error: loadError,
  };
}

/**
 * 이미지와 프롬프트로 분석 수행
 */
async function analyzeWithVision(
  imageBlob: Blob,
  prompt: string,
  options?: {
    maxTokens?: number;
  }
): Promise<string> {
  if (!model || !processor) {
    throw new Error('Qwen2-VL 엔진이 초기화되지 않았습니다. initEngine()을 먼저 호출하세요.');
  }

  try {
    // 1. Blob 정보 로깅
    console.log('[VLM] 입력 blob 크기:', imageBlob.size, 'bytes, 타입:', imageBlob.type);

    // 2. Blob을 RawImage로 변환 및 리사이즈
    const arrayBuffer = await imageBlob.arrayBuffer();
    console.log('[VLM] arrayBuffer 크기:', arrayBuffer.byteLength, 'bytes');

    const rawImage = await RawImage.fromBlob(new Blob([arrayBuffer]));
    console.log('[VLM] RawImage 생성 완료 - 크기:', rawImage.width, 'x', rawImage.height, ', 채널:', rawImage.channels);

    const image = await rawImage.resize(IMAGE_SIZE, IMAGE_SIZE);
    console.log('[VLM] 리사이즈 완료 - 크기:', image.width, 'x', image.height);

    // 3. 메시지 구성
    const conversation = [
      {
        role: 'user',
        content: [
          { type: 'image' },
          { type: 'text', text: prompt },
        ],
      },
    ];
    console.log('[VLM] 프롬프트:', prompt.substring(0, 80) + '...');

    // 4. 입력 준비
    const text = (processor as any).apply_chat_template(conversation, {
      add_generation_prompt: true,
    });
    console.log('[VLM] chat_template 결과 길이:', text.length);

    const inputs = await (processor as any)(text, image);
    console.log('[VLM] inputs.input_ids shape:', inputs.input_ids?.dims);
    console.log('[VLM] inputs.pixel_values shape:', inputs.pixel_values?.dims);

    // 타임아웃 설정
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        stoppingCriteria.interrupt();
        reject(new Error('분석 시간 초과'));
      }, ANALYSIS_TIMEOUT);
    });

    // 5. 생성
    const generationPromise = (async () => {
      console.log('[VLM] 생성 시작...');
      const outputs = await (model as any).generate({
        ...inputs,
        max_new_tokens: options?.maxTokens || 512,
        stopping_criteria: stoppingCriteria,
      });
      console.log('[VLM] 생성 완료 - outputs shape:', outputs.dims);

      // 출력 디코딩 (입력 토큰 제외)
      const inputLength = inputs.input_ids.dims.at(-1) || 0;
      console.log('[VLM] inputLength:', inputLength);

      const decoded = (processor as any).batch_decode(
        outputs.slice(null, [inputLength, null]),
        { skip_special_tokens: true }
      );
      console.log('[VLM] 디코딩된 응답:', decoded[0]?.substring(0, 200));

      return decoded[0] || '';
    })();

    return await Promise.race([generationPromise, timeoutPromise]);
  } catch (error) {
    console.error('Vision 분석 실패:', error);
    throw error;
  }
}

/**
 * JSON 응답 파싱 헬퍼
 */
function parseJsonResponse<T>(response: string, defaultValue: T): T {
  try {
    let jsonStr = response.trim();

    // 마크다운 코드 블록 제거
    const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // JSON 객체 추출
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('JSON 파싱 실패:', error, '\n응답:', response);
    return defaultValue;
  }
}

/**
 * 재무 이미지 분석
 */
export async function analyzeFinancials(imageBlob: Blob): Promise<FinancialAnalysis> {
  const prompt = `이 이미지에서 기업의 재무 정보를 분석하고 JSON 형식으로 응답하세요.

응답 형식:
{"revenue": "매출 요약", "profit": "수익성 요약", "growth": "성장성 요약", "stability": "안정성 요약", "score": 0-100}

이미지에 재무 정보가 없으면 각 필드에 "정보 없음"을 입력하세요.`;

  const defaultResult: FinancialAnalysis = {
    revenue: '분석 실패',
    profit: '분석 실패',
    growth: '분석 실패',
    stability: '분석 실패',
    score: 0,
  };

  try {
    const response = await analyzeWithVision(imageBlob, prompt, { maxTokens: 512 });
    return parseJsonResponse(response, defaultResult);
  } catch (error) {
    console.error('재무 분석 실패:', error);
    return defaultResult;
  }
}

/**
 * 리뷰 이미지 분석
 */
export async function analyzeReviews(imageBlob: Blob): Promise<ReviewAnalysis> {
  const prompt = `이 이미지에서 기업 리뷰 정보를 분석하고 JSON 형식으로 응답하세요.

응답 형식:
{"workLifeBalance": "워라밸 요약", "salary": "급여 요약", "culture": "문화 요약", "growth": "성장 가능성 요약", "score": 0-100}

이미지에 리뷰 정보가 없으면 각 필드에 "정보 없음"을 입력하세요.`;

  const defaultResult: ReviewAnalysis = {
    workLifeBalance: '분석 실패',
    salary: '분석 실패',
    culture: '분석 실패',
    growth: '분석 실패',
    score: 0,
  };

  try {
    const response = await analyzeWithVision(imageBlob, prompt, { maxTokens: 512 });
    return parseJsonResponse(response, defaultResult);
  } catch (error) {
    console.error('리뷰 분석 실패:', error);
    return defaultResult;
  }
}

/**
 * 그래프/차트 이미지 분석
 */
export async function analyzeGraphImage(imageBlob: Blob): Promise<GraphAnalysis> {
  // 영어 프롬프트 + 단순화된 JSON 형식
  const prompt = `Analyze this image and respond in JSON format only.

Response format:
{"description": "what you see in this image", "trend": "trend analysis if it's a chart/graph", "insights": ["insight1", "insight2"], "score": 50}

If not a chart, describe what you see in the image.
Respond ONLY with valid JSON, no other text.`;

  const defaultResult: GraphAnalysis = {
    description: '분석 실패',
    trend: '분석 실패',
    insights: [],
    score: 0,
  };

  try {
    const response = await analyzeWithVision(imageBlob, prompt, { maxTokens: 512 });
    return parseJsonResponse(response, defaultResult);
  } catch (error) {
    console.error('그래프 분석 실패:', error);
    return defaultResult;
  }
}

/**
 * 일반 이미지 분석 (커스텀 프롬프트)
 */
export async function analyzeImage(
  imageBlob: Blob,
  customPrompt: string
): Promise<string> {
  try {
    return await analyzeWithVision(imageBlob, customPrompt, { maxTokens: 2048 });
  } catch (error) {
    console.error('이미지 분석 실패:', error);
    throw error;
  }
}

/**
 * 종합 점수 계산
 */
export function calculateTotalScore(
  financialScore: number,
  reviewScore: number,
  weights?: { financial: number; review: number }
): number {
  const { financial = 0.6, review = 0.4 } = weights || {};

  const total = financial + review;
  const normalizedFinancial = financial / total;
  const normalizedReview = review / total;

  const totalScore = financialScore * normalizedFinancial + reviewScore * normalizedReview;

  return Math.max(0, Math.min(100, Math.round(totalScore)));
}

/**
 * 분석 중단
 */
export function interruptGeneration(): void {
  stoppingCriteria.interrupt();
}

/**
 * 엔진 정리
 */
export async function disposeEngine(): Promise<void> {
  if (model || processor) {
    try {
      console.log('Qwen2-VL 엔진 정리 중...');
      model = null;
      processor = null;
      loadProgress = 0;
      isLoading = false;
      loadError = undefined;
      console.log('Qwen2-VL 엔진 정리 완료');
    } catch (error) {
      console.error('Qwen2-VL 엔진 정리 실패:', error);
    }
  }
}
