import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCaptureSettings,
  setCaptureSettings,
  resetCaptureSettings,
  startContinuousCaptureSession,
  getContinuousCaptureSession,
  incrementCaptureCount,
  endContinuousCaptureSession,
} from './capture-settings';

describe('capture-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCaptureSettings', () => {
    it('저장된 설정이 없으면 기본값을 반환한다', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValue({});

      const settings = await getCaptureSettings();

      expect(settings).toEqual({
        quickCaptureEnabled: false,
        continuousCaptureEnabled: false,
      });
    });

    it('저장된 설정이 있으면 해당 값을 반환한다', async () => {
      const savedSettings = {
        quickCaptureEnabled: true,
        continuousCaptureEnabled: true,
      };
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        captureSettings: savedSettings,
      });

      const settings = await getCaptureSettings();

      expect(settings).toEqual(savedSettings);
    });
  });

  describe('setCaptureSettings', () => {
    it('부분 업데이트를 지원한다', async () => {
      const existingSettings = {
        quickCaptureEnabled: false,
        continuousCaptureEnabled: false,
      };
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        captureSettings: existingSettings,
      });

      await setCaptureSettings({ quickCaptureEnabled: true });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        captureSettings: {
          quickCaptureEnabled: true,
          continuousCaptureEnabled: false,
        },
      });
    });
  });

  describe('resetCaptureSettings', () => {
    it('설정을 기본값으로 초기화한다', async () => {
      await resetCaptureSettings();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        captureSettings: {
          quickCaptureEnabled: false,
          continuousCaptureEnabled: false,
        },
      });
    });
  });

  describe('연속 캡처 세션', () => {
    describe('startContinuousCaptureSession', () => {
      it('새 세션을 시작한다', async () => {
        const session = await startContinuousCaptureSession('테스트회사', 'company-123');

        expect(session.active).toBe(true);
        expect(session.companyName).toBe('테스트회사');
        expect(session.companyId).toBe('company-123');
        expect(session.captureCount).toBe(0);
        expect(session.startedAt).toBeGreaterThan(0);

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          continuousCaptureSession: session,
        });
      });
    });

    describe('getContinuousCaptureSession', () => {
      it('세션이 없으면 null을 반환한다', async () => {
        vi.mocked(chrome.storage.local.get).mockResolvedValue({});

        const session = await getContinuousCaptureSession();

        expect(session).toBeNull();
      });

      it('비활성 세션이면 null을 반환한다', async () => {
        vi.mocked(chrome.storage.local.get).mockResolvedValue({
          continuousCaptureSession: { active: false },
        });

        const session = await getContinuousCaptureSession();

        expect(session).toBeNull();
      });

      it('유효한 세션을 반환한다', async () => {
        const validSession = {
          active: true,
          companyName: '테스트',
          companyId: 'id-123',
          captureCount: 5,
          startedAt: Date.now(),
        };
        vi.mocked(chrome.storage.local.get).mockResolvedValue({
          continuousCaptureSession: validSession,
        });

        const session = await getContinuousCaptureSession();

        expect(session).toEqual(validSession);
      });

      it('타임아웃된 세션은 종료하고 null을 반환한다', async () => {
        const expiredSession = {
          active: true,
          companyName: '테스트',
          companyId: 'id-123',
          captureCount: 5,
          startedAt: Date.now() - 11 * 60 * 1000, // 11분 전
        };
        vi.mocked(chrome.storage.local.get).mockResolvedValue({
          continuousCaptureSession: expiredSession,
        });

        const session = await getContinuousCaptureSession();

        expect(session).toBeNull();
        expect(chrome.storage.local.remove).toHaveBeenCalledWith('continuousCaptureSession');
      });
    });

    describe('incrementCaptureCount', () => {
      it('세션이 없으면 0을 반환한다', async () => {
        vi.mocked(chrome.storage.local.get).mockResolvedValue({});

        const count = await incrementCaptureCount();

        expect(count).toBe(0);
      });

      it('카운터를 증가시키고 새 값을 반환한다', async () => {
        const session = {
          active: true,
          companyName: '테스트',
          companyId: 'id-123',
          captureCount: 3,
          startedAt: Date.now(),
        };
        vi.mocked(chrome.storage.local.get).mockResolvedValue({
          continuousCaptureSession: session,
        });

        const count = await incrementCaptureCount();

        expect(count).toBe(4);
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          continuousCaptureSession: { ...session, captureCount: 4 },
        });
      });
    });

    describe('endContinuousCaptureSession', () => {
      it('세션을 종료한다', async () => {
        await endContinuousCaptureSession();

        expect(chrome.storage.local.remove).toHaveBeenCalledWith('continuousCaptureSession');
      });
    });
  });
});
