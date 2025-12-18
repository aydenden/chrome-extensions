# Feature 06: External API 회사 관련 엔드포인트

## 개요

회사 관련 External API 엔드포인트를 구현합니다.

## 범위

- GET_COMPANIES (필터, 정렬)
- GET_COMPANY
- DELETE_COMPANY (Cascade 삭제)

## 의존성

- Feature 05: Extension External API Basic

## 구현 상세

### extension/src/background/handlers/company-handlers.ts

```typescript
import { registerHandler } from '../external-api';
import type { CompanyDTO, CompanyDetailDTO } from '@shared/types';
import {
  getAllCompanies,
  getCompaniesSorted,
  getCompany,
  deleteCompany,
  getImagesByCompany,
  getDataSourcesForCompany,
  getImageCount,
  getAnalyzedImageCount,
} from '@/lib/storage';

/** Company → CompanyDTO 변환 */
async function toCompanyDTO(company: any): Promise<CompanyDTO> {
  const [imageCount, analyzedCount, dataSources] = await Promise.all([
    getImageCount(company.id),
    getAnalyzedImageCount(company.id),
    getDataSourcesForCompany(company.id),
  ]);

  return {
    id: company.id,
    name: company.name,
    url: company.url,
    siteType: company.siteType,
    dataSources,
    imageCount,
    analyzedCount,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

/** Company → CompanyDetailDTO 변환 */
async function toCompanyDetailDTO(company: any): Promise<CompanyDetailDTO> {
  const dto = await toCompanyDTO(company);

  // 분석 결과 집계 (모든 이미지 분석 완료 시)
  const images = await getImagesByCompany(company.id);
  const analyzedImages = images.filter(img => img.analysis);

  let analysis: CompanyDetailDTO['analysis'];

  if (analyzedImages.length > 0 && analyzedImages.length === images.length) {
    // 모든 이미지 분석 완료 시 집계
    // TODO: 점수 계산 로직 추가 필요
    analysis = {
      analyzedAt: new Date().toISOString(),
    };
  }

  return {
    ...dto,
    metadata: company.metadata,
    analysis,
  };
}

export function registerCompanyHandlers(): void {
  // GET_COMPANIES
  registerHandler('GET_COMPANIES', async (payload) => {
    const { siteType, sortBy = 'createdAt', sortOrder = 'desc' } = payload || {};

    let companies = await getCompaniesSorted(sortBy, sortOrder);

    // siteType 필터
    if (siteType) {
      companies = companies.filter(c => c.siteType === siteType);
    }

    // DTO 변환
    const dtos = await Promise.all(companies.map(toCompanyDTO));
    return dtos;
  });

  // GET_COMPANY
  registerHandler('GET_COMPANY', async (payload) => {
    const { companyId } = payload;
    const company = await getCompany(companyId);

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    return toCompanyDetailDTO(company);
  });

  // DELETE_COMPANY
  registerHandler('DELETE_COMPANY', async (payload) => {
    const { companyId } = payload;
    const company = await getCompany(companyId);

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    const deletedImages = await deleteCompany(companyId);

    return { deletedImages };
  });
}
```

### external-api.ts 업데이트

```typescript
import { registerCompanyHandlers } from './handlers/company-handlers';

function registerBasicHandlers(): void {
  // ... 기존 PING, GET_STATS 핸들러

  // Company 핸들러 등록
  registerCompanyHandlers();
}
```

## API 사용 예시

### GET_COMPANIES

```typescript
// 모든 회사 조회 (최신순)
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'GET_COMPANIES',
}, callback);

// 필터 + 정렬
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'GET_COMPANIES',
  payload: {
    siteType: 'WANTED',
    sortBy: 'name',
    sortOrder: 'asc',
  }
}, callback);
```

### GET_COMPANY

```typescript
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'GET_COMPANY',
  payload: { companyId: 'company_abc123' }
}, callback);

// 응답
{
  success: true,
  data: {
    id: 'company_abc123',
    name: '(주)테크스타트',
    url: 'https://...',
    siteType: 'WANTED',
    dataSources: ['WANTED', 'INNOFOREST'],
    imageCount: 5,
    analyzedCount: 3,
    metadata: {
      industry: 'IT/소프트웨어',
      employeeCount: '50명',
    },
    analysis: {
      score: 72,
      runway: '18개월',
      riskLevel: 'low',
    },
    createdAt: '2024-01-15T09:30:00.000Z',
    updatedAt: '2024-01-15T10:45:00.000Z',
  }
}
```

### DELETE_COMPANY

```typescript
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'DELETE_COMPANY',
  payload: { companyId: 'company_abc123' }
}, callback);

// 응답
{ success: true, data: { deletedImages: 5 } }
```

## 완료 기준

- [ ] GET_COMPANIES: 회사 목록 조회 성공
- [ ] GET_COMPANIES: siteType 필터 동작
- [ ] GET_COMPANIES: sortBy, sortOrder 정렬 동작
- [ ] GET_COMPANY: 개별 회사 상세 조회 성공
- [ ] GET_COMPANY: dataSources 배열 포함
- [ ] DELETE_COMPANY: 회사 삭제 성공
- [ ] DELETE_COMPANY: 연결된 이미지 cascade 삭제
- [ ] 통합 테스트 통과

## 참조 문서

- spec/02-extension-api.md Section 3.1 (회사 관련 API)
