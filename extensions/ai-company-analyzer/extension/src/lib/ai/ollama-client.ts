/**
 * Ollama API 클라이언트
 * Extension Service Worker에서 Ollama API를 호출하기 위한 클라이언트
 */
import type { ChatMessage, StreamOptions, StreamChunk, StreamResult } from './types';
import { StreamBuffer, parseStreamLine } from './stream-parser';

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: Partial<StreamOptions> = {
  num_ctx: 16384,
  temperature: 0.3,
  num_predict: -1, // 무제한
  num_gpu: 999, // 전체 GPU 오프로드
  num_batch: 512,
  use_mmap: true,
  use_mlock: true,
  think: true,
  keepAlive: -1, // 메모리에 유지
};

// ============================================================================
// OllamaClient Class
// ============================================================================

export class OllamaClient {
  private endpoint: string;
  private model: string;

  constructor(endpoint: string, model: string) {
    this.endpoint = endpoint;
    this.model = model;
  }

  // ==========================================================================
  // Connection
  // ==========================================================================

  /**
   * Ollama 서버 연결 확인
   */
  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'GET',
      });
      const text = await res.text();
      return text === 'Ollama is running';
    } catch (error) {
      console.error('[OllamaClient] Connection check failed:', error);
      return false;
    }
  }

  /**
   * 사용 가능한 모델 목록 조회
   */
  async getModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`);
      const data = await res.json();
      return data.models?.map((m: { name: string }) => m.name) ?? [];
    } catch (error) {
      console.error('[OllamaClient] Failed to get models:', error);
      return [];
    }
  }

  // ==========================================================================
  // Image Analysis (Streaming)
  // ==========================================================================

  /**
   * 이미지 분석 (스트리밍)
   */
  async *analyzeImageStream(
    imageBase64: string,
    prompt: string,
    options: StreamOptions = {}
  ): AsyncGenerator<StreamChunk, StreamResult, unknown> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    const requestBody = this.buildRequestBody(
      [
        {
          role: 'user',
          content: prompt,
          images: [imageBase64],
        },
      ],
      mergedOptions,
      true // stream
    );

    try {
      const res = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: mergedOptions.abortSignal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Ollama API error: ${res.status} - ${errorText}`);
      }

      yield* this.processStream(res, mergedOptions);

      return {
        thinking: '',
        content: '',
        success: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OllamaClient] analyzeImageStream error:', message);

      return {
        thinking: '',
        content: '',
        success: false,
        error: message,
      };
    }
  }

  // ==========================================================================
  // Chat (Streaming)
  // ==========================================================================

  /**
   * 채팅 (스트리밍)
   */
  async *chatStream(
    messages: ChatMessage[],
    options: StreamOptions = {}
  ): AsyncGenerator<StreamChunk, StreamResult, unknown> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    const requestBody = this.buildRequestBody(messages, mergedOptions, true);

    try {
      const res = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: mergedOptions.abortSignal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Ollama API error: ${res.status} - ${errorText}`);
      }

      yield* this.processStream(res, mergedOptions);

      return {
        thinking: '',
        content: '',
        success: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OllamaClient] chatStream error:', message);

      return {
        thinking: '',
        content: '',
        success: false,
        error: message,
      };
    }
  }

  // ==========================================================================
  // Model Management
  // ==========================================================================

  /**
   * 모델 언로드 (VRAM 해제)
   */
  async unloadModel(): Promise<void> {
    try {
      await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [],
          keep_alive: 0,
        }),
      });
      console.log('[OllamaClient] Model unloaded');
    } catch (error) {
      console.error('[OllamaClient] Failed to unload model:', error);
    }
  }

  /**
   * 모델 변경
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * 엔드포인트 변경
   */
  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  /**
   * 현재 모델 조회
   */
  getModel(): string {
    return this.model;
  }

  /**
   * 현재 엔드포인트 조회
   */
  getEndpoint(): string {
    return this.endpoint;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * 요청 본문 생성
   */
  private buildRequestBody(
    messages: ChatMessage[],
    options: StreamOptions,
    stream: boolean
  ): Record<string, unknown> {
    const ollamaOptions: Record<string, number | boolean> = {};

    if (options.num_ctx) ollamaOptions.num_ctx = options.num_ctx;
    if (options.temperature !== undefined) ollamaOptions.temperature = options.temperature;
    if (options.num_predict !== undefined) ollamaOptions.num_predict = options.num_predict;
    if (options.num_gpu !== undefined) ollamaOptions.num_gpu = options.num_gpu;
    if (options.num_batch !== undefined) ollamaOptions.num_batch = options.num_batch;
    if (options.use_mmap !== undefined) ollamaOptions.use_mmap = options.use_mmap;
    if (options.use_mlock !== undefined) ollamaOptions.use_mlock = options.use_mlock;

    return {
      model: this.model,
      messages,
      stream,
      think: options.think,
      keep_alive: options.keepAlive,
      format: options.format,
      options: Object.keys(ollamaOptions).length > 0 ? ollamaOptions : undefined,
    };
  }

  /**
   * 스트림 처리
   */
  private async *processStream(
    res: Response,
    options: StreamOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const reader = res.body!.getReader();
    const buffer = new StreamBuffer();
    let accumulatedThinking = '';
    let accumulatedContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = buffer.append(value);
        for (const line of lines) {
          const parsed = parseStreamLine(line);
          if (!parsed) continue;

          if (parsed.thinking) {
            accumulatedThinking += parsed.thinking;
            options.onThinking?.(parsed.thinking, accumulatedThinking);
            yield {
              type: 'thinking',
              text: parsed.thinking,
              accumulated: {
                thinking: accumulatedThinking,
                content: accumulatedContent,
              },
            };
          }

          if (parsed.content) {
            accumulatedContent += parsed.content;
            options.onContent?.(parsed.content, accumulatedContent);
            yield {
              type: 'content',
              text: parsed.content,
              accumulated: {
                thinking: accumulatedThinking,
                content: accumulatedContent,
              },
            };
          }

          if (parsed.done) {
            yield {
              type: 'done',
              text: '',
              accumulated: {
                thinking: accumulatedThinking,
                content: accumulatedContent,
              },
            };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
