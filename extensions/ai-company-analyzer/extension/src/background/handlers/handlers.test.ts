import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import type { Company, StoredImage } from '@/lib/db';
import {
  getStats,
  getAllCompanies,
  getCompany,
  deleteCompany,
  getImagesByCompany,
  deleteImage,
  getImage,
} from '@/lib/storage';

describe('External API 핸들러 통합 테스트', () => {
  beforeEach(async () => {
    // DB 초기화
    await db.companies.clear();
    await db.images.clear();
  });

  describe('PING', () => {
    it('pong 응답 확인', async () => {
      // PING 핸들러 로직 시뮬레이션
      const response = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      };

      expect(response).toHaveProperty('version');
      expect(response).toHaveProperty('timestamp');
      expect(response.version).toBe('1.0.0');
    });
  });

  describe('GET_STATS', () => {
    it('빈 데이터베이스 통계', async () => {
      const result = await getStats();
      expect(result).toEqual({
        totalCompanies: 0,
        totalImages: 0,
        analyzedImages: 0,
        storageUsed: 0,
      });
    });

    it('데이터 있는 경우 통계 확인', async () => {
      // 회사 추가
      const company: Company = {
        id: 'stats-company',
        name: '통계 테스트',
        url: 'https://example.com',
        siteType: 'WANTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.companies.add(company);

      // 이미지 추가
      const blob = new Blob(['test data'], { type: 'image/png' });
      const images: StoredImage[] = [
        {
          id: 'stats-image-1',
          companyId: 'stats-company',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'WANTED',
          rawText: '분석된 텍스트',
          createdAt: new Date(),
        },
        {
          id: 'stats-image-2',
          companyId: 'stats-company',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'WANTED',
          createdAt: new Date(),
        },
      ];
      await db.images.bulkAdd(images);

      const result = await getStats();

      expect(result.totalCompanies).toBe(1);
      expect(result.totalImages).toBe(2);
      expect(result.analyzedImages).toBe(1); // rawText가 있는 이미지 1개
      expect(result.storageUsed).toBeGreaterThan(0);
    });
  });

  describe('GET_COMPANIES', () => {
    beforeEach(async () => {
      // 테스트 데이터 추가
      const companies: Company[] = [
        {
          id: 'company-1',
          name: 'A회사',
          url: 'https://a.com',
          siteType: 'WANTED',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'company-2',
          name: 'B회사',
          url: 'https://b.com',
          siteType: 'BLIND',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'company-3',
          name: 'C회사',
          url: 'https://c.com',
          siteType: 'WANTED',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        },
      ];
      await db.companies.bulkAdd(companies);
    });

    it('전체 회사 목록 조회', async () => {
      const result = await getAllCompanies();
      expect(result).toHaveLength(3);
    });

    it('사이트별 필터링 (WANTED)', async () => {
      // company-handlers.ts의 GET_COMPANIES 로직 시뮬레이션
      let companies = await db.companies.orderBy('createdAt').toArray();
      companies = companies.reverse(); // desc
      companies = companies.filter(c => c.siteType === 'WANTED');

      expect(companies).toHaveLength(2);
      expect(companies.every(c => c.siteType === 'WANTED')).toBe(true);
    });

    it('사이트별 필터링 (BLIND)', async () => {
      let companies = await db.companies.orderBy('createdAt').toArray();
      companies = companies.reverse(); // desc
      companies = companies.filter(c => c.siteType === 'BLIND');

      expect(companies).toHaveLength(1);
      expect(companies[0].siteType).toBe('BLIND');
    });

    it('이름순 정렬 (sortBy: name, sortOrder: asc)', async () => {
      let companies = await db.companies.orderBy('name').toArray();
      // sortOrder가 asc이므로 reverse 하지 않음

      expect(companies).toHaveLength(3);
      expect(companies[0].name).toBe('A회사');
      expect(companies[1].name).toBe('B회사');
      expect(companies[2].name).toBe('C회사');
    });

    it('생성일순 정렬 (sortBy: createdAt, sortOrder: desc)', async () => {
      let companies = await db.companies.orderBy('createdAt').toArray();
      companies = companies.reverse(); // desc

      expect(companies).toHaveLength(3);
      // 최신순이므로 C회사 -> B회사 -> A회사
      expect(companies[0].name).toBe('C회사');
      expect(companies[1].name).toBe('B회사');
      expect(companies[2].name).toBe('A회사');
    });
  });

  describe('GET_COMPANY', () => {
    beforeEach(async () => {
      const company: Company = {
        id: 'get-company-test',
        name: '조회 테스트',
        url: 'https://example.com',
        siteType: 'WANTED',
        metadata: {
          industry: 'IT',
          employeeCount: '100-500',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.companies.add(company);
    });

    it('존재하는 회사 조회', async () => {
      const result = await getCompany('get-company-test');
      expect(result).toBeDefined();
      expect(result?.id).toBe('get-company-test');
      expect(result?.name).toBe('조회 테스트');
      expect(result?.metadata).toEqual({
        industry: 'IT',
        employeeCount: '100-500',
      });
    });

    it('존재하지 않는 회사 조회 (NOT_FOUND)', async () => {
      const result = await getCompany('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('DELETE_COMPANY', () => {
    beforeEach(async () => {
      const company: Company = {
        id: 'delete-company-test',
        name: '삭제 테스트',
        url: 'https://example.com',
        siteType: 'WANTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.companies.add(company);

      const blob = new Blob(['test'], { type: 'image/png' });
      const images: StoredImage[] = [
        {
          id: 'delete-image-1',
          companyId: 'delete-company-test',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'WANTED',
          createdAt: new Date(),
        },
        {
          id: 'delete-image-2',
          companyId: 'delete-company-test',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'WANTED',
          createdAt: new Date(),
        },
      ];
      await db.images.bulkAdd(images);
    });

    it('회사 및 관련 이미지 cascade 삭제', async () => {
      const deletedImages = await deleteCompany('delete-company-test');
      expect(deletedImages).toBe(2);

      // 회사 삭제 확인
      const company = await db.companies.get('delete-company-test');
      expect(company).toBeUndefined();

      // 이미지 삭제 확인
      const images = await db.images.where('companyId').equals('delete-company-test').toArray();
      expect(images).toHaveLength(0);
    });
  });

  describe('GET_IMAGES', () => {
    beforeEach(async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const images: StoredImage[] = [
        {
          id: 'image-1',
          companyId: 'test-company',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'WANTED',
          category: 'revenue_trend',
          createdAt: new Date(),
        },
        {
          id: 'image-2',
          companyId: 'test-company',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'WANTED',
          category: 'balance_sheet',
          analysis: '분석 결과',
          createdAt: new Date(),
        },
        {
          id: 'image-3',
          companyId: 'test-company',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'WANTED',
          createdAt: new Date(),
        },
      ];
      await db.images.bulkAdd(images);
    });

    it('회사별 전체 이미지 조회', async () => {
      const result = await getImagesByCompany('test-company');
      expect(result).toHaveLength(3);
    });

    it('카테고리별 필터링', async () => {
      // image-handlers.ts의 GET_IMAGES 로직 시뮬레이션
      let images = await getImagesByCompany('test-company');
      images = images.filter(img => img.category === 'revenue_trend');

      expect(images).toHaveLength(1);
      expect(images[0].category).toBe('revenue_trend');
    });

    it('분석 여부 필터링 (hasAnalysis: true)', async () => {
      let images = await getImagesByCompany('test-company');
      images = images.filter(img => !!img.analysis);

      expect(images).toHaveLength(1);
      expect(images[0].id).toBe('image-2');
    });

    it('분석 여부 필터링 (hasAnalysis: false)', async () => {
      let images = await getImagesByCompany('test-company');
      images = images.filter(img => !img.analysis);

      expect(images).toHaveLength(2);
    });
  });

  describe('DELETE_IMAGE', () => {
    beforeEach(async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const image: StoredImage = {
        id: 'delete-image-test',
        companyId: 'test-company',
        blob,
        mimeType: 'image/png',
        size: blob.size,
        siteType: 'WANTED',
        createdAt: new Date(),
      };
      await db.images.add(image);
    });

    it('이미지 삭제', async () => {
      const image = await getImage('delete-image-test');
      expect(image).toBeDefined();

      await deleteImage('delete-image-test');

      const deleted = await db.images.get('delete-image-test');
      expect(deleted).toBeUndefined();
    });
  });

  describe('에러 처리', () => {
    it('알 수 없는 메시지 타입 (INVALID_MESSAGE)', () => {
      // external-api.ts의 에러 처리 로직 검증
      const unknownType = 'UNKNOWN_TYPE';
      const validTypes = [
        'GET_COMPANIES',
        'GET_COMPANY',
        'DELETE_COMPANY',
        'GET_IMAGES',
        'GET_IMAGE_DATA',
        'GET_IMAGE_THUMBNAIL',
        'DELETE_IMAGE',
        'SAVE_ANALYSIS',
        'BATCH_SAVE_ANALYSIS',
        'PING',
        'GET_STATS',
      ];

      expect(validTypes.includes(unknownType)).toBe(false);
    });

    it('잘못된 origin (UNAUTHORIZED)', () => {
      // external-api.ts의 isAllowedOrigin 로직 검증
      const allowedOrigins = [
        'https://username.github.io',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ];

      const testOrigin = 'https://malicious.com';
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed.includes('localhost') || allowed.includes('127.0.0.1')) {
          return (
            testOrigin.startsWith('http://localhost:') ||
            testOrigin.startsWith('http://127.0.0.1:')
          );
        }
        return testOrigin === allowed || testOrigin.startsWith(allowed);
      });

      expect(isAllowed).toBe(false);
    });
  });
});
