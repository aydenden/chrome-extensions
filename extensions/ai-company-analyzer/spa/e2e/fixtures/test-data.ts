import type {
  CompanyDTO,
  CompanyDetailDTO,
  ImageMetaDTO,
  ImageDataDTO,
  StatsDTO,
} from '@shared/types';

/** 빈 상태 Mock 데이터 */
export const emptyData = {
  companies: [] as CompanyDTO[],
  stats: {
    totalCompanies: 0,
    totalImages: 0,
    analyzedImages: 0,
    storageUsed: 0,
  } as StatsDTO,
};

/** 샘플 회사 데이터 */
export const sampleCompanies: CompanyDTO[] = [
  {
    id: 'company-1',
    name: '테스트 기업 A',
    url: 'https://www.wanted.co.kr/wd/123',
    siteType: 'wanted',
    dataSources: ['wanted'],
    imageCount: 5,
    analyzedCount: 3,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'company-2',
    name: '테스트 기업 B',
    url: 'https://www.jobkorea.co.kr/recruit/456',
    siteType: 'jobkorea',
    dataSources: ['jobkorea'],
    imageCount: 3,
    analyzedCount: 0,
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
  },
  {
    id: 'company-3',
    name: '테스트 기업 C',
    url: 'https://www.saramin.co.kr/zf_user/789',
    siteType: 'saramin',
    dataSources: ['saramin', 'wanted'],
    imageCount: 10,
    analyzedCount: 10,
    createdAt: '2024-01-04T00:00:00.000Z',
    updatedAt: '2024-01-05T00:00:00.000Z',
  },
];

/** 샘플 회사 상세 데이터 */
export const sampleCompanyDetail: CompanyDetailDTO = {
  ...sampleCompanies[0],
  metadata: {
    industry: 'IT/소프트웨어',
    employeeCount: '50-100명',
    foundedYear: '2020',
  },
  analysis: {
    score: 75,
    runway: '18개월',
    riskLevel: 'medium',
    summary: '안정적인 성장세를 보이고 있으나 일부 리스크 요인이 존재합니다.',
    analyzedAt: '2024-01-06T00:00:00.000Z',
  },
};

/** 샘플 이미지 메타데이터 */
export const sampleImages: ImageMetaDTO[] = [
  {
    id: 'image-1',
    companyId: 'company-1',
    mimeType: 'image/png',
    size: 1024000,
    width: 1920,
    height: 1080,
    category: 'company-culture',
    hasRawText: true,
    hasAnalysis: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'image-2',
    companyId: 'company-1',
    mimeType: 'image/jpeg',
    size: 512000,
    width: 1280,
    height: 720,
    category: 'company-benefits',
    hasRawText: true,
    hasAnalysis: false,
    createdAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'image-3',
    companyId: 'company-1',
    mimeType: 'image/png',
    size: 2048000,
    width: 2560,
    height: 1440,
    category: 'financial-info',
    hasRawText: false,
    hasAnalysis: false,
    createdAt: '2024-01-03T00:00:00.000Z',
  },
];

/** 샘플 이미지 데이터 (Base64) */
export const sampleImageData: ImageDataDTO = {
  id: 'image-1',
  base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  mimeType: 'image/png',
  rawText: '샘플 OCR 텍스트: 회사 소개 및 복리후생 정보',
  analysis: '이 이미지는 회사의 복리후생 정보를 담고 있습니다.',
  category: 'company-culture',
};

/** 샘플 썸네일 데이터 */
export const sampleThumbnail = {
  base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q==',
  mimeType: 'image/jpeg' as const,
  width: 100,
  height: 100,
};

/** 샘플 통계 데이터 */
export const sampleStats: StatsDTO = {
  totalCompanies: 3,
  totalImages: 18,
  analyzedImages: 13,
  storageUsed: 5242880, // 5MB
};

/** 전체 샘플 데이터 */
export const sampleData = {
  companies: sampleCompanies,
  companyDetail: sampleCompanyDetail,
  images: sampleImages,
  imageData: sampleImageData,
  thumbnail: sampleThumbnail,
  stats: sampleStats,
};
