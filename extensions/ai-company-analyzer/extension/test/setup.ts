import { vi } from 'vitest';
import 'fake-indexeddb/auto';

global.chrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onMessageExternal: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  storage: {
    local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
    sync: { get: vi.fn(), set: vi.fn() },
  },
  tabs: { query: vi.fn(), captureVisibleTab: vi.fn() },
} as unknown as typeof chrome;
