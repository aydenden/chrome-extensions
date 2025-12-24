/**
 * Analysis Context
 * Extension Service Worker와 Port 통신으로 분석 상태 관리
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type {
  AnalysisStatus,
  StartAnalysisPayload,
  StreamChunkPayload,
  ImageCompletePayload,
  AnalysisCompletePayload,
  SynthesisResult,
} from '@shared/types';
import { AnalysisPortConnection } from '@/lib/analysis-port';

// ============================================================================
// Types
// ============================================================================

/** 이미지 분석 스트리밍 상태 */
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

/** Context 값 타입 */
interface AnalysisContextValue {
  // 연결 상태
  isConnected: boolean;

  // 분석 상태
  status: AnalysisStatus;

  // 결과
  results: ImageCompletePayload[];
  synthesis: SynthesisResult | null;

  // 스트리밍
  streaming: StreamingState;
  synthesisStreaming: SynthesisStreamingState;

  // 진행률
  overallProgress: number;

  // 액션
  startAnalysis: (payload: StartAnalysisPayload) => void;
  abortAnalysis: () => void;
  retryFailed: () => void;
  getStatus: () => void;
  resetResults: () => void;
}

// ============================================================================
// Initial States
// ============================================================================

const INITIAL_STATUS: AnalysisStatus = {
  sessionId: '',
  companyId: '',
  companyName: '',
  step: 'idle',
  current: 0,
  total: 0,
  message: '분석 대기 중...',
  completedImageIds: [],
  failedImageIds: [],
};

const INITIAL_STREAMING: StreamingState = {
  currentImageId: null,
  phase: 'idle',
  thinkingText: '',
  contentText: '',
};

const INITIAL_SYNTHESIS_STREAMING: SynthesisStreamingState = {
  phase: 'idle',
  thinkingText: '',
  contentText: '',
};

// ============================================================================
// Context
// ============================================================================

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

interface AnalysisProviderProps {
  children: ReactNode;
  extensionId: string;
}

export function AnalysisProvider({ children, extensionId }: AnalysisProviderProps) {
  const connectionRef = useRef<AnalysisPortConnection | null>(null);

  // 상태
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<AnalysisStatus>(INITIAL_STATUS);
  const [results, setResults] = useState<ImageCompletePayload[]>([]);
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);
  const [streaming, setStreaming] = useState<StreamingState>(INITIAL_STREAMING);
  const [synthesisStreaming, setSynthesisStreaming] = useState<SynthesisStreamingState>(
    INITIAL_SYNTHESIS_STREAMING
  );

  // 스트리밍 throttle용 refs
  const streamingTextRef = useRef({ thinking: '', content: '', imageId: '' });
  const streamingUpdateRef = useRef<number | null>(null);
  const synthesisTextRef = useRef({ thinking: '', content: '' });
  const synthesisUpdateRef = useRef<number | null>(null);

  // ==========================================================================
  // Port 연결 및 이벤트 구독
  // ==========================================================================
  useEffect(() => {
    const connection = new AnalysisPortConnection(extensionId);
    connectionRef.current = connection;

    // 연결 상태 변경 리스너
    const unsubConnection = connection.onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        // 연결 시 상태 요청
        connection.sendCommand({ type: 'GET_STATUS' });
      }
    });

    // STATUS 이벤트
    const unsubStatus = connection.on('STATUS', (payload) => {
      setStatus(payload);
    });

    // STREAM_CHUNK 이벤트 (throttled)
    const unsubStreamChunk = connection.on('STREAM_CHUNK', (payload: StreamChunkPayload) => {
      if (payload.imageId) {
        // 이미지 분석 스트리밍
        if (streamingTextRef.current.imageId !== payload.imageId) {
          streamingTextRef.current = { thinking: '', content: '', imageId: payload.imageId };
        }

        if (payload.chunkType === 'thinking') {
          streamingTextRef.current.thinking = payload.accumulated.thinking;
        } else if (payload.chunkType === 'content') {
          streamingTextRef.current.content = payload.accumulated.content;
        }

        if (!streamingUpdateRef.current) {
          streamingUpdateRef.current = requestAnimationFrame(() => {
            setStreaming({
              currentImageId: streamingTextRef.current.imageId,
              phase: streamingTextRef.current.content ? 'content' : 'thinking',
              thinkingText: streamingTextRef.current.thinking,
              contentText: streamingTextRef.current.content,
            });
            streamingUpdateRef.current = null;
          });
        }
      } else {
        // 종합 분석 스트리밍
        if (payload.chunkType === 'thinking') {
          synthesisTextRef.current.thinking = payload.accumulated.thinking;
        } else if (payload.chunkType === 'content') {
          synthesisTextRef.current.content = payload.accumulated.content;
        }

        if (!synthesisUpdateRef.current) {
          synthesisUpdateRef.current = requestAnimationFrame(() => {
            setSynthesisStreaming({
              phase: synthesisTextRef.current.content ? 'content' : 'thinking',
              thinkingText: synthesisTextRef.current.thinking,
              contentText: synthesisTextRef.current.content,
            });
            synthesisUpdateRef.current = null;
          });
        }
      }
    });

    // IMAGE_COMPLETE 이벤트
    const unsubImageComplete = connection.on('IMAGE_COMPLETE', (payload: ImageCompletePayload) => {
      setResults((prev) => [...prev, payload]);
      setStreaming(INITIAL_STREAMING);
      streamingTextRef.current = { thinking: '', content: '', imageId: '' };
    });

    // SYNTHESIS_START 이벤트
    const unsubSynthesisStart = connection.on('SYNTHESIS_START', () => {
      setSynthesisStreaming(INITIAL_SYNTHESIS_STREAMING);
      synthesisTextRef.current = { thinking: '', content: '' };
    });

    // COMPLETE 이벤트
    const unsubComplete = connection.on('COMPLETE', (payload: AnalysisCompletePayload) => {
      setSynthesis(payload.synthesis);
      setSynthesisStreaming(INITIAL_SYNTHESIS_STREAMING);
      synthesisTextRef.current = { thinking: '', content: '' };
    });

    // ERROR 이벤트
    const unsubError = connection.on('ERROR', (payload) => {
      console.error('[AnalysisContext] Error:', payload.message);
    });

    // 연결 시작
    connection.connect();

    return () => {
      unsubConnection();
      unsubStatus();
      unsubStreamChunk();
      unsubImageComplete();
      unsubSynthesisStart();
      unsubComplete();
      unsubError();
      connection.disconnect();
    };
  }, [extensionId]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  const startAnalysis = useCallback((payload: StartAnalysisPayload) => {
    // 결과 초기화
    setResults([]);
    setSynthesis(null);
    setStreaming(INITIAL_STREAMING);
    setSynthesisStreaming(INITIAL_SYNTHESIS_STREAMING);
    streamingTextRef.current = { thinking: '', content: '', imageId: '' };
    synthesisTextRef.current = { thinking: '', content: '' };

    connectionRef.current?.sendCommand({ type: 'START_ANALYSIS', payload });
  }, []);

  const abortAnalysis = useCallback(() => {
    connectionRef.current?.sendCommand({ type: 'ABORT_ANALYSIS' });
  }, []);

  const retryFailed = useCallback(() => {
    connectionRef.current?.sendCommand({ type: 'RETRY_FAILED' });
  }, []);

  const getStatus = useCallback(() => {
    connectionRef.current?.sendCommand({ type: 'GET_STATUS' });
  }, []);

  const resetResults = useCallback(() => {
    setResults([]);
    setSynthesis(null);
    setStreaming(INITIAL_STREAMING);
    setSynthesisStreaming(INITIAL_SYNTHESIS_STREAMING);
  }, []);

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  const overallProgress = calculateProgress(status);

  return (
    <AnalysisContext.Provider
      value={{
        isConnected,
        status,
        results,
        synthesis,
        streaming,
        synthesisStreaming,
        overallProgress,
        startAnalysis,
        abortAnalysis,
        retryFailed,
        getStatus,
        resetResults,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useAnalysis(): AnalysisContextValue {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysis must be used within AnalysisProvider');
  }
  return context;
}

// ============================================================================
// Utilities
// ============================================================================

function calculateProgress(status: AnalysisStatus): number {
  const stepWeights: Record<string, number> = {
    idle: 0,
    'loading-images': 5,
    analyzing: 70,
    synthesizing: 85,
    saving: 95,
    done: 100,
    error: 0,
    paused: 0,
  };

  const base = stepWeights[status.step] ?? 0;

  if (status.step === 'analyzing' && status.total > 0) {
    return 5 + (status.current / status.total) * 70;
  }

  return base;
}
