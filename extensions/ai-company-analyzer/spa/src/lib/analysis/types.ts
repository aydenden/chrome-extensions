/**
 * AI 분석 관련 타입 정의 (UI용)
 *
 * Note: 실제 분석은 Extension Service Worker에서 수행
 * 이 타입들은 UI 렌더링 및 상태 표시용으로만 사용
 */
import type { ImageSubCategory } from '@shared/constants/categories';
import type { SynthesisResult, AnalysisStep as SharedAnalysisStep } from '@shared/types';

// ============================================================================
// Re-export from shared
// ============================================================================

export type { SynthesisResult };
export type AnalysisStep = SharedAnalysisStep;

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
  synthesis: SynthesisResult | null;
  error: string | null;
}

// ============================================================================
// 로드된 이미지
// ============================================================================

/** 로드 및 최적화된 이미지 */
export interface LoadedImage {
  id: string;
  base64: string;
  /** 이미지별 메모 (분석 프롬프트에 사용) */
  memo?: string;
}
