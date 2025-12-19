import type { IExtensionHandler } from './types';
import type { MessageType, MessagePayload, MessageResponse } from '@shared/types';

/** Mock 데이터 생성 헬퍼 */
const mockCompany = (id = 'mock-company-1') => ({
  id,
  name: '(주)테스트 회사',
  url: 'https://example.com',
  siteType: 'WANTED' as const,
  dataSources: ['WANTED' as const],
  imageCount: 3,
  analyzedCount: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const mockImageMeta = (id = 'mock-image-1') => ({
  id,
  companyId: 'mock-company-1',
  mimeType: 'image/png',
  size: 100000,
  width: 800,
  height: 600,
  category: 'revenue_trend' as const,
  hasRawText: true,
  hasAnalysis: true,
  createdAt: new Date().toISOString(),
});

const mockImageData = () => ({
  id: 'mock-image-1',
  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  mimeType: 'image/png',
  category: 'revenue_trend' as const,
  rawText: '테스트 OCR 결과',
  analysis: '테스트 분석 결과',
});

/** Mock Handler */
export class MockHandler implements IExtensionHandler {
  private delay: number;

  constructor(options?: { delay?: number }) {
    this.delay = options?.delay ?? 100;
  }

  async send<T extends MessageType>(
    type: T,
    _payload?: MessagePayload[T]
  ): Promise<MessageResponse[T]> {
    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, this.delay));

    const handlers: Record<MessageType, () => any> = {
      GET_COMPANIES: () => [mockCompany()],
      GET_COMPANY: () => mockCompany(),
      DELETE_COMPANY: () => ({ deletedImages: 3 }),
      GET_IMAGES: () => [mockImageMeta()],
      GET_IMAGE_DATA: () => mockImageData(),
      GET_IMAGE_THUMBNAIL: () => ({
        base64: mockImageData().base64,
        mimeType: 'image/jpeg',
        width: 200,
        height: 150,
      }),
      DELETE_IMAGE: () => null,
      SAVE_ANALYSIS: () => ({ updatedAt: new Date().toISOString() }),
      BATCH_SAVE_ANALYSIS: () => ({ savedCount: 1, failedIds: [] }),
      UPDATE_COMPANY_ANALYSIS: () => ({ updatedAt: new Date().toISOString() }),
      PING: () => ({
        version: '1.0.0-mock',
        timestamp: new Date().toISOString(),
      }),
      GET_STATS: () => ({
        totalCompanies: 10,
        totalImages: 50,
        analyzedImages: 30,
        storageUsed: 1024000,
      }),
    };

    return handlers[type]();
  }
}

/** 실패 시뮬레이션 Mock Handler */
export class FailingMockHandler implements IExtensionHandler {
  constructor(private failingTypes: MessageType[]) {}

  async send<T extends MessageType>(
    type: T,
    _payload?: MessagePayload[T]
  ): Promise<MessageResponse[T]> {
    if (this.failingTypes.includes(type)) {
      throw new Error(`Mock failure for ${type}`);
    }
    return new MockHandler().send(type, _payload);
  }
}
