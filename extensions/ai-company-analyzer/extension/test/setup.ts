import { vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

// Chrome API 모킹
const createChromeMock = () => ({
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onMessageExternal: { addListener: vi.fn(), removeListener: vi.fn() },
    onConnectExternal: { addListener: vi.fn(), removeListener: vi.fn() },
    connect: vi.fn(),
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    captureVisibleTab: vi.fn().mockResolvedValue('data:image/png;base64,'),
    create: vi.fn().mockResolvedValue({ id: 1 }),
  },
  notifications: {
    create: vi.fn(),
    clear: vi.fn(),
  },
});

global.chrome = createChromeMock() as unknown as typeof chrome;

// 각 테스트 전 Chrome 모킹 초기화
beforeEach(() => {
  vi.clearAllMocks();
  global.chrome = createChromeMock() as unknown as typeof chrome;
});

// fetch 모킹을 위한 헬퍼
export function mockFetch(response: unknown, options?: { ok?: boolean; status?: number }) {
  const mockResponse = {
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    json: vi.fn().mockResolvedValue(response),
    text: vi.fn().mockResolvedValue(typeof response === 'string' ? response : JSON.stringify(response)),
    body: null,
  };
  global.fetch = vi.fn().mockResolvedValue(mockResponse);
  return global.fetch as ReturnType<typeof vi.fn>;
}

// 스트리밍 응답 모킹 헬퍼
export function mockStreamingFetch(chunks: string[]) {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  const mockReader = {
    read: vi.fn().mockImplementation(async () => {
      if (chunkIndex < chunks.length) {
        const chunk = chunks[chunkIndex++];
        return { done: false, value: encoder.encode(chunk + '\n') };
      }
      return { done: true, value: undefined };
    }),
    releaseLock: vi.fn(),
  };

  const mockResponse = {
    ok: true,
    status: 200,
    body: { getReader: () => mockReader },
    text: vi.fn().mockResolvedValue(''),
  };

  global.fetch = vi.fn().mockResolvedValue(mockResponse);
  return { fetch: global.fetch as ReturnType<typeof vi.fn>, reader: mockReader };
}
