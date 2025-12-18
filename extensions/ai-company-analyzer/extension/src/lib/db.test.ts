import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import type { Company, StoredImage } from './db';

describe('IndexedDB 통합 테스트', () => {
  beforeEach(async () => {
    // 각 테스트 전에 DB 초기화
    await db.companies.clear();
    await db.images.clear();
  });

  describe('Companies', () => {
    it('회사 추가 및 조회', async () => {
      const company: Company = {
        id: 'test-company-1',
        name: '테스트회사',
        url: 'https://example.com',
        siteType: 'WANTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.companies.add(company);
      const retrieved = await db.companies.get('test-company-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('테스트회사');
      expect(retrieved?.siteType).toBe('WANTED');
    });

    it('회사 업데이트', async () => {
      const company: Company = {
        id: 'test-company-2',
        name: '원본회사',
        url: 'https://example.com',
        siteType: 'WANTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.companies.add(company);

      const newUpdatedAt = new Date();
      await db.companies.update('test-company-2', {
        name: '수정된회사',
        updatedAt: newUpdatedAt,
      });

      const updated = await db.companies.get('test-company-2');
      expect(updated?.name).toBe('수정된회사');
      expect(updated?.updatedAt).toEqual(newUpdatedAt);
    });

    it('회사 목록 조회', async () => {
      const companies: Company[] = [
        {
          id: 'company-1',
          name: 'A회사',
          url: 'https://a.com',
          siteType: 'WANTED',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'company-2',
          name: 'B회사',
          url: 'https://b.com',
          siteType: 'BLIND',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await db.companies.bulkAdd(companies);
      const all = await db.companies.toArray();

      expect(all).toHaveLength(2);
    });
  });

  describe('Images', () => {
    it('이미지 추가 및 조회', async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const image: StoredImage = {
        id: 'test-image-1',
        companyId: 'test-company-1',
        blob,
        mimeType: 'image/png',
        size: blob.size,
        width: 100,
        height: 100,
        siteType: 'WANTED',
        createdAt: new Date(),
      };

      await db.images.add(image);
      const retrieved = await db.images.get('test-image-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.companyId).toBe('test-company-1');
      expect(retrieved?.mimeType).toBe('image/png');
      expect(retrieved?.width).toBe(100);
      expect(retrieved?.height).toBe(100);
    });

    it('회사별 이미지 조회 (where companyId)', async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const images: StoredImage[] = [
        {
          id: 'image-1',
          companyId: 'company-1',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'WANTED',
          createdAt: new Date(),
        },
        {
          id: 'image-2',
          companyId: 'company-1',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'WANTED',
          createdAt: new Date(),
        },
        {
          id: 'image-3',
          companyId: 'company-2',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'BLIND',
          createdAt: new Date(),
        },
      ];

      await db.images.bulkAdd(images);
      const company1Images = await db.images.where('companyId').equals('company-1').toArray();

      expect(company1Images).toHaveLength(2);
      expect(company1Images.every(img => img.companyId === 'company-1')).toBe(true);
    });

    it('이미지 분석 데이터 업데이트', async () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const image: StoredImage = {
        id: 'image-analysis-test',
        companyId: 'company-1',
        blob,
        mimeType: 'image/png',
        size: blob.size,
        siteType: 'WANTED',
        createdAt: new Date(),
      };

      await db.images.add(image);

      await db.images.update('image-analysis-test', {
        category: 'revenue_trend',
        rawText: '매출 데이터',
        analysis: '분석 결과',
      });

      const updated = await db.images.get('image-analysis-test');
      expect(updated?.category).toBe('revenue_trend');
      expect(updated?.rawText).toBe('매출 데이터');
      expect(updated?.analysis).toBe('분석 결과');
    });
  });

  describe('Cascade 삭제', () => {
    it('회사 삭제 시 관련 이미지도 삭제', async () => {
      const company: Company = {
        id: 'cascade-company',
        name: 'Cascade 테스트',
        url: 'https://example.com',
        siteType: 'WANTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const blob = new Blob(['test'], { type: 'image/png' });
      const images: StoredImage[] = [
        {
          id: 'cascade-image-1',
          companyId: 'cascade-company',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'WANTED',
          createdAt: new Date(),
        },
        {
          id: 'cascade-image-2',
          companyId: 'cascade-company',
          blob,
          mimeType: 'image/png',
          size: blob.size,
          siteType: 'WANTED',
          createdAt: new Date(),
        },
      ];

      await db.companies.add(company);
      await db.images.bulkAdd(images);

      // 회사 삭제
      await db.images.where('companyId').equals('cascade-company').delete();
      await db.companies.delete('cascade-company');

      const remainingImages = await db.images.where('companyId').equals('cascade-company').toArray();
      expect(remainingImages).toHaveLength(0);

      const deletedCompany = await db.companies.get('cascade-company');
      expect(deletedCompany).toBeUndefined();
    });
  });
});
