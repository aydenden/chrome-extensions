/**
 * E2E 테스트용 Extension Mock Fixture
 * Chrome Extension API를 Mock하여 테스트 환경에서 Extension 연결을 시뮬레이션
 */
import { test as base } from '@playwright/test';

// Fixture 타입 정의
type ExtensionFixtures = {
  mockExtension: void;
};

// Extension Mock Fixture
export const test = base.extend<ExtensionFixtures>({
  mockExtension: [async ({ page }, use) => {
    // Extension Mock 주입
    await page.addInitScript(() => {
      // Mock 데이터
      const mockCompanies = [
        {
          id: 'company-1',
          name: '테스트 회사',
          dataSources: ['wanted', 'jobplanet'],
          imageCount: 3,
          analyzedCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'company-2',
          name: '샘플 기업',
          dataSources: ['saramin'],
          imageCount: 1,
          analyzedCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const mockImages = [
        {
          id: 'image-1',
          companyId: 'company-1',
          category: 'company_info',
          size: 1024,
          mimeType: 'image/png',
          hasAnalysis: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'image-2',
          companyId: 'company-1',
          category: 'benefits',
          size: 2048,
          mimeType: 'image/png',
          hasAnalysis: false,
          createdAt: new Date().toISOString(),
        },
      ];

      // Chrome Runtime API Mock
      const chrome = {
        runtime: {
          id: 'mock-extension-id',
          lastError: null as { message: string } | null,
          // sendMessage(extensionId, message, callback) 시그니처 지원
          sendMessage: (
            extensionIdOrMessage: string | { type: string; payload?: unknown },
            messageOrCallback?: { type: string; payload?: unknown } | ((response: unknown) => void),
            maybeCallback?: (response: unknown) => void
          ) => {
            // 인자 정규화
            let message: { type: string; payload?: unknown };
            let callback: ((response: unknown) => void) | undefined;

            if (typeof extensionIdOrMessage === 'string') {
              // sendMessage(extensionId, message, callback)
              message = messageOrCallback as { type: string; payload?: unknown };
              callback = maybeCallback;
            } else {
              // sendMessage(message, callback)
              message = extensionIdOrMessage;
              callback = messageOrCallback as ((response: unknown) => void) | undefined;
            }

            // 메시지 핸들러
            const handlers: Record<string, () => unknown> = {
              PING: () => ({
                success: true,
                data: { version: '1.0.0' },
              }),
              GET_COMPANIES: () => ({
                success: true,
                data: mockCompanies,
              }),
              GET_COMPANY: () => {
                const companyId = (message.payload as { companyId?: string })?.companyId;
                const company = mockCompanies.find(c => c.id === companyId);
                if (company) {
                  return {
                    success: true,
                    data: {
                      ...company,
                      analysisContext: '',
                      analysis: null,
                    },
                  };
                }
                return { success: false, error: { code: 'NOT_FOUND', message: '회사를 찾을 수 없습니다' } };
              },
              GET_IMAGES: () => {
                const companyId = (message.payload as { companyId?: string })?.companyId;
                const images = mockImages.filter(img => img.companyId === companyId);
                return {
                  success: true,
                  data: images,
                };
              },
              GET_STATS: () => ({
                success: true,
                data: {
                  totalCompanies: 2,
                  totalImages: 4,
                  totalAnalyzed: 1,
                },
              }),
              DELETE_COMPANY: () => ({ success: true }),
              DELETE_ALL_DATA: () => ({ success: true }),
              GET_SETTINGS: () => ({
                success: true,
                data: {
                  ollamaEndpoint: 'http://localhost:11434',
                  selectedModel: 'qwen2.5vl:7b',
                },
              }),
              SAVE_SETTINGS: () => ({ success: true }),
            };

            const handler = handlers[message.type];
            const response = handler
              ? handler()
              : { success: false, error: { code: 'UNKNOWN', message: 'Unknown request type' } };

            // 비동기 응답 시뮬레이션
            if (callback) {
              setTimeout(() => {
                chrome.runtime.lastError = null;
                callback(response);
              }, 10);
            }
          },
          connect: () => ({
            onMessage: { addListener: () => {} },
            onDisconnect: { addListener: () => {} },
            postMessage: () => {},
            disconnect: () => {},
          }),
        },
      };

      (window as unknown as { chrome: typeof chrome }).chrome = chrome;
    });

    await use();
  }, { auto: true }],
});

export { expect } from '@playwright/test';
