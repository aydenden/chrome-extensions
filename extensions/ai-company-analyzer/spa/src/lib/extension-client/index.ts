export type { IExtensionHandler, ExtensionState } from './types';
export { ChromeHandler } from './chrome-handler';
export { MockHandler, FailingMockHandler } from './mock-handler';
export {
  initExtensionClient,
  getExtensionClient,
  initChromeExtensionClient,
  initMockExtensionClient,
  autoInitExtensionClient,
} from './client';
