/**
 * 캡처 설정 Chrome Storage 유틸리티
 */
import type { CaptureSettings } from '@shared/types';
import { DEFAULT_CAPTURE_SETTINGS } from '@shared/types';

const STORAGE_KEY = 'captureSettings';

/**
 * 캡처 설정 로드
 */
export async function getCaptureSettings(): Promise<CaptureSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? DEFAULT_CAPTURE_SETTINGS;
}

/**
 * 캡처 설정 저장 (부분 업데이트 지원)
 */
export async function setCaptureSettings(
  settings: Partial<CaptureSettings>
): Promise<void> {
  const current = await getCaptureSettings();
  await chrome.storage.local.set({
    [STORAGE_KEY]: { ...current, ...settings },
  });
}

/**
 * 캡처 설정 초기화
 */
export async function resetCaptureSettings(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: DEFAULT_CAPTURE_SETTINGS,
  });
}

// ===== 연속 캡처 세션 관리 =====

const SESSION_KEY = 'continuousCaptureSession';
const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10분 타임아웃

/**
 * 연속 캡처 세션 상태
 */
export interface ContinuousCaptureSession {
  active: boolean;
  companyName: string;
  companyId: string;
  captureCount: number;
  startedAt: number;
}

/**
 * 연속 캡처 세션 시작
 */
export async function startContinuousCaptureSession(
  companyName: string,
  companyId: string
): Promise<ContinuousCaptureSession> {
  const session: ContinuousCaptureSession = {
    active: true,
    companyName,
    companyId,
    captureCount: 0,
    startedAt: Date.now(),
  };
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return session;
}

/**
 * 연속 캡처 세션 조회 (타임아웃 체크 포함)
 */
export async function getContinuousCaptureSession(): Promise<ContinuousCaptureSession | null> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  const session = result[SESSION_KEY] as ContinuousCaptureSession | undefined;

  if (!session || !session.active) {
    return null;
  }

  // 타임아웃 체크 (10분)
  if (Date.now() - session.startedAt > SESSION_TIMEOUT_MS) {
    await endContinuousCaptureSession();
    return null;
  }

  return session;
}

/**
 * 연속 캡처 카운터 증가
 */
export async function incrementCaptureCount(): Promise<number> {
  const session = await getContinuousCaptureSession();
  if (!session) return 0;

  const updatedSession: ContinuousCaptureSession = {
    ...session,
    captureCount: session.captureCount + 1,
  };
  await chrome.storage.local.set({ [SESSION_KEY]: updatedSession });
  return updatedSession.captureCount;
}

/**
 * 연속 캡처 세션 종료
 */
export async function endContinuousCaptureSession(): Promise<void> {
  await chrome.storage.local.remove(SESSION_KEY);
}
