# Header Ollama 상태 표시

## 개요

Extension 연결 상태 옆에 Ollama 연결 상태를 표시합니다. 사용자가 어디서든 Ollama 상태를 확인할 수 있습니다.

---

## 와이어프레임

### 현재 (Extension만)
```
┌──────────────────────────────────────────────────────────────┐
│  AI COMPANY ANALYZER                        Extension ●  ⚙  │
└──────────────────────────────────────────────────────────────┘
```

### 변경 후 (Extension + Ollama)
```
┌──────────────────────────────────────────────────────────────┐
│  AI COMPANY ANALYZER              Extension ●  Ollama ●  ⚙  │
└──────────────────────────────────────────────────────────────┘
```

---

## 상태별 표시

| Extension | Ollama | 표시 |
|-----------|--------|------|
| 연결됨 | 연결됨 | Extension ● Ollama ● |
| 연결됨 | 연결 안됨 | Extension ● Ollama ○ |
| 연결됨 | 확인 중 | Extension ● Ollama ◌ |
| 연결 안됨 | - | Extension ○ |

---

## 컴포넌트 구조

### Header.tsx 수정

```typescript
// spa/src/components/layout/Header.tsx

// React
import { Link } from 'react-router-dom';

// 내부 모듈
import { useOllama } from '@/contexts/OllamaContext';
import { cn } from '@/lib/utils';

// 아이콘 (lucide-react 또는 heroicons)
import { Settings as SettingsIcon } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;  // Extension 연결
}

// Layout 컴포넌트는 default export 사용
export default function Header({ isConnected }: HeaderProps) {
  const { isConnected: ollamaConnected, isChecking: ollamaChecking } = useOllama();

  return (
    <header className="sticky top-0 z-50 bg-paper border-b border-border-subtle">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* 로고 */}
        <Link to="/" className="flex items-center gap-2">
          <span className="headline text-lg">AI COMPANY ANALYZER</span>
        </Link>

        {/* 상태 표시 영역 */}
        <div className="flex items-center gap-4">
          {/* Extension 상태 */}
          <StatusIndicator
            label="Extension"
            status={isConnected ? 'ready' : 'error'}
          />

          {/* Ollama 상태 */}
          <StatusIndicator
            label="Ollama"
            status={
              ollamaChecking ? 'loading' :
              ollamaConnected ? 'ready' : 'error'
            }
          />

          {/* 설정 버튼 */}
          <Link
            to="/settings"
            className="p-2 hover:bg-surface-sunken rounded transition-colors"
          >
            <SettingsIcon className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
```

### StatusIndicator 컴포넌트

```typescript
// Header.tsx 내부에 정의 (별도 파일로 분리해도 됨)

type StatusType = 'ready' | 'loading' | 'error' | 'idle';

interface StatusIndicatorProps {
  label: string;
  status: StatusType;
}

// 상태별 스타일 맵
const statusStyles: Record<StatusType, string> = {
  ready: 'bg-signal-positive',
  loading: 'bg-highlight-yellow animate-pulse',
  error: 'bg-signal-negative',
  idle: 'bg-ink-muted'
};

function StatusIndicator({ label, status }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-ink-muted hidden md:inline">{label}</span>
      <div className={cn('w-2 h-2 rounded-full', statusStyles[status])} />
    </div>
  );
}
```

---

## Layout 수정

### Layout.tsx

```typescript
// spa/src/components/layout/Layout.tsx

// React
import type { ReactNode } from 'react';

// 내부 모듈
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
  isConnected: boolean;  // Extension 연결 상태
}

// Layout 컴포넌트는 default export 사용
export default function Layout({ children, isConnected }: LayoutProps) {
  return (
    <div className="min-h-screen bg-paper">
      <Header isConnected={isConnected} />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
```

---

## 클릭 동작

### Ollama 상태 클릭 시
Ollama 상태 아이콘 클릭 시 Settings 페이지로 이동 (선택적 기능)

```typescript
<Link to="/settings" className="flex items-center gap-1.5 hover:opacity-80">
  <span className="text-xs text-ink-muted">Ollama</span>
  <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
</Link>
```

---

## 툴팁 (선택적)

호버 시 상세 정보 표시:

```typescript
<div className="relative group">
  <StatusIndicator label="Ollama" status={status} />

  {/* 툴팁 */}
  <div className="absolute top-full right-0 mt-1 hidden group-hover:block">
    <div className="bg-ink text-paper text-xs px-2 py-1 whitespace-nowrap">
      {ollamaConnected
        ? `연결됨 • ${selectedModel || '모델 미선택'}`
        : 'Ollama 서버에 연결되지 않음'}
    </div>
  </div>
</div>
```

---

## 반응형

### 모바일 (768px 미만)
```
┌────────────────────────────────────┐
│  AI ANALYZER        ● ● ⚙        │
└────────────────────────────────────┘
```
- 라벨 숨김, 아이콘만 표시

```typescript
<div className="flex items-center gap-1.5">
  <span className="text-xs text-ink-muted hidden md:inline">{label}</span>
  <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
</div>
```

---

## App.tsx 연동

```typescript
// spa/src/App.tsx

function AppRoutes() {
  const { isConnected, isChecking } = useExtension();

  if (isChecking && !isConnected) return <LoadingPage />;
  if (!isConnected) return <ExtensionRequired />;

  return (
    <Layout isConnected={isConnected}>
      <Routes>
        {/* ... */}
      </Routes>
    </Layout>
  );
}
```

OllamaContext는 Layout 내부의 Header에서 직접 useOllama()로 접근합니다.
