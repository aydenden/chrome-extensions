import type { IExtensionHandler } from './types';
import type { MessageType, MessagePayload, MessageResponse, ApiResponse } from '@shared/types';
import { ExtensionError } from '@shared/types';

export class ChromeHandler implements IExtensionHandler {
  constructor(private extensionId: string) {}

  async send<T extends MessageType>(
    type: T,
    payload?: MessagePayload[T]
  ): Promise<MessageResponse[T]> {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
        reject(new ExtensionError('Chrome runtime not available'));
        return;
      }

      chrome.runtime.sendMessage(
        this.extensionId,
        { type, payload },
        (response: ApiResponse<MessageResponse[T]>) => {
          if (chrome.runtime.lastError) {
            reject(new ExtensionError(
              chrome.runtime.lastError.message || 'Extension communication failed'
            ));
            return;
          }

          if (!response) {
            reject(new ExtensionError('No response from extension'));
            return;
          }

          if (!response.success) {
            reject(new ExtensionError(
              response.error?.message || 'Unknown error'
            ));
            return;
          }

          resolve(response.data as MessageResponse[T]);
        }
      );
    });
  }
}
