export type ErrorCode =
  | 'EXTENSION_ERROR'
  | 'AI_ENGINE_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

/** 기본 앱 에러 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Extension 연결 에러 */
export class ExtensionError extends AppError {
  constructor(message: string) {
    super(message, 'EXTENSION_ERROR', false);
    this.name = 'ExtensionError';
  }
}

/** AI 엔진 에러 */
export class AIEngineError extends AppError {
  constructor(message: string, public engine: string) {
    super(message, 'AI_ENGINE_ERROR', true);
    this.name = 'AIEngineError';
  }
}

/** 유효성 검증 에러 */
export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', true);
    this.name = 'ValidationError';
  }
}
