import type { MessageType } from '@shared/types';
import { getStats } from '@/lib/storage';
import { registerCompanyHandlers } from './handlers/company-handlers';
import { registerImageHandlers } from './handlers/image-handlers';
import { registerAnalysisHandlers } from './handlers/analysis-handlers';

const ALLOWED_ORIGINS = [
  'https://username.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const EXTENSION_VERSION = '1.0.0';

function isAllowedOrigin(senderUrl: string | undefined): boolean {
  if (!senderUrl) return false;
  try {
    const origin = new URL(senderUrl).origin;
    return ALLOWED_ORIGINS.some(allowed => {
      if (allowed.includes('localhost') || allowed.includes('127.0.0.1')) {
        return origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
      }
      return origin === allowed || origin.startsWith(allowed);
    });
  } catch {
    return false;
  }
}

function success<T>(data: T) {
  return { success: true, data };
}

function error(code: string, message: string) {
  return { success: false, error: { code, message } };
}

type MessageHandler<T extends MessageType> = (payload: any) => Promise<any>;
const handlers: Partial<{ [K in MessageType]: MessageHandler<K> }> = {};

export function registerHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): void {
  handlers[type] = handler as any;
}

export function initExternalApi(): void {
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (!isAllowedOrigin(sender.url)) {
      sendResponse(error('UNAUTHORIZED', 'Origin not allowed'));
      return;
    }
    const { type, payload } = message as { type: MessageType; payload?: any };
    if (!type || !(type in handlers)) {
      sendResponse(error('INVALID_PAYLOAD', `Unknown message type: ${type}`));
      return;
    }
    const handler = handlers[type];
    if (handler) {
      handler(payload)
        .then(data => sendResponse(success(data)))
        .catch(err => sendResponse(error('INTERNAL_ERROR', err.message || 'Unknown error')));
    }
    return true;
  });

  registerHandler('PING', async () => ({
    version: EXTENSION_VERSION,
    timestamp: new Date().toISOString(),
  }));

  registerHandler('GET_STATS', async () => {
    const stats = await getStats();
    return stats;
  });

  // Company 핸들러 등록
  registerCompanyHandlers();

  // Image 핸들러 등록
  registerImageHandlers();

  // Analysis 핸들러 등록
  registerAnalysisHandlers();

  console.log('[External API] Initialized');
}
