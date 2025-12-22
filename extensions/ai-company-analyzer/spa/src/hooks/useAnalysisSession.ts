/**
 * AI 분석 세션 관리 훅
 * Analysis.tsx에서 상태 관리 로직 추출
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useOllama } from '@/contexts/OllamaContext';
import type { StreamChunk } from '@/lib/ai/types';
import {
  AnalysisOrchestrator,
  type StepProgress,
  type AnalysisResultItem,
  type SynthesisResult,
} from '@/lib/analysis';

// ============================================================================
// Types
// ============================================================================

/** 스트리밍 상태 (이미지 분석용) */
interface StreamingState {
  currentImageId: string | null;
  phase: 'idle' | 'thinking' | 'content';
  thinkingText: string;
  contentText: string;
}

/** 종합 분석 스트리밍 상태 */
interface SynthesisStreamingState {
  phase: 'idle' | 'thinking' | 'content';
  thinkingText: string;
  contentText: string;
}

/** 분석 세션 상태 */
interface AnalysisSessionState {
  isRunning: boolean;
  progress: StepProgress;
  results: AnalysisResultItem[];
  completedImageIds: Set<string>;
  failedImageIds: Set<string>;
  synthesis: SynthesisResult | null;
  error: string | null;
  streaming: StreamingState;
  synthesisStreaming: SynthesisStreamingState;
}

/** 초기 상태 */
const INITIAL_STATE: AnalysisSessionState = {
  isRunning: false,
  progress: {
    step: 'idle',
    current: 0,
    total: 0,
    message: '분석 대기 중...',
  },
  results: [],
  completedImageIds: new Set(),
  failedImageIds: new Set(),
  synthesis: null,
  error: null,
  streaming: {
    currentImageId: null,
    phase: 'idle',
    thinkingText: '',
    contentText: '',
  },
  synthesisStreaming: {
    phase: 'idle',
    thinkingText: '',
    contentText: '',
  },
};

/** 훅 옵션 */
export interface UseAnalysisSessionOptions {
  /** 스트리밍 사용 여부 (추후 구현) */
  useStreaming?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useAnalysisSession(options: UseAnalysisSessionOptions = {}) {
  const { useStreaming = true } = options;
  const { analyzeImage, analyzeImageStream, chat, chatStream, selectedModel, endpoint } = useOllama();

  // State
  const [state, setState] = useState<AnalysisSessionState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 스트리밍 텍스트 누적용 refs (리렌더링 없이 텍스트 누적)
  const streamingTextRef = useRef({ thinking: '', content: '', imageId: '' });
  const streamingUpdateRef = useRef<number | null>(null);
  const synthesisTextRef = useRef({ thinking: '', content: '' });
  const synthesisUpdateRef = useRef<number | null>(null);

  // ========================================================================
  // VRAM 해제 (세션 종료 시)
  // ========================================================================
  useEffect(() => {
    const handleUnload = () => {
      if (!selectedModel || !endpoint) return;
      // Beacon API로 비동기 요청 (탭 닫힘에도 전송 보장)
      navigator.sendBeacon(
        `${endpoint}/api/chat`,
        JSON.stringify({ model: selectedModel, messages: [], keep_alive: 0 })
      );
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [endpoint, selectedModel]);

  // ========================================================================
  // 진행 상태 업데이트
  // ========================================================================
  const updateProgress = useCallback((progress: StepProgress) => {
    setState((prev) => ({ ...prev, progress }));
  }, []);

  // ========================================================================
  // 이미지 분석 완료 콜백
  // ========================================================================
  const onImageComplete = useCallback((result: AnalysisResultItem) => {
    const isError = result.analysis.includes('"error"');

    setState((prev) => ({
      ...prev,
      results: [...prev.results, result],
      completedImageIds: isError
        ? prev.completedImageIds
        : new Set([...prev.completedImageIds, result.imageId]),
      failedImageIds: isError
        ? new Set([...prev.failedImageIds, result.imageId])
        : prev.failedImageIds,
      // 분석 완료 시 스트리밍 상태 초기화
      streaming: {
        currentImageId: null,
        phase: 'idle',
        thinkingText: '',
        contentText: '',
      },
    }));
  }, []);

  // ========================================================================
  // 스트리밍 청크 콜백 (throttle 적용)
  // ========================================================================
  const onStreamChunk = useCallback((imageId: string, chunk: StreamChunk) => {
    // 새 이미지 시작 시 ref 초기화
    if (streamingTextRef.current.imageId !== imageId) {
      streamingTextRef.current = { thinking: '', content: '', imageId };
    }

    // ref에 텍스트 누적 (즉시, 리렌더링 없음)
    if (chunk.type === 'thinking') {
      streamingTextRef.current.thinking += chunk.text;
    } else if (chunk.type === 'content') {
      streamingTextRef.current.content += chunk.text;
    }

    // requestAnimationFrame throttle (프레임 단위로 업데이트)
    if (!streamingUpdateRef.current) {
      streamingUpdateRef.current = requestAnimationFrame(() => {
        setState((prev) => ({
          ...prev,
          streaming: {
            currentImageId: imageId,
            phase: chunk.type === 'done' ? 'idle' : (streamingTextRef.current.content ? 'content' : 'thinking'),
            thinkingText: streamingTextRef.current.thinking,
            contentText: streamingTextRef.current.content,
          },
        }));
        streamingUpdateRef.current = null;
      });
    }
  }, []);

  // ========================================================================
  // 종합 분석 스트리밍 청크 콜백 (throttle 적용)
  // ========================================================================
  const onSynthesisStreamChunk = useCallback((chunk: StreamChunk) => {
    // ref에 텍스트 누적 (즉시, 리렌더링 없음)
    if (chunk.type === 'thinking') {
      synthesisTextRef.current.thinking += chunk.text;
    } else if (chunk.type === 'content') {
      synthesisTextRef.current.content += chunk.text;
    } else if (chunk.type === 'done') {
      // done 시 ref 초기화
      synthesisTextRef.current = { thinking: '', content: '' };
      setState((prev) => ({
        ...prev,
        synthesisStreaming: {
          phase: 'idle',
          thinkingText: '',
          contentText: '',
        },
      }));
      return;
    }

    // requestAnimationFrame throttle (프레임 단위로 업데이트)
    if (!synthesisUpdateRef.current) {
      synthesisUpdateRef.current = requestAnimationFrame(() => {
        setState((prev) => ({
          ...prev,
          synthesisStreaming: {
            phase: synthesisTextRef.current.content ? 'content' : 'thinking',
            thinkingText: synthesisTextRef.current.thinking,
            contentText: synthesisTextRef.current.content,
          },
        }));
        synthesisUpdateRef.current = null;
      });
    }
  }, []);

  // ========================================================================
  // 전체 진행률 계산
  // ========================================================================
  const calculateOverallProgress = useCallback((): number => {
    const { step, current, total } = state.progress;

    const stepWeights: Record<string, number> = {
      idle: 0,
      'loading-images': 5,
      analyzing: 70,
      synthesizing: 15,
      saving: 10,
      done: 100,
      error: 0,
    };

    const baseProgress = stepWeights[step] ?? 0;

    if (step === 'analyzing' && total > 0) {
      return 5 + (current / total) * 70;
    }

    return baseProgress;
  }, [state.progress]);

  // ========================================================================
  // 분석 시작
  // ========================================================================
  const startAnalysis = useCallback(
    async (companyId: string, companyName: string, imageIds: string[]) => {
      if (!selectedModel || !endpoint) {
        setState((prev) => ({
          ...prev,
          error: '모델이 선택되지 않았습니다',
        }));
        return;
      }

      if (imageIds.length === 0) {
        setState((prev) => ({
          ...prev,
          error: '분석할 이미지가 없습니다',
        }));
        return;
      }

      // 상태 초기화
      setState({
        isRunning: true,
        progress: { step: 'idle', current: 0, total: 0, message: '분석 시작...' },
        results: [],
        completedImageIds: new Set(),
        failedImageIds: new Set(),
        synthesis: null,
        error: null,
        streaming: {
          currentImageId: null,
          phase: 'idle',
          thinkingText: '',
          contentText: '',
        },
        synthesisStreaming: {
          phase: 'idle',
          thinkingText: '',
          contentText: '',
        },
      });

      abortControllerRef.current = new AbortController();

      const orchestrator = new AnalysisOrchestrator({
        analyzeImage,
        analyzeImageStream,
        chat,
        chatStream,
        selectedModel,
        endpoint,
      });

      try {
        const result = await orchestrator.run(companyId, companyName, imageIds, {
          useStreaming,
          onProgress: updateProgress,
          onImageComplete,
          onStreamChunk,
          onSynthesisStreamChunk,
          abortSignal: abortControllerRef.current.signal,
        });

        setState((prev) => ({
          ...prev,
          isRunning: false,
          synthesis: result.synthesis,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : '알 수 없는 오류';

        // AbortError는 사용자 중단이므로 별도 처리
        if (error instanceof DOMException && error.name === 'AbortError') {
          setState((prev) => ({
            ...prev,
            isRunning: false,
            progress: {
              step: 'error',
              current: 0,
              total: 0,
              message: '사용자가 중단함',
            },
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isRunning: false,
            progress: { step: 'error', current: 0, total: 0, message },
            error: message,
          }));
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [selectedModel, endpoint, analyzeImage, analyzeImageStream, chat, chatStream, useStreaming, updateProgress, onImageComplete, onStreamChunk, onSynthesisStreamChunk]
  );

  // ========================================================================
  // 분석 중단
  // ========================================================================
  const stopAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // ========================================================================
  // 상태 리셋
  // ========================================================================
  const resetSession = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    // 상태
    isRunning: state.isRunning,
    progress: state.progress,
    results: state.results,
    completedImageIds: state.completedImageIds,
    failedImageIds: state.failedImageIds,
    synthesis: state.synthesis,
    error: state.error,
    streaming: state.streaming,
    synthesisStreaming: state.synthesisStreaming,

    // 계산된 값
    overallProgress: calculateOverallProgress(),

    // 액션
    startAnalysis,
    stopAnalysis,
    resetSession,
  };
}
