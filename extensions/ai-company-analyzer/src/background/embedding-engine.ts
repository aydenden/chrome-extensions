/**
 * 임베딩 엔진 - Offscreen Document 프록시
 *
 * Service Worker에서는 ONNX Runtime의 동적 import가 금지되어 있으므로
 * Offscreen Document에서 실제 모델을 실행하고 이 모듈은 프록시 역할을 합니다.
 */

const OFFSCREEN_DOCUMENT_PATH = 'dist/src/offscreen/offscreen.html';

export interface EmbeddingResult {
  embedding: Float32Array;
  chunkText: string;
}

export interface EmbeddingEngineStatus {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  modelId: string;
}

let offscreenCreated = false;
let isInitializing = false;

/**
 * Offscreen Document 생성
 */
async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenCreated) return;

  // 이미 존재하는지 확인
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });

  if (existingContexts.length > 0) {
    offscreenCreated = true;
    return;
  }

  // Offscreen Document 생성
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'AI 임베딩 모델 실행을 위해 필요합니다.',
    });
    offscreenCreated = true;
    console.log('[EmbeddingEngine] Offscreen Document 생성 완료');
  } catch (error) {
    // 이미 존재하는 경우 무시
    if ((error as Error).message?.includes('Only a single offscreen')) {
      offscreenCreated = true;
      return;
    }
    throw error;
  }
}

/**
 * Offscreen Document로 메시지 전송
 */
async function sendToOffscreen<T>(type: string, data?: unknown): Promise<T> {
  await ensureOffscreenDocument();

  return new Promise((resolve, reject) => {
    // target: 'offscreen'을 추가하여 offscreen document만 메시지를 처리하도록 함
    chrome.runtime.sendMessage({ type, target: 'offscreen', data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.success === false) {
        reject(new Error(response.error || 'Unknown error'));
      } else {
        resolve(response as T);
      }
    });
  });
}

/**
 * 임베딩 엔진 초기화
 */
export async function initEmbeddingEngine(
  onProgress?: (progress: number) => void
): Promise<void> {
  if (isInitializing) {
    console.log('[EmbeddingEngine] 이미 초기화 중...');
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  try {
    isInitializing = true;
    console.log('[EmbeddingEngine] Offscreen Document 초기화 시작');

    await ensureOffscreenDocument();

    const result = await sendToOffscreen<{ success: boolean; error?: string }>(
      'OFFSCREEN_INIT_EMBEDDING'
    );

    if (!result.success) {
      throw new Error(result.error || '임베딩 엔진 초기화 실패');
    }

    console.log('[EmbeddingEngine] 초기화 완료');
    onProgress?.(100);
  } finally {
    isInitializing = false;
  }
}

/**
 * 텍스트 임베딩 생성 (청킹 포함)
 */
export async function generateEmbeddings(text: string): Promise<EmbeddingResult[]> {
  console.log('[EmbeddingEngine] generateEmbeddings 호출, Offscreen으로 전송...');
  const response = await sendToOffscreen<{
    success: boolean;
    embeddings?: Array<{ embedding: number[]; chunkText: string }>;
    error?: string;
  }>('OFFSCREEN_GENERATE_EMBEDDINGS', { text });
  console.log('[EmbeddingEngine] Offscreen 응답:', response.success, response.error);

  if (!response.embeddings) {
    return [];
  }

  // number[] -> Float32Array 변환
  return response.embeddings.map((item) => ({
    embedding: new Float32Array(item.embedding),
    chunkText: item.chunkText,
  }));
}

/**
 * 단일 쿼리 임베딩 생성
 */
export async function generateQueryEmbedding(query: string): Promise<Float32Array> {
  const response = await sendToOffscreen<{
    success: boolean;
    embedding?: number[];
    error?: string;
  }>('OFFSCREEN_GENERATE_QUERY_EMBEDDING', { query });

  if (!response.embedding) {
    throw new Error('쿼리 임베딩 생성 실패');
  }

  return new Float32Array(response.embedding);
}

/**
 * 임베딩 엔진 상태 조회
 */
export async function getEmbeddingEngineStatus(): Promise<EmbeddingEngineStatus> {
  try {
    const response = await sendToOffscreen<{
      success: boolean;
      status?: EmbeddingEngineStatus;
    }>('OFFSCREEN_GET_STATUS');

    if (response.status) {
      return response.status;
    }
  } catch (error) {
    console.error('[EmbeddingEngine] 상태 조회 실패:', error);
  }

  return {
    isReady: false,
    isLoading: isInitializing,
    error: null,
    modelId: 'Xenova/all-MiniLM-L6-v2',
  };
}

/**
 * 임베딩 엔진 준비 여부
 */
export async function isEmbeddingEngineReady(): Promise<boolean> {
  const status = await getEmbeddingEngineStatus();
  return status.isReady;
}

/**
 * 임베딩 엔진 해제 (Offscreen Document 닫기)
 */
export async function disposeEmbeddingEngine(): Promise<void> {
  if (offscreenCreated) {
    try {
      await chrome.offscreen.closeDocument();
      offscreenCreated = false;
      console.log('[EmbeddingEngine] Offscreen Document 닫기 완료');
    } catch (error) {
      console.error('[EmbeddingEngine] Offscreen Document 닫기 실패:', error);
    }
  }
}

/**
 * 텍스트 청킹 함수 (유틸리티로 유지)
 */
export function chunkText(text: string, maxLength: number = 200): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  if (text.length <= maxLength) {
    return [text.trim()];
  }

  const sentences = text.split(/(?<=[.!?。])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    if (currentChunk && (currentChunk + ' ' + trimmedSentence).length > maxLength) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk = currentChunk
        ? currentChunk + ' ' + trimmedSentence
        : trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += maxLength) {
      chunks.push(text.slice(i, i + maxLength).trim());
    }
  }

  return chunks.filter(c => c.length > 0);
}
