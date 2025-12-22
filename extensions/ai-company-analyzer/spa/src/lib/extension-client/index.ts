export type { IExtensionHandler, ExtensionState } from './types';
export { ChromeHandler } from './chrome-handler';
export {
  initExtensionClient,
  getExtensionClient,
  initChromeExtensionClient,
  autoInitExtensionClient,
} from './client';
