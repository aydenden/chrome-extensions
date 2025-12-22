import type { IExtensionHandler } from './types';
import { ChromeHandler } from './chrome-handler';

let handler: IExtensionHandler | null = null;

/** 클라이언트 초기화 */
export function initExtensionClient(h: IExtensionHandler): void {
  handler = h;
}

/** 클라이언트 가져오기 */
export function getExtensionClient(): IExtensionHandler {
  if (!handler) {
    throw new Error('Extension client not initialized. Call initExtensionClient first.');
  }
  return handler;
}

/** 기본 Chrome Handler로 초기화 */
export function initChromeExtensionClient(extensionId: string): void {
  initExtensionClient(new ChromeHandler(extensionId));
}

/** 자동 감지 초기화 */
export function autoInitExtensionClient(extensionId: string): void {
  // 브라우저 환경이 아니거나 chrome API가 없으면 초기화하지 않음
  if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
    console.warn('[Extension Client] Chrome API not available');
    return;
  }

  initChromeExtensionClient(extensionId);
}
