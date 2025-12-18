# Settings 페이지 UI 설계

## 개요

Ollama 전용으로 Settings 페이지를 개편합니다. 기존 AI 엔진 선택(Qwen3/Ollama)과 OCR 설정을 제거하고, Ollama 연결 및 모델 선택 UI로 대체합니다.

---

## 와이어프레임

```
┌─────────────────────────────────────────────────────────────┐
│  설정                                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Ollama 연결                                         │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                      │    │
│  │  엔드포인트                                          │    │
│  │  ┌─────────────────────────────────────┐            │    │
│  │  │ http://localhost:11434              │            │    │
│  │  └─────────────────────────────────────┘            │    │
│  │                                                      │    │
│  │  상태: ● 연결됨                    [연결 테스트]     │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  모델 선택                                           │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                      │    │
│  │  Vision 모델만 표시됩니다 (이미지 분석 지원)         │    │
│  │                                                      │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │ ● gemma3:latest (4.3GB)                     │    │    │
│  │  │   4B 파라미터 • 한국어 지원                  │    │    │
│  │  ├─────────────────────────────────────────────┤    │    │
│  │  │ ○ llava:latest (4.1GB)                      │    │    │
│  │  │   7B 파라미터 • 이미지 분석 특화             │    │    │
│  │  ├─────────────────────────────────────────────┤    │    │
│  │  │ ○ llava:13b (8.0GB)                         │    │    │
│  │  │   13B 파라미터 • 고해상도 지원              │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │                                                      │    │
│  │  [새로고침]                                          │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  데이터 관리                                         │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                      │    │
│  │  저장된 회사: 5개                                    │    │
│  │  저장된 이미지: 23개                                 │    │
│  │                                                      │    │
│  │  [모든 데이터 삭제]                                  │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 상태별 UI

### 1. 연결 확인 중
```
상태: ◌ 확인 중...                    [연결 테스트] (비활성화)
```

### 2. 연결됨
```
상태: ● 연결됨                        [연결 테스트]
```

### 3. 연결 안됨
```
상태: ○ 연결 안됨                     [연결 테스트]
       Ollama 서버가 실행 중인지 확인하세요
```

### 4. 모델 없음
```
┌─────────────────────────────────────────────┐
│                                              │
│  Vision 모델이 설치되지 않았습니다           │
│                                              │
│  터미널에서 다음 명령어를 실행하세요:        │
│  $ ollama pull gemma3                        │
│                                              │
│  [새로고침]                                  │
│                                              │
└─────────────────────────────────────────────┘
```

---

## 컴포넌트 구조

### Settings.tsx
```typescript
// spa/src/pages/Settings.tsx

// React
import { useState } from 'react';

// 내부 모듈
import { PageHeader } from '@/components/layout';
import { Card, Button, Spinner } from '@/components/ui';
import { useOllama } from '@/contexts/OllamaContext';
import { cn } from '@/lib/utils';

// Pages는 default export 사용
export default function Settings() {
  const {
    endpoint, setEndpoint,
    isConnected, isChecking, error,
    models, selectedModel, selectModel, isLoadingModels,
    checkConnection, fetchModels
  } = useOllama();

  const [localEndpoint, setLocalEndpoint] = useState(endpoint);

  // 엔드포인트 변경 시 저장 및 재연결
  const handleEndpointSave = () => {
    setEndpoint(localEndpoint);
    checkConnection();
  };

  return (
    <>
      <PageHeader title="설정" />

      <div className="editorial-grid gap-6">
        {/* Ollama 연결 */}
        <div className="col-span-12 lg:col-span-8">
          <OllamaConnectionCard
            endpoint={localEndpoint}
            onEndpointChange={setLocalEndpoint}
            onEndpointSave={handleEndpointSave}
            isConnected={isConnected}
            isChecking={isChecking}
            error={error}
            onCheckConnection={checkConnection}
          />
        </div>

        {/* 모델 선택 */}
        <div className="col-span-12 lg:col-span-8">
          <ModelSelectionCard
            models={models}
            selectedModel={selectedModel}
            onSelectModel={selectModel}
            isLoading={isLoadingModels}
            onRefresh={fetchModels}
            isConnected={isConnected}
          />
        </div>

        {/* 데이터 관리 - 기존 컴포넌트 재사용 */}
        <div className="col-span-12 lg:col-span-8">
          <DataManagementCard />
        </div>
      </div>
    </>
  );
}
```

### OllamaConnectionCard
```typescript
// Settings.tsx 내부 또는 별도 파일로 분리 가능

interface OllamaConnectionCardProps {
  endpoint: string;
  onEndpointChange: (value: string) => void;
  onEndpointSave: () => void;
  isConnected: boolean;
  isChecking: boolean;
  error?: string;
  onCheckConnection: () => void;
}

function OllamaConnectionCard({
  endpoint,
  onEndpointChange,
  onEndpointSave,
  isConnected,
  isChecking,
  error,
  onCheckConnection
}: OllamaConnectionCardProps) {
  return (
    <Card className="p-6">
      <h2 className="headline text-xl mb-4">Ollama 연결</h2>

      <div className="space-y-4">
        {/* 엔드포인트 입력 */}
        <div>
          <label className="text-sm text-ink-muted">엔드포인트</label>
          <input
            type="text"
            value={endpoint}
            onChange={e => onEndpointChange(e.target.value)}
            onBlur={onEndpointSave}
            className={cn(
              'w-full mt-1 px-3 py-2 border bg-surface-elevated',
              'focus:outline-none focus:ring-2 focus:ring-ink',
              error ? 'border-signal-negative' : 'border-border-subtle'
            )}
            placeholder="http://localhost:11434"
          />
        </div>

        {/* 상태 표시 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">상태:</span>
            {isChecking ? (
              <>
                <Spinner size="sm" />
                <span className="text-sm">확인 중...</span>
              </>
            ) : isConnected ? (
              <>
                <div className="w-2 h-2 rounded-full bg-signal-positive" />
                <span className="text-sm text-signal-positive">연결됨</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-signal-negative" />
                <span className="text-sm text-signal-negative">연결 안됨</span>
              </>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onCheckConnection}
            disabled={isChecking}
          >
            연결 테스트
          </Button>
        </div>

        {/* 에러 메시지 */}
        {error && !isChecking && (
          <p className="text-sm text-signal-negative">{error}</p>
        )}
      </div>
    </Card>
  );
}
```

### ModelSelectionCard
```typescript
// Settings.tsx 내부 또는 별도 파일로 분리 가능

import type { OllamaModel } from '@/contexts/OllamaContext';

interface ModelSelectionCardProps {
  models: OllamaModel[];
  selectedModel: string | null;
  onSelectModel: (name: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  isConnected: boolean;
}

function ModelSelectionCard({
  models,
  selectedModel,
  onSelectModel,
  isLoading,
  onRefresh,
  isConnected
}: ModelSelectionCardProps) {
  // 미연결 상태 early return
  if (!isConnected) {
    return (
      <Card className="p-6">
        <h2 className="headline text-xl mb-4">모델 선택</h2>
        <p className="text-center text-ink-muted py-8">
          Ollama에 연결하면 모델 목록이 표시됩니다
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="headline text-xl">모델 선택</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? <Spinner size="sm" /> : '새로고침'}
        </Button>
      </div>

      <p className="text-sm text-ink-muted mb-4">
        Vision 모델만 표시됩니다 (이미지 분석 지원)
      </p>

      {models.length === 0 ? (
        <div className="text-center py-8 bg-surface-sunken">
          <p className="text-ink-muted mb-2">Vision 모델이 설치되지 않았습니다</p>
          <code className="text-sm bg-surface-elevated px-2 py-1">
            ollama pull gemma3
          </code>
        </div>
      ) : (
        <div className="space-y-2">
          {models.map(model => (
            <label
              key={model.name}
              className={cn(
                'flex items-center p-3 border cursor-pointer transition-colors',
                selectedModel === model.name
                  ? 'border-ink bg-surface-elevated'
                  : 'border-border-subtle hover:bg-surface-sunken'
              )}
            >
              <input
                type="radio"
                name="model"
                checked={selectedModel === model.name}
                onChange={() => onSelectModel(model.name)}
                className="mr-3"
              />
              <div className="flex-1">
                <span className="font-semibold">{model.displayName}</span>
                <p className="text-sm text-ink-muted">
                  {model.sizeFormatted}
                  {model.parameterSize && ` • ${model.parameterSize} 파라미터`}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}
    </Card>
  );
}
```

---

## 삭제할 기존 UI

### 제거 항목
1. AI 엔진 선택 라디오 버튼 (Qwen3/Ollama)
2. OCR 언어 선택 드롭다운
3. Qwen3 관련 설명 텍스트

### 기존 코드 (삭제 대상)
```typescript
// 삭제: AI 엔진 선택
<div>
  <label>AI 엔진</label>
  <input type="radio" value="qwen3" />
  <input type="radio" value="ollama" />
</div>

// 삭제: OCR 설정
<div>
  <label>OCR 언어</label>
  <select>
    <option value="kor">한글</option>
    <option value="eng">영어</option>
    <option value="kor+eng">혼합</option>
  </select>
</div>
```

---

## 상태 저장

### settings.ts 변경
```typescript
// Before
interface AppSettings {
  aiEngine: 'qwen3' | 'ollama' | 'mock';
  ollamaEndpoint: string;
  ocrLanguage: 'kor' | 'eng' | 'kor+eng';
}

// After
interface AppSettings {
  ollamaEndpoint: string;
  ollamaModel: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: ''
};
```
