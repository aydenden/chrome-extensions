import { vi } from 'vitest';

export function mockChromeMessage(response: any) {
  (chrome.runtime.sendMessage as any).mockImplementation(
    (_message: any, callback?: (response: any) => void) => {
      callback?.(response);
      return Promise.resolve(response);
    }
  );
}

export function mockChromeStorage(data: Record<string, any>) {
  (chrome.storage.local.get as any).mockImplementation(
    (keys: string | string[] | null, callback?: (items: any) => void) => {
      const result: any = {};
      if (keys === null) Object.assign(result, data);
      else if (typeof keys === 'string') result[keys] = data[keys];
      else keys.forEach(k => { result[k] = data[k]; });
      callback?.(result);
      return Promise.resolve(result);
    }
  );
}

export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
