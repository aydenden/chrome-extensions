# Feature 37: Vitest 환경 설정

## 개요

Vitest 테스트 환경을 Extension과 SPA 프로젝트에 설정합니다.

## 범위

- Vitest 설정 파일
- 테스트 유틸리티
- Mock 설정
- 커버리지 설정

## 의존성

- Feature 01: Extension 프로젝트 초기 설정
- Feature 02: SPA 프로젝트 초기 설정

## 구현 상세

### extension/vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
```

### extension/test/setup.ts

```typescript
import { vi } from 'vitest';

// Chrome API Mock
global.chrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onMessageExternal: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    captureVisibleTab: vi.fn(),
  },
} as unknown as typeof chrome;

// IndexedDB Mock (fake-indexeddb)
import 'fake-indexeddb/auto';
```

### extension/test/utils.ts

```typescript
import { vi } from 'vitest';

/** 메시지 응답 Mock 설정 */
export function mockChromeMessage(response: any) {
  (chrome.runtime.sendMessage as any).mockImplementation(
    (_message: any, callback?: (response: any) => void) => {
      callback?.(response);
      return Promise.resolve(response);
    }
  );
}

/** Storage Mock 설정 */
export function mockChromeStorage(data: Record<string, any>) {
  (chrome.storage.local.get as any).mockImplementation(
    (keys: string | string[] | null, callback?: (items: any) => void) => {
      const result: any = {};
      if (keys === null) {
        Object.assign(result, data);
      } else if (typeof keys === 'string') {
        result[keys] = data[keys];
      } else {
        keys.forEach(k => { result[k] = data[k]; });
      }
      callback?.(result);
      return Promise.resolve(result);
    }
  );
}

/** 비동기 대기 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 타이머 Mock */
export function useFakeTimers() {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
}
```

### spa/vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.spec.tsx', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.d.ts',
        '**/*.test.*',
        '**/*.spec.*',
      ],
    },
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
```

### spa/test/setup.ts

```typescript
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Extension Client Mock
vi.mock('@/lib/extension-client', () => ({
  getExtensionClient: vi.fn(() => ({
    send: vi.fn(),
    isConnected: vi.fn(() => true),
  })),
}));

// localStorage Mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// matchMedia Mock
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

// ResizeObserver Mock
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
```

### spa/test/utils.tsx

```typescript
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

/** 테스트용 QueryClient */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

/** 테스트용 Wrapper */
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

/** 커스텀 render */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: TestWrapper, ...options });
}

export * from '@testing-library/react';
export { renderWithProviders as render };
```

### package.json 스크립트

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:run": "vitest run"
  }
}
```

## 완료 기준

- [ ] Extension vitest.config.ts
- [ ] SPA vitest.config.ts
- [ ] Chrome API Mock (extension/test/setup.ts)
- [ ] React Testing Library 설정 (spa/test/setup.ts)
- [ ] 테스트 유틸리티 함수
- [ ] 커버리지 설정

## 참조 문서

- spec/03-spa-structure.md Section 8 (테스트)
