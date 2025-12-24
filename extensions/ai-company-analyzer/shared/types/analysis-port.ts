/**
 * Port 기반 분석 통신 프로토콜 타입 정의
 * SPA ↔ Extension Service Worker 간 양방향 통신
 */
import type { ImageSubCategory } from '../constants/categories';

// ============================================================================
// Constants
// ============================================================================

export const ANALYSIS_PORT_NAME = 'analysis-stream';

// ============================================================================
// Session State
// ============================================================================

export type AnalysisStep =
  | 'idle'
  | 'loading-images'
  | 'analyzing'
  | 'synthesizing'
  | 'saving'
  | 'paused'
  | 'done'
  | 'error';

export interface AnalysisStatus {
  sessionId: string;
  companyId: string;
  companyName: string;
  step: AnalysisStep;
  current: number;
  total: number;
  message: string;
  currentImageId?: string;
  completedImageIds: string[];
  failedImageIds: string[];
  error?: string;
}

// ============================================================================
// SPA -> Extension Commands
// ============================================================================

export interface StartAnalysisPayload {
  companyId: string;
  companyName: string;
  imageIds: string[];
  analysisContext?: string;
  promptSettings?: {
    imageAnalysis?: string;
    synthesis?: string;
  };
}

export type AnalysisCommand =
  | { type: 'START_ANALYSIS'; payload: StartAnalysisPayload }
  | { type: 'ABORT_ANALYSIS' }
  | { type: 'GET_STATUS' }
  | { type: 'RETRY_FAILED' };

// ============================================================================
// Extension -> SPA Events
// ============================================================================

export interface StreamChunkPayload {
  imageId?: string; // undefined면 synthesis
  chunkType: 'thinking' | 'content';
  text: string;
  accumulated: {
    thinking: string;
    content: string;
  };
}

export interface ImageCompletePayload {
  imageId: string;
  category: ImageSubCategory;
  rawText: string;
  analysis: string;
  success: boolean;
  error?: string;
}

export interface SynthesisResult {
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: 'recommend' | 'neutral' | 'not_recommend';
  reasoning: string;
}

export interface AnalysisCompletePayload {
  results: ImageCompletePayload[];
  synthesis: SynthesisResult | null;
  savedCount: number;
  failedCount: number;
}

export type AnalysisEvent =
  | { type: 'STATUS'; payload: AnalysisStatus }
  | { type: 'STREAM_CHUNK'; payload: StreamChunkPayload }
  | { type: 'IMAGE_COMPLETE'; payload: ImageCompletePayload }
  | { type: 'SYNTHESIS_START' }
  | { type: 'COMPLETE'; payload: AnalysisCompletePayload }
  | { type: 'ERROR'; payload: { message: string; recoverable: boolean } };

// ============================================================================
// Utility Types
// ============================================================================

/** 이벤트 타입에서 payload 추출 */
export type AnalysisEventPayload<T extends AnalysisEvent['type']> = Extract<
  AnalysisEvent,
  { type: T }
> extends { payload: infer P }
  ? P
  : never;

/** 명령 타입에서 payload 추출 */
export type AnalysisCommandPayload<T extends AnalysisCommand['type']> = Extract<
  AnalysisCommand,
  { type: T }
> extends { payload: infer P }
  ? P
  : never;
