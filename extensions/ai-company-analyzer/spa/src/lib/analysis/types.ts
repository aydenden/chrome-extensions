/**
 * AI 분석 관련 타입 정의
 */
import type { ImageSubCategory } from '@shared/constants/categories';

// ============================================================================
// 분석 단계
// ============================================================================

/** 분석 진행 단계 */
export type AnalysisStep =
  | 'idle'
  | 'loading-images'
  | 'analyzing'
  | 'synthesizing'
  | 'saving'
  | 'done'
  | 'error';

// ============================================================================
// 진행 상태
// ============================================================================

/** 단계별 진행 상태 */
export interface StepProgress {
  step: AnalysisStep;
  current: number;
  total: number;
  message: string;
  /** 현재 분석 중인 이미지 ID (스트리밍용) */
  currentImageId?: string;
  /** 스트리밍 중인 텍스트 (스트리밍용) */
  streamingText?: string;
}

// ============================================================================
// 분석 결과
// ============================================================================

/** 개별 이미지 분석 결과 (저장용) */
export interface AnalysisResultItem {
  imageId: string;
  category: ImageSubCategory;
  rawText: string;
  analysis: string; // JSON 문자열
  thinking?: string; // 스트리밍 시 thinking 내용
}

/** 개별 이미지 분석 결과 (내부 처리용) */
export interface ImageAnalysisResult {
  imageId: string;
  category: ImageSubCategory;
  rawText: string;
  analysis: object;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  error?: string;
}

// ============================================================================
// 분석 세션 상태
// ============================================================================

/** 분석 세션 전체 상태 */
export interface AnalysisSessionState {
  isRunning: boolean;
  progress: StepProgress;
  results: AnalysisResultItem[];
  completedImageIds: Set<string>;
  failedImageIds: Set<string>;
  synthesis: import('./synthesis').SynthesisResult | null;
  error: string | null;
}

// ============================================================================
// 분석 옵션
// ============================================================================

/** 분석 실행 옵션 */
export interface AnalysisOptions {
  /** 스트리밍 사용 여부 */
  useStreaming?: boolean;
  /** 진행 상태 콜백 */
  onProgress?: (progress: StepProgress) => void;
  /** 이미지 분석 완료 콜백 */
  onImageComplete?: (result: AnalysisResultItem) => void;
  /** 스트리밍 청크 콜백 (이미지 분석용) */
  onStreamChunk?: (imageId: string, chunk: import('@/lib/ai/types').StreamChunk) => void;
  /** 종합 분석 스트리밍 청크 콜백 */
  onSynthesisStreamChunk?: (chunk: import('@/lib/ai/types').StreamChunk) => void;
  /** 중단 시그널 */
  abortSignal?: AbortSignal;
}

// ============================================================================
// Orchestrator 결과
// ============================================================================

/** Orchestrator 실행 결과 */
export interface OrchestratorResult {
  results: AnalysisResultItem[];
  synthesis: import('./synthesis').SynthesisResult | null;
  savedCount: number;
  failedCount: number;
}

// ============================================================================
// 로드된 이미지
// ============================================================================

/** 로드 및 최적화된 이미지 */
export interface LoadedImage {
  id: string;
  base64: string;
}
