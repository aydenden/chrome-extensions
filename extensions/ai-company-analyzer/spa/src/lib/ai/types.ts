// ============================================================================
// Ollama Chat API Types
// ============================================================================

/** 채팅 메시지 타입 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];  // base64 인코딩된 이미지 배열
}

/** 채팅 옵션 타입 */
export interface ChatOptions {
  // 기본 옵션
  num_ctx?: number;      // Context window 크기 (기본: 2048)
  temperature?: number;  // 출력 랜덤성 (0~1, 낮을수록 빠르고 일관적, 권장: 0.3)
  num_predict?: number;  // 최대 출력 토큰 수 (권장: 512)
  format?: 'json' | object;  // Structured output: 'json' 또는 JSON Schema
  keepAlive?: number | string;  // 모델 메모리 유지 시간 (-1: 무한, 0: 즉시 언로드, "60m": 60분)

  // 성능 최적화 옵션
  num_gpu?: number;      // GPU 레이어 수 (999: 전체 GPU 오프로드, 0: CPU만 사용)
  num_batch?: number;    // 배치 크기 (기본: 512, 높을수록 빠름/메모리 증가)
  use_mmap?: boolean;    // 메모리 매핑 활성화 (기본: true)
  use_mlock?: boolean;   // 메모리 잠금 (RAM에 모델 고정, 스왑 방지)
}

/** 채팅 응답 타입 */
export interface ChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

// ============================================================================
// Streaming Types
// ============================================================================

/** 스트리밍 청크 타입 */
export interface StreamChunk {
  type: 'thinking' | 'content' | 'done';
  text: string;
  accumulated: {
    thinking: string;
    content: string;
  };
}

/** 스트리밍 옵션 타입 */
export interface StreamOptions extends ChatOptions {
  think?: boolean;  // thinking 모드 활성화 (기본: true)
  onThinking?: (text: string, accumulated: string) => void;
  onContent?: (text: string, accumulated: string) => void;
  abortSignal?: AbortSignal;
}

/** 스트리밍 결과 타입 */
export interface StreamResult {
  thinking: string;
  content: string;
  success: boolean;
  error?: string;
}
