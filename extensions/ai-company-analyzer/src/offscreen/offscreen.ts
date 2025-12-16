/**
 * Offscreen Document for AI Embedding Engine
 *
 * Service Worker에서 동적 import가 금지되어 있으므로
 * 임베딩 엔진을 Offscreen Document에서 실행합니다.
 */

// onnxruntime-web 먼저 import하여 설정 적용
import * as ort from 'onnxruntime-web';

// ONNX Runtime 환경 설정 (transformers.js import 전에)
ort.env.wasm.proxy = false;
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = chrome.runtime.getURL('dist/transformers/');

console.log('[Offscreen] ONNX Runtime 설정 완료:', {
  proxy: ort.env.wasm.proxy,
  numThreads: ort.env.wasm.numThreads,
  wasmPaths: ort.env.wasm.wasmPaths,
});

import {
  AutoTokenizer,
  AutoModel,
  type PreTrainedTokenizer,
  type PreTrainedModel,
  env,
} from '@huggingface/transformers';

// 브라우저 환경 설정
env.allowLocalModels = false;
env.useBrowserCache = true;

// transformers.js 환경 설정도 적용
// @ts-expect-error - env.backends 타입 미지원
env.backends = env.backends || {};
// @ts-expect-error
env.backends.onnx = env.backends.onnx || {};
// @ts-expect-error
env.backends.onnx.wasm = env.backends.onnx.wasm || {};
// @ts-expect-error - Web Worker 프록시 비활성화 (document 참조 방지)
env.backends.onnx.wasm.proxy = false;
// @ts-expect-error - 로컬 WASM 경로 설정 (CDN 대신)
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('dist/transformers/');
// @ts-expect-error - 싱글 스레드 모드
env.backends.onnx.wasm.numThreads = 1;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const MAX_CHUNK_LENGTH = 200;

let tokenizer: PreTrainedTokenizer | null = null;
let model: PreTrainedModel | null = null;
let isLoading = false;
let loadError: Error | null = null;

interface EmbeddingResult {
  embedding: number[]; // Float32Array를 number[]로 변환 (메시지 전송용)
  chunkText: string;
}

/**
 * 임베딩 엔진 초기화
 */
async function initEmbeddingEngine(): Promise<{ success: boolean; error?: string }> {
  if (tokenizer && model) {
    console.log('[Offscreen] 이미 초기화됨');
    return { success: true };
  }

  if (isLoading) {
    console.log('[Offscreen] 로딩 중...');
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (loadError) return { success: false, error: loadError.message };
    return { success: true };
  }

  try {
    isLoading = true;
    loadError = null;

    console.log('[Offscreen] 모델 로딩 시작:', MODEL_ID);
    console.log('[Offscreen] WASM 경로:', chrome.runtime.getURL('dist/transformers/'));
    console.log('[Offscreen] env.backends.onnx.wasm:', JSON.stringify({
      proxy: env.backends?.onnx?.wasm?.proxy,
      numThreads: env.backends?.onnx?.wasm?.numThreads,
      wasmPaths: env.backends?.onnx?.wasm?.wasmPaths,
    }));
    console.log('[Offscreen] document 존재 여부:', typeof document !== 'undefined');

    // Tokenizer 로드
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, {
      progress_callback: (p: { progress?: number }) => {
        if (p.progress !== undefined) {
          console.log(`[Offscreen] Tokenizer 로딩: ${(p.progress * 30).toFixed(1)}%`);
        }
      },
    });

    console.log('[Offscreen] Tokenizer 로딩 완료');

    // Model 로드 - 명시적으로 WASM 백엔드 사용
    model = await AutoModel.from_pretrained(MODEL_ID, {
      device: 'wasm', // WebGPU 대신 WASM 강제 사용
      progress_callback: (p: { progress?: number }) => {
        if (p.progress !== undefined) {
          const progress = 30 + p.progress * 70;
          console.log(`[Offscreen] Model 로딩: ${progress.toFixed(1)}%`);
        }
      },
    });

    console.log('[Offscreen] 모델 로딩 완료');
    return { success: true };
  } catch (error) {
    loadError = error instanceof Error ? error : new Error(String(error));
    console.error('[Offscreen] 초기화 실패:', error);
    return { success: false, error: loadError.message };
  } finally {
    isLoading = false;
  }
}

/**
 * 텍스트 청킹
 */
function chunkText(text: string, maxLength: number = MAX_CHUNK_LENGTH): string[] {
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

/**
 * Mean pooling
 */
function meanPooling(
  lastHiddenState: { dims: number[]; data: Float32Array },
  attentionMask: { dims: number[]; data: BigInt64Array }
): Float32Array {
  const [, seqLength, hiddenSize] = lastHiddenState.dims;
  const result = new Float32Array(hiddenSize);

  let validTokenCount = 0;

  for (let i = 0; i < seqLength; i++) {
    if (attentionMask.data[i] === 1n) {
      validTokenCount++;
      for (let j = 0; j < hiddenSize; j++) {
        result[j] += lastHiddenState.data[i * hiddenSize + j];
      }
    }
  }

  if (validTokenCount > 0) {
    for (let j = 0; j < hiddenSize; j++) {
      result[j] /= validTokenCount;
    }
  }

  // L2 정규화
  let norm = 0;
  for (let j = 0; j < hiddenSize; j++) {
    norm += result[j] * result[j];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let j = 0; j < hiddenSize; j++) {
      result[j] /= norm;
    }
  }

  return result;
}

/**
 * 단일 텍스트 임베딩
 */
async function embedSingle(text: string): Promise<Float32Array> {
  if (!tokenizer || !model) {
    throw new Error('임베딩 엔진이 초기화되지 않았습니다.');
  }

  const inputs = await tokenizer(text, {
    padding: true,
    truncation: true,
    max_length: 128,
  });

  const outputs = await model(inputs);

  return meanPooling(
    outputs.last_hidden_state,
    inputs.attention_mask
  );
}

/**
 * 텍스트 임베딩 생성
 */
async function generateEmbeddings(text: string): Promise<EmbeddingResult[]> {
  if (!tokenizer || !model) {
    const initResult = await initEmbeddingEngine();
    if (!initResult.success) {
      throw new Error(initResult.error || '임베딩 엔진 초기화 실패');
    }
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return [];
  }

  const results: EmbeddingResult[] = [];

  for (const chunk of chunks) {
    try {
      const embedding = await embedSingle(chunk);
      results.push({
        embedding: Array.from(embedding), // Float32Array -> number[] (메시지 전송용)
        chunkText: chunk,
      });
    } catch (error) {
      console.error('[Offscreen] 청크 임베딩 실패:', chunk.slice(0, 50), error);
    }
  }

  return results;
}

/**
 * 쿼리 임베딩 생성
 */
async function generateQueryEmbedding(query: string): Promise<number[]> {
  if (!tokenizer || !model) {
    const initResult = await initEmbeddingEngine();
    if (!initResult.success) {
      throw new Error(initResult.error || '임베딩 엔진 초기화 실패');
    }
  }

  const embedding = await embedSingle(query);
  return Array.from(embedding);
}

/**
 * 엔진 상태 조회
 */
function getStatus() {
  return {
    isReady: tokenizer !== null && model !== null,
    isLoading,
    error: loadError?.message || null,
    modelId: MODEL_ID,
  };
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // target이 'offscreen'인 메시지만 처리
  if (message.target !== 'offscreen') {
    return false;
  }

  const { type, data } = message;

  switch (type) {
    case 'OFFSCREEN_INIT_EMBEDDING':
      initEmbeddingEngine().then(sendResponse);
      return true;

    case 'OFFSCREEN_GET_STATUS':
      sendResponse({ success: true, status: getStatus() });
      break;

    case 'OFFSCREEN_GENERATE_EMBEDDINGS':
      console.log('[Offscreen] OFFSCREEN_GENERATE_EMBEDDINGS 메시지 수신');
      (async () => {
        try {
          console.log('[Offscreen] 임베딩 생성 시작, 텍스트 길이:', data.text?.length || 0);
          const results = await generateEmbeddings(data.text);
          console.log('[Offscreen] 임베딩 생성 완료, 청크 수:', results.length);
          sendResponse({ success: true, embeddings: results });
        } catch (error) {
          console.error('[Offscreen] 임베딩 생성 실패:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;

    case 'OFFSCREEN_GENERATE_QUERY_EMBEDDING':
      (async () => {
        try {
          const embedding = await generateQueryEmbedding(data.query);
          sendResponse({ success: true, embedding });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
  }
});

console.log('[Offscreen] Document loaded');
