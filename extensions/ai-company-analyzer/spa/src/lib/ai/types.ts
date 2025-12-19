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
  num_ctx?: number;      // Context window 크기 (기본: 2048)
  temperature?: number;  // 출력 랜덤성 (0~1, 낮을수록 빠르고 일관적, 권장: 0.3)
  num_predict?: number;  // 최대 출력 토큰 수 (권장: 512)
  format?: 'json' | object;  // Structured output: 'json' 또는 JSON Schema
  keepAlive?: number | string;  // 모델 메모리 유지 시간 (-1: 무한, 0: 즉시 언로드, "60m": 60분)
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
