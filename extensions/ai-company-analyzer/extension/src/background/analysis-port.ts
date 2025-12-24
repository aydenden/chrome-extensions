/**
 * Analysis Port Handler
 * SPA와의 Port 기반 양방향 통신 관리
 */
import type {
  AnalysisCommand,
  AnalysisEvent,
  AnalysisStatus,
} from '@shared/types';
import { analysisManager } from './analysis-manager';

const PORT_NAME = 'analysis-stream';

// 연결된 포트 관리
const connectedPorts = new Set<chrome.runtime.Port>();

// ============================================================================
// Port Connection Management
// ============================================================================

/**
 * 새 Port 연결 처리
 */
function handlePortConnection(port: chrome.runtime.Port): boolean {
  if (port.name !== PORT_NAME) {
    return false;
  }

  console.log('[AnalysisPort] Port connected from:', port.sender?.url);
  connectedPorts.add(port);

  // 명령 수신 리스너
  port.onMessage.addListener((message: AnalysisCommand) => {
    handleCommand(message, port);
  });

  // 연결 해제 처리
  port.onDisconnect.addListener(() => {
    console.log('[AnalysisPort] Port disconnected');
    connectedPorts.delete(port);
  });

  // 연결 즉시 현재 상태 전송
  analysisManager.getStatus().then((status) => {
    sendEvent(port, { type: 'STATUS', payload: status });
  });

  return true;
}

// ============================================================================
// Command Handling
// ============================================================================

/**
 * SPA로부터 받은 명령 처리
 */
async function handleCommand(
  command: AnalysisCommand,
  port: chrome.runtime.Port
): Promise<void> {
  console.log('[AnalysisPort] Command received:', command.type);

  switch (command.type) {
    case 'GET_STATUS': {
      const status = await analysisManager.getStatus();
      sendEvent(port, { type: 'STATUS', payload: status });
      break;
    }

    case 'START_ANALYSIS':
      console.log('[AnalysisPort] START_ANALYSIS payload:', command.payload);
      await analysisManager.startAnalysis(command.payload);
      break;

    case 'ABORT_ANALYSIS':
      console.log('[AnalysisPort] ABORT_ANALYSIS');
      await analysisManager.abort();
      break;

    case 'RETRY_FAILED':
      console.log('[AnalysisPort] RETRY_FAILED');
      await analysisManager.retryFailed();
      break;
  }
}

// ============================================================================
// Event Broadcasting
// ============================================================================

/**
 * 특정 포트에 이벤트 전송
 */
function sendEvent(port: chrome.runtime.Port, event: AnalysisEvent): void {
  try {
    port.postMessage(event);
  } catch (error) {
    console.error('[AnalysisPort] Failed to send event:', error);
    connectedPorts.delete(port);
  }
}

/**
 * 모든 연결된 포트에 이벤트 브로드캐스트
 */
export function broadcastEvent(event: AnalysisEvent): void {
  for (const port of connectedPorts) {
    sendEvent(port, event);
  }
}

/**
 * 연결된 포트 수 조회
 */
export function getConnectedPortCount(): number {
  return connectedPorts.size;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Port 리스너 초기화
 */
export async function initAnalysisPort(): Promise<void> {
  // AnalysisManager 이벤트 브로드캐스터 설정
  analysisManager.setEventBroadcaster(broadcastEvent);

  // AnalysisManager 초기화 (미완료 세션 복구)
  await analysisManager.init();

  // Port 연결 리스너 등록 (외부 웹페이지에서 오는 연결)
  chrome.runtime.onConnectExternal.addListener(handlePortConnection);

  console.log('[AnalysisPort] Initialized');
}
