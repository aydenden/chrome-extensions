/**
 * Analysis Port Connection Manager
 * Extension Service Worker와의 Port 기반 양방향 통신 관리
 */
import type {
  AnalysisCommand,
  AnalysisEvent,
  AnalysisEventPayload,
} from '@shared/types';

const PORT_NAME = 'analysis-stream';
const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

type EventType = AnalysisEvent['type'];
type EventHandler<T extends EventType> = (
  payload: AnalysisEventPayload<T>
) => void;

// ============================================================================
// Connection Class
// ============================================================================

export class AnalysisPortConnection {
  private port: chrome.runtime.Port | null = null;
  private extensionId: string;
  private handlers: Map<EventType, Set<EventHandler<EventType>>> = new Map();
  private autoReconnect = true;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private connectionListeners: Set<(connected: boolean) => void> = new Set();

  constructor(extensionId: string) {
    this.extensionId = extensionId;
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Extension에 연결
   */
  connect(): void {
    if (this.port) {
      return;
    }

    // chrome.runtime이 없으면 연결 불가
    if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
      console.warn('[AnalysisPort] Chrome runtime not available');
      return;
    }

    try {
      this.port = chrome.runtime.connect(this.extensionId, { name: PORT_NAME });

      this.port.onMessage.addListener(this.handleMessage.bind(this));
      this.port.onDisconnect.addListener(this.handleDisconnect.bind(this));

      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);
      console.log('[AnalysisPort] Connected to extension');
    } catch (error) {
      console.error('[AnalysisPort] Connection failed:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 연결 해제
   */
  disconnect(): void {
    this.autoReconnect = false;
    this.clearReconnectTimer();

    if (this.port) {
      this.port.disconnect();
      this.port = null;
      this.notifyConnectionChange(false);
    }
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.port !== null;
  }

  // ==========================================================================
  // Command Sending
  // ==========================================================================

  /**
   * Extension에 명령 전송
   */
  sendCommand(command: AnalysisCommand): void {
    if (!this.port) {
      console.warn('[AnalysisPort] Not connected, cannot send command');
      return;
    }

    try {
      this.port.postMessage(command);
    } catch (error) {
      console.error('[AnalysisPort] Failed to send command:', error);
    }
  }

  // ==========================================================================
  // Event Subscription
  // ==========================================================================

  /**
   * 이벤트 구독
   */
  on<T extends EventType>(
    type: T,
    handler: EventHandler<T>
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as unknown as EventHandler<EventType>);

    // 구독 해제 함수 반환
    return () => {
      this.handlers.get(type)?.delete(handler as unknown as EventHandler<EventType>);
    };
  }

  /**
   * 연결 상태 변경 리스너
   */
  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  // ==========================================================================
  // Internal Handlers
  // ==========================================================================

  private handleMessage(event: AnalysisEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      const payload = 'payload' in event ? event.payload : undefined;
      for (const handler of handlers) {
        try {
          handler(payload as AnalysisEventPayload<typeof event.type>);
        } catch (error) {
          console.error('[AnalysisPort] Handler error:', error);
        }
      }
    }
  }

  private handleDisconnect(): void {
    console.log('[AnalysisPort] Disconnected');
    this.port = null;
    this.notifyConnectionChange(false);

    if (this.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[AnalysisPort] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY * this.reconnectAttempts;

    console.log(`[AnalysisPort] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private notifyConnectionChange(connected: boolean): void {
    for (const listener of this.connectionListeners) {
      try {
        listener(connected);
      } catch (error) {
        console.error('[AnalysisPort] Connection listener error:', error);
      }
    }
  }
}
