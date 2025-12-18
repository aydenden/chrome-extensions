import { test as base, type Page } from '@playwright/test';
import type { ExtensionRequest, ApiResponse, MessageResponse } from '@shared/types';
import {
  emptyData,
  sampleData,
  sampleCompanies,
  sampleCompanyDetail,
  sampleImages,
  sampleImageData,
  sampleThumbnail,
  sampleStats,
} from './test-data';

/** Mock Extension Fixture 옵션 */
export interface MockExtensionOptions {
  /** 빈 상태로 시작할지 여부 (기본값: false) */
  isEmpty?: boolean;
  /** 커스텀 응답 핸들러 */
  customHandlers?: Partial<MockMessageHandlers>;
}

/** Mock 메시지 핸들러 타입 */
export type MockMessageHandlers = {
  [K in ExtensionRequest['type']]: (
    payload: Extract<ExtensionRequest, { type: K }> extends { payload: infer P }
      ? P
      : undefined
  ) => ApiResponse<MessageResponse[K]>;
};

/** 기본 Mock 메시지 핸들러 */
const createDefaultHandlers = (options: MockExtensionOptions = {}): MockMessageHandlers => {
  const data = options.isEmpty ? emptyData : sampleData;

  return {
    PING: () => ({
      success: true,
      data: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    }),

    GET_STATS: () => ({
      success: true,
      data: data.stats,
    }),

    GET_COMPANIES: (payload) => {
      let companies = options.isEmpty ? [] : [...sampleCompanies];

      // 사이트 필터링
      if (payload?.siteType) {
        companies = companies.filter((c) => c.siteType === payload.siteType);
      }

      // 정렬
      if (payload?.sortBy) {
        const { sortBy, sortOrder = 'desc' } = payload;
        companies.sort((a, b) => {
          const aVal = a[sortBy];
          const bVal = b[sortBy];
          const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      }

      return {
        success: true,
        data: companies,
      };
    },

    GET_COMPANY: (payload) => {
      if (options.isEmpty) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '회사를 찾을 수 없습니다',
          },
        };
      }

      const company = payload?.companyId === 'company-1' ? sampleCompanyDetail : null;

      if (!company) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '회사를 찾을 수 없습니다',
          },
        };
      }

      return {
        success: true,
        data: company,
      };
    },

    DELETE_COMPANY: (payload) => {
      if (options.isEmpty || !payload?.companyId) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '회사를 찾을 수 없습니다',
          },
        };
      }

      return {
        success: true,
        data: { deletedImages: 5 },
      };
    },

    GET_IMAGES: (payload) => {
      if (options.isEmpty) {
        return {
          success: true,
          data: [],
        };
      }

      let images = [...sampleImages];

      // 필터링
      if (payload?.filter?.category) {
        images = images.filter((img) => img.category === payload.filter?.category);
      }
      if (payload?.filter?.hasAnalysis !== undefined) {
        images = images.filter((img) => img.hasAnalysis === payload.filter?.hasAnalysis);
      }

      return {
        success: true,
        data: images,
      };
    },

    GET_IMAGE_DATA: (payload) => {
      if (options.isEmpty || !payload?.imageId) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '이미지를 찾을 수 없습니다',
          },
        };
      }

      const imageData = { ...sampleImageData };

      // includeRawText가 false면 rawText 제거
      if (payload?.includeRawText === false) {
        delete imageData.rawText;
      }

      // includeAnalysis가 false면 analysis 제거
      if (payload?.includeAnalysis === false) {
        delete imageData.analysis;
      }

      return {
        success: true,
        data: imageData,
      };
    },

    GET_IMAGE_THUMBNAIL: (payload) => {
      if (options.isEmpty || !payload?.imageId) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '이미지를 찾을 수 없습니다',
          },
        };
      }

      return {
        success: true,
        data: sampleThumbnail,
      };
    },

    DELETE_IMAGE: (payload) => {
      if (options.isEmpty || !payload?.imageId) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '이미지를 찾을 수 없습니다',
          },
        };
      }

      return {
        success: true,
        data: null,
      };
    },

    SAVE_ANALYSIS: (payload) => {
      if (options.isEmpty || !payload?.imageId) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '이미지를 찾을 수 없습니다',
          },
        };
      }

      return {
        success: true,
        data: { updatedAt: new Date().toISOString() },
      };
    },

    BATCH_SAVE_ANALYSIS: (payload) => {
      if (options.isEmpty || !payload?.results?.length) {
        return {
          success: false,
          error: {
            code: 'INVALID_PAYLOAD',
            message: '유효하지 않은 요청입니다',
          },
        };
      }

      return {
        success: true,
        data: {
          savedCount: payload.results.length,
          failedIds: [],
        },
      };
    },
  };
};

/** Extension Mock 주입 함수 */
async function injectExtensionMock(page: Page, options: MockExtensionOptions = {}) {
  const handlers = {
    ...createDefaultHandlers(options),
    ...options.customHandlers,
  };

  await page.addInitScript((handlersJSON: string) => {
    const handlers = JSON.parse(handlersJSON) as Record<string, unknown>;

    // chrome.runtime.sendMessage Mock
    if (!window.chrome) {
      (window as any).chrome = {};
    }
    if (!window.chrome.runtime) {
      (window.chrome as any).runtime = {};
    }

    (window.chrome.runtime as any).sendMessage = function (
      request: ExtensionRequest,
      callback?: (response: unknown) => void
    ) {
      // 핸들러 실행 (동기적으로 처리)
      const handler = handlers[request.type] as string;
      let response: unknown;

      try {
        const handlerFn = new Function('payload', `return ${handler}`);
        response = handlerFn(request.type === 'PING' || request.type === 'GET_STATS'
          ? undefined
          : (request as any).payload);
      } catch (error) {
        response = {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: String(error),
          },
        };
      }

      // 비동기 콜백 처리
      if (callback) {
        setTimeout(() => callback(response), 0);
      }

      // Promise 반환 (chrome.runtime.sendMessage는 Promise도 지원)
      return Promise.resolve(response);
    };

    // chrome.runtime.id Mock (Extension 설치 여부 확인용)
    (window.chrome.runtime as any).id = 'mock-extension-id';
  }, JSON.stringify(
    Object.fromEntries(
      Object.entries(handlers).map(([key, fn]) => [key, fn.toString()])
    )
  ));
}

/** Mock Extension Fixtures */
export const test = base.extend<{
  mockExtension: (options?: MockExtensionOptions) => Promise<void>;
}>({
  mockExtension: async ({ page }, use) => {
    const mockFn = async (options?: MockExtensionOptions) => {
      await injectExtensionMock(page, options);
    };

    await use(mockFn);
  },
});

export { expect } from '@playwright/test';
