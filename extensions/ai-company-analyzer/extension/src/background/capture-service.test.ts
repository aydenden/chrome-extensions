import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureFullScreen, captureAndSave, captureRegion } from './capture-service';
import { db } from '@/lib/db';

// DB 모킹
vi.mock('@/lib/db', () => ({
  db: {
    companies: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      first: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
    },
    images: {
      add: vi.fn(),
    },
  },
}));

// createImageBitmap 모킹
const mockBitmap = { width: 1920, height: 1080, close: vi.fn() };
global.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

describe('capture-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // DB 모킹 초기화
    vi.mocked(db.companies.first).mockResolvedValue(null);
    vi.mocked(db.companies.add).mockResolvedValue('company-id');
    vi.mocked(db.images.add).mockResolvedValue('image-id');
  });

  describe('captureFullScreen', () => {
    it('화면을 캡처하고 dataUrl을 반환한다', async () => {
      const mockDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      vi.mocked(chrome.tabs.captureVisibleTab).mockResolvedValue(mockDataUrl);

      const result = await captureFullScreen(1);

      expect(result).toBe(mockDataUrl);
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, { format: 'png' });
    });
  });

  describe('captureAndSave', () => {
    const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    beforeEach(() => {
      vi.mocked(chrome.tabs.captureVisibleTab).mockResolvedValue(mockDataUrl);
    });

    it('전체 화면을 캡처하고 저장한다', async () => {
      const result = await captureAndSave({
        tabId: 1,
        windowId: 1,
        companyName: '테스트회사',
        companyUrl: 'https://example.com/company/123',
        siteType: 'WANTED',
      });

      expect(result.success).toBe(true);
      expect(result.imageId).toBeDefined();
      expect(result.companyId).toBeDefined();
    });

    it('기존 회사가 없으면 새로 생성한다', async () => {
      vi.mocked(db.companies.first).mockResolvedValue(null);

      await captureAndSave({
        tabId: 1,
        windowId: 1,
        companyName: '새회사',
        companyUrl: 'https://example.com/new',
        siteType: 'JOBPLANET',
      });

      expect(db.companies.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '새회사',
          url: 'https://example.com/new',
          siteType: 'JOBPLANET',
        })
      );
    });

    it('기존 회사가 있으면 업데이트한다', async () => {
      const existingCompany = { id: 'existing-id', name: '기존회사' };
      vi.mocked(db.companies.first).mockResolvedValue(existingCompany);

      const result = await captureAndSave({
        tabId: 1,
        windowId: 1,
        companyName: '업데이트된 회사명',
        companyUrl: 'https://example.com/company',
        siteType: 'BLIND',
      });

      expect(db.companies.update).toHaveBeenCalledWith(
        'existing-id',
        expect.objectContaining({ name: '업데이트된 회사명' })
      );
      expect(result.companyId).toBe('existing-id');
    });

    it('existingCompanyId가 있으면 회사를 찾거나 생성하지 않는다', async () => {
      const result = await captureAndSave({
        tabId: 1,
        windowId: 1,
        companyName: '테스트',
        companyUrl: 'https://example.com',
        siteType: 'DART',
        existingCompanyId: 'preset-company-id',
      });

      expect(db.companies.where).not.toHaveBeenCalled();
      expect(db.companies.add).not.toHaveBeenCalled();
      expect(result.companyId).toBe('preset-company-id');
    });

    it('이미지를 DB에 저장한다', async () => {
      await captureAndSave({
        tabId: 1,
        windowId: 1,
        companyName: '테스트',
        companyUrl: 'https://example.com',
        siteType: 'WANTED',
      });

      expect(db.images.add).toHaveBeenCalledWith(
        expect.objectContaining({
          siteType: 'WANTED',
          mimeType: 'image/png',
          width: 1920,
          height: 1080,
        })
      );
    });

    it('알림을 생성한다', async () => {
      await captureAndSave({
        tabId: 1,
        windowId: 1,
        companyName: '알림테스트',
        companyUrl: 'https://example.com',
        siteType: 'WANTED',
      });

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'basic',
          message: expect.stringContaining('알림테스트'),
        })
      );
    });

    it('알림 에러가 캡처 결과에 영향을 주지 않는다', async () => {
      vi.mocked(chrome.notifications.create).mockImplementation(() => {
        throw new Error('Notification error');
      });

      const result = await captureAndSave({
        tabId: 1,
        windowId: 1,
        companyName: '테스트',
        companyUrl: 'https://example.com',
        siteType: 'WANTED',
      });

      expect(result.success).toBe(true);
    });

    it('캡처 실패시 에러를 반환한다', async () => {
      vi.mocked(chrome.tabs.captureVisibleTab).mockRejectedValue(new Error('Capture failed'));

      const result = await captureAndSave({
        tabId: 1,
        windowId: 1,
        companyName: '테스트',
        companyUrl: 'https://example.com',
        siteType: 'WANTED',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Capture failed');
    });

    it('DB 저장 실패시 에러를 반환한다', async () => {
      vi.mocked(db.images.add).mockRejectedValue(new Error('DB error'));

      const result = await captureAndSave({
        tabId: 1,
        windowId: 1,
        companyName: '테스트',
        companyUrl: 'https://example.com',
        siteType: 'WANTED',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('captureRegion', () => {
    const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    it('영역 이미지를 저장한다', async () => {
      const result = await captureRegion({
        dataUrl: mockDataUrl,
        companyName: '테스트',
        companyUrl: 'https://example.com',
        siteType: 'WANTED',
      });

      expect(result.success).toBe(true);
      expect(result.imageId).toBeDefined();
      expect(result.companyId).toBeDefined();
    });

    it('existingCompanyId가 있으면 해당 ID를 사용한다', async () => {
      const result = await captureRegion({
        dataUrl: mockDataUrl,
        companyName: '테스트',
        companyUrl: 'https://example.com',
        siteType: 'BLIND',
        existingCompanyId: 'existing-123',
      });

      expect(result.companyId).toBe('existing-123');
      expect(db.companies.where).not.toHaveBeenCalled();
    });

    it('잘못된 dataUrl에서 에러를 처리한다', async () => {
      const result = await captureRegion({
        dataUrl: 'invalid-data-url',
        companyName: '테스트',
        companyUrl: 'https://example.com',
        siteType: 'WANTED',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
