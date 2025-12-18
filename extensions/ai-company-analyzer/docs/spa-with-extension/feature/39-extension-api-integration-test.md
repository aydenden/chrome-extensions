# Feature 39: Extension API 통합 테스트

## 개요

Extension의 External API 엔드포인트에 대한 통합 테스트를 작성합니다.

## 범위

- External API 핸들러 테스트
- IndexedDB 통합 테스트
- 메시지 라우팅 테스트
- 에러 처리 테스트

## 의존성

- Feature 08: External API 분석 저장

## 구현 상세

### extension/src/api/handlers.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleExternalMessage } from './handlers';
import { db } from '../lib/db';
import type { ExternalMessage } from '@shared/types/messages';

// IndexedDB 초기화
beforeEach(async () => {
  await db.companies.clear();
  await db.images.clear();
});

afterEach(async () => {
  await db.companies.clear();
  await db.images.clear();
});

describe('PING', () => {
  it('pong 응답', async () => {
    const message: ExternalMessage = { type: 'PING' };
    const result = await handleExternalMessage(message, 'https://example.com');

    expect(result.success).toBe(true);
    expect(result.data).toBe('pong');
  });
});

describe('GET_STATS', () => {
  it('빈 데이터베이스 통계', async () => {
    const message: ExternalMessage = { type: 'GET_STATS' };
    const result = await handleExternalMessage(message, 'https://example.com');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      totalCompanies: 0,
      totalImages: 0,
      storageUsed: expect.any(Number),
    });
  });

  it('데이터 있는 경우 통계', async () => {
    // 테스트 데이터 삽입
    await db.companies.add({
      id: 'company-1',
      name: 'Test Company',
      dataSources: ['WANTED'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.images.add({
      id: 'image-1',
      companyId: 'company-1',
      dataType: 'WANTED',
      subCategory: 'JOB_POSTING',
      dataUrl: 'data:image/png;base64,test',
      createdAt: new Date().toISOString(),
    });

    const message: ExternalMessage = { type: 'GET_STATS' };
    const result = await handleExternalMessage(message, 'https://example.com');

    expect(result.data.totalCompanies).toBe(1);
    expect(result.data.totalImages).toBe(1);
  });
});

describe('GET_COMPANIES', () => {
  beforeEach(async () => {
    // 테스트 데이터 삽입
    await db.companies.bulkAdd([
      {
        id: 'company-1',
        name: 'Alpha',
        dataSources: ['WANTED'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
      {
        id: 'company-2',
        name: 'Beta',
        dataSources: ['BLIND'],
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ]);
  });

  it('전체 회사 목록 조회', async () => {
    const message: ExternalMessage = { type: 'GET_COMPANIES' };
    const result = await handleExternalMessage(message, 'https://example.com');

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it('사이트별 필터링', async () => {
    const message: ExternalMessage = {
      type: 'GET_COMPANIES',
      payload: { siteType: 'WANTED' },
    };
    const result = await handleExternalMessage(message, 'https://example.com');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Alpha');
  });

  it('이름순 정렬', async () => {
    const message: ExternalMessage = {
      type: 'GET_COMPANIES',
      payload: { sortBy: 'name', sortOrder: 'asc' },
    };
    const result = await handleExternalMessage(message, 'https://example.com');

    expect(result.data[0].name).toBe('Alpha');
    expect(result.data[1].name).toBe('Beta');
  });
});

describe('GET_COMPANY', () => {
  it('존재하는 회사 조회', async () => {
    await db.companies.add({
      id: 'company-1',
      name: 'Test Company',
      dataSources: ['WANTED'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const message: ExternalMessage = {
      type: 'GET_COMPANY',
      payload: { companyId: 'company-1' },
    };
    const result = await handleExternalMessage(message, 'https://example.com');

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Test Company');
  });

  it('존재하지 않는 회사 조회', async () => {
    const message: ExternalMessage = {
      type: 'GET_COMPANY',
      payload: { companyId: 'non-existent' },
    };
    const result = await handleExternalMessage(message, 'https://example.com');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});

describe('DELETE_COMPANY', () => {
  it('회사 및 관련 이미지 삭제', async () => {
    await db.companies.add({
      id: 'company-1',
      name: 'Test',
      dataSources: ['WANTED'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.images.add({
      id: 'image-1',
      companyId: 'company-1',
      dataType: 'WANTED',
      subCategory: 'JOB_POSTING',
      dataUrl: 'data:test',
      createdAt: new Date().toISOString(),
    });

    const message: ExternalMessage = {
      type: 'DELETE_COMPANY',
      payload: { companyId: 'company-1' },
    };
    const result = await handleExternalMessage(message, 'https://example.com');

    expect(result.success).toBe(true);

    const company = await db.companies.get('company-1');
    expect(company).toBeUndefined();

    const images = await db.images.where('companyId').equals('company-1').toArray();
    expect(images).toHaveLength(0);
  });
});

describe('에러 처리', () => {
  it('알 수 없는 메시지 타입', async () => {
    const message = { type: 'UNKNOWN_TYPE' } as any;
    const result = await handleExternalMessage(message, 'https://example.com');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_MESSAGE');
  });

  it('잘못된 origin', async () => {
    const message: ExternalMessage = { type: 'PING' };
    const result = await handleExternalMessage(message, 'https://malicious.com');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('UNAUTHORIZED');
  });
});
```

### extension/src/lib/db.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, type Company, type StoredImage } from './db';

describe('Database Operations', () => {
  beforeEach(async () => {
    await db.companies.clear();
    await db.images.clear();
  });

  afterEach(async () => {
    await db.companies.clear();
    await db.images.clear();
  });

  describe('Companies', () => {
    it('회사 추가 및 조회', async () => {
      const company: Company = {
        id: 'test-id',
        name: 'Test Company',
        dataSources: ['WANTED'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.companies.add(company);
      const retrieved = await db.companies.get('test-id');

      expect(retrieved).toEqual(company);
    });

    it('회사 업데이트', async () => {
      await db.companies.add({
        id: 'test-id',
        name: 'Original',
        dataSources: ['WANTED'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await db.companies.update('test-id', { name: 'Updated' });
      const retrieved = await db.companies.get('test-id');

      expect(retrieved?.name).toBe('Updated');
    });
  });

  describe('Images', () => {
    it('이미지 추가 및 조회', async () => {
      const image: StoredImage = {
        id: 'img-1',
        companyId: 'company-1',
        dataType: 'WANTED',
        subCategory: 'JOB_POSTING',
        dataUrl: 'data:image/png;base64,test',
        createdAt: new Date().toISOString(),
      };

      await db.images.add(image);
      const retrieved = await db.images.get('img-1');

      expect(retrieved).toEqual(image);
    });

    it('회사별 이미지 조회', async () => {
      await db.images.bulkAdd([
        {
          id: 'img-1',
          companyId: 'company-1',
          dataType: 'WANTED',
          subCategory: 'JOB_POSTING',
          dataUrl: 'data:test1',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'img-2',
          companyId: 'company-1',
          dataType: 'BLIND',
          subCategory: 'SALARY_REVIEW',
          dataUrl: 'data:test2',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'img-3',
          companyId: 'company-2',
          dataType: 'WANTED',
          subCategory: 'JOB_POSTING',
          dataUrl: 'data:test3',
          createdAt: new Date().toISOString(),
        },
      ]);

      const images = await db.images.where('companyId').equals('company-1').toArray();
      expect(images).toHaveLength(2);
    });
  });
});
```

## 완료 기준

- [ ] PING 테스트
- [ ] GET_STATS 테스트
- [ ] GET_COMPANIES 테스트 (필터, 정렬)
- [ ] GET_COMPANY 테스트 (존재/미존재)
- [ ] DELETE_COMPANY 테스트 (cascade)
- [ ] 에러 처리 테스트
- [ ] IndexedDB CRUD 테스트

## 참조 문서

- spec/02-extension-api.md Section 4 (API 명세)
