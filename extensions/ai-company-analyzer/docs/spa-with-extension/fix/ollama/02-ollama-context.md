# OllamaContext 설계

## 개요

Ollama 서버 연결 상태와 모델 관리를 담당하는 React Context입니다.

---

## 인터페이스 정의

### OllamaModel
```typescript
interface OllamaModel {
  name: string;           // "gemma3:latest"
  displayName: string;    // "gemma3"
  size: number;           // 바이트 단위
  sizeFormatted: string;  // "4.3GB"
  isVision: boolean;      // 멀티모달 지원 여부
  parameterSize?: string; // "4B"
}
```

### OllamaState
```typescript
interface OllamaState {
  // 연결 상태
  isConnected: boolean;
  isChecking: boolean;
  error?: string;

  // 설정
  endpoint: string;

  // 모델
  models: OllamaModel[];       // Vision 모델만 필터링됨
  selectedModel: string | null;
  isLoadingModels: boolean;
}
```

### ChatMessage (01-api-reference.md에서 정의)
```typescript
// 타입 정의는 @/lib/ai/types.ts에 위치
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface ChatOptions {
  num_ctx?: number;  // Context window 크기 (기본: 2048, 종합 분석 시 8192 권장)
}
```

### OllamaContextValue
```typescript
interface OllamaContextValue extends OllamaState {
  // 연결 관리
  checkConnection: () => Promise<boolean>;
  setEndpoint: (endpoint: string) => void;

  // 모델 관리
  fetchModels: () => Promise<void>;
  selectModel: (modelName: string) => void;

  // 채팅 API (options로 num_ctx 설정 가능)
  chat: (messages: ChatMessage[], options?: ChatOptions) => Promise<string>;
  analyzeImage: (imageBase64: string, prompt: string, options?: ChatOptions) => Promise<string>;
}
```

---

## 상태 흐름

```
┌─────────────────────────────────────────────────────────┐
│                    OllamaProvider                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐        │
│  │  idle    │────▶│ checking │────▶│ connected│        │
│  └──────────┘     └──────────┘     └──────────┘        │
│       │                │                 │              │
│       │                │                 ▼              │
│       │                │          ┌──────────┐         │
│       │                └─────────▶│  error   │         │
│       │                           └──────────┘         │
│       │                                                 │
│       ▼                                                 │
│  Settings에서 endpoint 변경 → 재연결 시도               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 구현 코드

### OllamaProvider
```typescript
// spa/src/contexts/OllamaContext.tsx

// React (첫 번째)
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

// 내부 모듈 (두 번째)
import { getSettings, saveSettings } from '@/lib/settings';

// 타입 (세 번째)
import type { ChatMessage, ChatOptions } from '@/lib/ai/types';

const OllamaContext = createContext<OllamaContextValue | null>(null);

export function OllamaProvider({ children }: { children: ReactNode }) {
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
      setState(prev => ({
        ...prev,
        isConnected: false,
        isChecking: false,
        error: 'Ollama 서버에 연결할 수 없습니다'
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
        (tagsData.models || []).map(async (m: any) => {
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
      setState(prev => ({
        ...prev,
        isLoadingModels: false,
        error: '모델 목록 조회 실패'
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

    const res = await fetch(`${state.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: state.selectedModel,
        messages,
        stream: false,
        options: options?.num_ctx ? { num_ctx: options.num_ctx } : undefined
      })
    });

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
      analyzeImage
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
```

### 유틸 함수
```typescript
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
```

---

## App.tsx 통합

```typescript
// spa/src/App.tsx

import { OllamaProvider } from '@/contexts/OllamaContext';

export default function App() {
  return (
    <BrowserRouter basename="/ai-company-analyzer">
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ExtensionProvider>
            <OllamaProvider>  {/* 추가 */}
              <ToastProvider>
                <AppRoutes />
              </ToastProvider>
            </OllamaProvider>
          </ExtensionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
```

---

## 사용 예시

### Settings 페이지
```typescript
function Settings() {
  const {
    endpoint, setEndpoint,
    isConnected, isChecking, error,
    models, selectedModel, selectModel,
    checkConnection
  } = useOllama();

  return (
    <div>
      <input value={endpoint} onChange={e => setEndpoint(e.target.value)} />
      <button onClick={checkConnection}>연결 테스트</button>
      <span>{isConnected ? '연결됨' : '연결 안됨'}</span>

      {models.map(model => (
        <label key={model.name}>
          <input
            type="radio"
            checked={selectedModel === model.name}
            onChange={() => selectModel(model.name)}
          />
          {model.displayName} ({model.sizeFormatted})
        </label>
      ))}
    </div>
  );
}
```

### Analysis 페이지
```typescript
function Analysis() {
  const { analyzeImage, isConnected, selectedModel } = useOllama();

  const handleAnalyze = async (imageBase64: string) => {
    const result = await analyzeImage(imageBase64, '이 이미지를 분석해주세요');
    console.log(result);
  };

  return (
    <button
      disabled={!isConnected || !selectedModel}
      onClick={() => handleAnalyze(imageData)}
    >
      분석 시작
    </button>
  );
}
```
