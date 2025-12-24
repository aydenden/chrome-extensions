/**
 * OllamaContext
 * Ollama 연결 상태 및 모델 선택 관리
 *
 * Note: AI 분석(chat, analyzeImage 등)은 Extension Service Worker에서 수행
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { getSettings, saveSettings } from '@/lib/settings';

// ============================================================================
// Types
// ============================================================================

export interface OllamaModel {
  name: string;           // "gemma3:latest"
  displayName: string;    // "gemma3"
  size: number;           // 바이트 단위
  sizeFormatted: string;  // "4.3GB"
  isVision: boolean;      // 멀티모달 지원 여부
  parameterSize?: string; // "4B"
}

interface OllamaState {
  isConnected: boolean;
  isChecking: boolean;
  error?: string;
  endpoint: string;
  models: OllamaModel[];
  selectedModel: string | null;
  isLoadingModels: boolean;
}

interface OllamaContextValue extends OllamaState {
  checkConnection: () => Promise<boolean>;
  setEndpoint: (endpoint: string) => void;
  fetchModels: () => Promise<void>;
  selectModel: (modelName: string) => void;
  unloadModel: () => Promise<void>;
}

// ============================================================================
// Utils
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ============================================================================
// Context
// ============================================================================

const OllamaContext = createContext<OllamaContextValue | null>(null);

interface OllamaProviderProps {
  children: ReactNode;
}

export function OllamaProvider({ children }: OllamaProviderProps) {
  const settings = getSettings();

  const [state, setState] = useState<OllamaState>({
    isConnected: false,
    isChecking: true,
    endpoint: settings.ollamaEndpoint,
    models: [],
    selectedModel: settings.ollamaModel || null,
    isLoadingModels: false,
  });

  // 연결 확인
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isChecking: true, error: undefined }));

    try {
      const res = await fetch(state.endpoint);
      const text = await res.text();
      const connected = text === 'Ollama is running';

      setState(prev => ({
        ...prev,
        isConnected: connected,
        isChecking: false,
        error: connected ? undefined : 'Ollama 응답이 올바르지 않습니다'
      }));

      return connected;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ollama 서버에 연결할 수 없습니다';
      setState(prev => ({
        ...prev,
        isConnected: false,
        isChecking: false,
        error: message
      }));
      return false;
    }
  }, [state.endpoint]);

  // 엔드포인트 변경
  const setEndpoint = useCallback((endpoint: string) => {
    setState(prev => ({ ...prev, endpoint, isConnected: false }));
    saveSettings({ ...getSettings(), ollamaEndpoint: endpoint });
  }, []);

  // Vision 모델 목록 조회
  const fetchModels = useCallback(async () => {
    if (!state.isConnected) return;

    setState(prev => ({ ...prev, isLoadingModels: true }));

    try {
      // 1. 전체 모델 목록 조회
      const tagsRes = await fetch(`${state.endpoint}/api/tags`);
      const tagsData = await tagsRes.json();

      // 2. 각 모델의 Vision 지원 여부 확인
      const modelsWithCapabilities = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tagsData.models || []).map(async (m: any) => {
          try {
            const showRes = await fetch(`${state.endpoint}/api/show`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: m.name })
            });
            const showData = await showRes.json();

            const isVision = showData.capabilities?.includes('vision') ?? false;

            return {
              name: m.name,
              displayName: m.name.split(':')[0],
              size: m.size,
              sizeFormatted: formatBytes(m.size),
              isVision,
              parameterSize: showData.details?.parameter_size
            };
          } catch {
            // 모델 상세 조회 실패 시 기본값
            return {
              name: m.name,
              displayName: m.name.split(':')[0],
              size: m.size,
              sizeFormatted: formatBytes(m.size),
              isVision: false,
              parameterSize: undefined
            };
          }
        })
      );

      // 3. Vision 모델만 필터링
      const visionModels = modelsWithCapabilities.filter(m => m.isVision);

      setState(prev => ({
        ...prev,
        models: visionModels,
        isLoadingModels: false
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : '모델 목록 조회 실패';
      setState(prev => ({
        ...prev,
        isLoadingModels: false,
        error: message
      }));
    }
  }, [state.isConnected, state.endpoint]);

  // 모델 선택
  const selectModel = useCallback((modelName: string) => {
    setState(prev => ({ ...prev, selectedModel: modelName }));
    saveSettings({ ...getSettings(), ollamaModel: modelName });
  }, []);

  // 모델 언로드 (세션 종료 시 VRAM 해제)
  const unloadModel = useCallback(async () => {
    if (!state.selectedModel) return;

    try {
      await fetch(`${state.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: state.selectedModel,
          messages: [],
          keep_alive: 0
        })
      });
    } catch {
      // 언로드 실패해도 무시 (서버가 이미 꺼져 있을 수 있음)
    }
  }, [state.endpoint, state.selectedModel]);

  // 초기 연결 확인
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // 연결 성공 시 모델 목록 조회
  useEffect(() => {
    if (state.isConnected) {
      fetchModels();
    }
  }, [state.isConnected, fetchModels]);

  return (
    <OllamaContext.Provider value={{
      ...state,
      checkConnection,
      setEndpoint,
      fetchModels,
      selectModel,
      unloadModel
    }}>
      {children}
    </OllamaContext.Provider>
  );
}

export function useOllama(): OllamaContextValue {
  const context = useContext(OllamaContext);
  if (!context) throw new Error('useOllama must be used within OllamaProvider');
  return context;
}
