/**
 * AI 분석 모듈 (타입 정의만)
 *
 * Note: 실제 분석 로직은 Extension Service Worker에서 수행
 * SPA는 AnalysisContext를 통해 Port 기반으로 통신
 */

// Types
export type {
  AnalysisStep,
  StepProgress,
  AnalysisResultItem,
  ImageAnalysisResult,
  AnalysisSessionState,
  LoadedImage,
  SynthesisResult,
} from './types';
