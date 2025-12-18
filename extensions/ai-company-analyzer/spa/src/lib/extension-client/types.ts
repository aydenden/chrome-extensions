import type { MessageType, MessagePayload, MessageResponse } from '@shared/types';

/** Extension Handler 인터페이스 */
export interface IExtensionHandler {
  send<T extends MessageType>(
    type: T,
    payload?: MessagePayload[T]
  ): Promise<MessageResponse[T]>;
}

/** Extension 연결 상태 */
export interface ExtensionState {
  isConnected: boolean;
  isChecking: boolean;
  version?: string;
  error?: string;
}
