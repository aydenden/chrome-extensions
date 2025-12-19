import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { getSettings, saveSettings } from '@/lib/settings';
import type { ChatMessage, ChatOptions } from '@/lib/ai/types';

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
  chat: (messages: ChatMessage[], options?: ChatOptions) => Promise<string>;
  analyzeImage: (imageBase64: string, prompt: string, options?: ChatOptions) => Promise<string>;
  analyzeImageStream: (imageBase64: string, prompt: string, options?: ChatOptions) => AsyncGenerator<string, void, unknown>;
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

  // 채팅 (options.num_ctx로 context window 크기 조절 가능)
  const chat = useCallback(async (
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<string> => {
    if (!state.selectedModel) throw new Error('모델이 선택되지 않았습니다');

    // 옵션 구성 (설정된 값만 포함)
    const ollamaOptions: Record<string, number | boolean> = {};
    // 기본 옵션
    if (options?.num_ctx) ollamaOptions.num_ctx = options.num_ctx;
    if (options?.temperature !== undefined) ollamaOptions.temperature = options.temperature;
    if (options?.num_predict) ollamaOptions.num_predict = options.num_predict;
    // 성능 최적화 옵션
    if (options?.num_gpu !== undefined) ollamaOptions.num_gpu = options.num_gpu;
    if (options?.num_batch !== undefined) ollamaOptions.num_batch = options.num_batch;
    if (options?.use_mmap !== undefined) ollamaOptions.use_mmap = options.use_mmap;
    if (options?.use_mlock !== undefined) ollamaOptions.use_mlock = options.use_mlock;

    const res = await fetch(`${state.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: state.selectedModel,
        messages,
        stream: false,
        format: options?.format,  // Structured output (JSON Schema)
        keep_alive: options?.keepAlive ?? -1,  // 기본 무기한 메모리 유지
        options: Object.keys(ollamaOptions).length > 0 ? ollamaOptions : undefined
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama API 오류: ${res.status}`);
    }

    const data = await res.json();
    return data.message.content;
  }, [state.endpoint, state.selectedModel]);

  // 이미지 분석 (종합 분석 시 num_ctx: 8192 권장)
  const analyzeImage = useCallback(async (
    imageBase64: string,
    prompt: string,
    options?: ChatOptions
  ): Promise<string> => {
    return chat([{
      role: 'user',
      content: prompt,
      images: [imageBase64]
    }], options);
  }, [chat]);

  // 이미지 분석 (스트리밍) - 토큰 단위로 실시간 반환
  const analyzeImageStream = useCallback(async function* (
    imageBase64: string,
    prompt: string,
    options?: ChatOptions
  ): AsyncGenerator<string, void, unknown> {
    if (!state.selectedModel) throw new Error('모델이 선택되지 않았습니다');

    const ollamaOptions: Record<string, number | boolean> = {};
    // 기본 옵션
    if (options?.num_ctx) ollamaOptions.num_ctx = options.num_ctx;
    if (options?.temperature !== undefined) ollamaOptions.temperature = options.temperature;
    if (options?.num_predict) ollamaOptions.num_predict = options.num_predict;
    // 성능 최적화 옵션
    if (options?.num_gpu !== undefined) ollamaOptions.num_gpu = options.num_gpu;
    if (options?.num_batch !== undefined) ollamaOptions.num_batch = options.num_batch;
    if (options?.use_mmap !== undefined) ollamaOptions.use_mmap = options.use_mmap;
    if (options?.use_mlock !== undefined) ollamaOptions.use_mlock = options.use_mlock;

    const res = await fetch(`${state.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: state.selectedModel,
        messages: [{
          role: 'user',
          content: prompt,
          images: [imageBase64]
        }],
        stream: true,
        format: options?.format,
        keep_alive: options?.keepAlive ?? -1,
        options: Object.keys(ollamaOptions).length > 0 ? ollamaOptions : undefined
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama API 오류: ${res.status}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            yield json.message.content;
          }
        } catch {
          // JSON 파싱 실패 시 무시
        }
      }
    }
  }, [state.endpoint, state.selectedModel]);

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
      chat,
      analyzeImage,
      analyzeImageStream,
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
