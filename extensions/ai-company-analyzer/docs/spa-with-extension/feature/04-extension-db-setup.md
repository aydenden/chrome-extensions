# Feature 04: Extension IndexedDB (Dexie) 설정

## 개요

Extension에서 사용할 IndexedDB 스키마를 Dexie로 설정합니다.

## 범위

- extension/src/lib/db.ts (Dexie 스키마)
- companies, images 테이블 정의
- 기본 CRUD 함수

## 의존성

- Feature 03: Shared Types (타입 import)

## 구현 상세

### extension/src/lib/db.ts

```typescript
import Dexie, { type Table } from 'dexie';
import type { DataType, ImageSubCategory } from '@shared/constants/categories';

/** Company 테이블 스키마 */
export interface Company {
  id: string;
  name: string;
  url: string;
  siteType: DataType;
  metadata?: {
    industry?: string;
    employeeCount?: string;
    foundedYear?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/** Image 테이블 스키마 */
export interface StoredImage {
  id: string;
  companyId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  siteType: DataType;
  category?: ImageSubCategory;
  rawText?: string;
  analysis?: string;
  createdAt: Date;
  updatedAt?: Date;
}

class AnalyzerDatabase extends Dexie {
  companies!: Table<Company, string>;
  images!: Table<StoredImage, string>;

  constructor() {
    super('AICompanyAnalyzer');

    this.version(1).stores({
      companies: 'id, name, siteType, createdAt, updatedAt',
      images: 'id, companyId, siteType, category, createdAt',
    });
  }
}

export const db = new AnalyzerDatabase();
```

### extension/src/lib/storage.ts

```typescript
import { db, type Company, type StoredImage } from './db';
import type { DataType, ImageSubCategory } from '@shared/constants/categories';

// ============ Company CRUD ============

export async function createCompany(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
  const now = new Date();
  const company: Company = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await db.companies.add(company);
  return company;
}

export async function getCompany(id: string): Promise<Company | undefined> {
  return db.companies.get(id);
}

export async function getAllCompanies(): Promise<Company[]> {
  return db.companies.toArray();
}

export async function getCompaniesSorted(
  sortBy: 'name' | 'createdAt' | 'updatedAt' = 'createdAt',
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<Company[]> {
  const companies = await db.companies.toArray();
  return companies.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal instanceof Date && bVal instanceof Date) {
      return sortOrder === 'asc'
        ? aVal.getTime() - bVal.getTime()
        : bVal.getTime() - aVal.getTime();
    }

    const aStr = String(aVal);
    const bStr = String(bVal);
    return sortOrder === 'asc'
      ? aStr.localeCompare(bStr, 'ko')
      : bStr.localeCompare(aStr, 'ko');
  });
}

export async function updateCompany(id: string, data: Partial<Company>): Promise<void> {
  await db.companies.update(id, {
    ...data,
    updatedAt: new Date(),
  });
}

export async function deleteCompany(id: string): Promise<number> {
  // 연결된 이미지 먼저 삭제
  const deletedImages = await db.images.where('companyId').equals(id).delete();
  await db.companies.delete(id);
  return deletedImages;
}

export async function findCompanyByUrl(url: string): Promise<Company | undefined> {
  const companies = await db.companies.toArray();
  return companies.find(c => c.url === url);
}

// ============ Image CRUD ============

export async function saveImage(
  companyId: string,
  blob: Blob,
  siteType: DataType,
  dimensions?: { width: number; height: number }
): Promise<StoredImage> {
  const image: StoredImage = {
    id: crypto.randomUUID(),
    companyId,
    blob,
    mimeType: blob.type,
    size: blob.size,
    width: dimensions?.width,
    height: dimensions?.height,
    siteType,
    createdAt: new Date(),
  };
  await db.images.add(image);
  return image;
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
  return db.images.get(id);
}

export async function getImagesByCompany(companyId: string): Promise<StoredImage[]> {
  return db.images.where('companyId').equals(companyId).toArray();
}

export async function updateImageAnalysis(
  imageId: string,
  data: {
    category: ImageSubCategory;
    rawText: string;
    analysis: string;
  }
): Promise<void> {
  await db.images.update(imageId, {
    ...data,
    updatedAt: new Date(),
  });
}

export async function deleteImage(id: string): Promise<void> {
  await db.images.delete(id);
}

export async function getImageCount(companyId: string): Promise<number> {
  return db.images.where('companyId').equals(companyId).count();
}

export async function getAnalyzedImageCount(companyId: string): Promise<number> {
  const images = await db.images.where('companyId').equals(companyId).toArray();
  return images.filter(img => img.category && img.category !== 'unknown').length;
}

// ============ Stats ============

export async function getStats(): Promise<{
  totalCompanies: number;
  totalImages: number;
  analyzedImages: number;
  storageUsed: number;
}> {
  const companies = await db.companies.count();
  const images = await db.images.toArray();

  const analyzedImages = images.filter(img => img.rawText || img.analysis).length;
  const storageUsed = images.reduce((sum, img) => sum + img.size, 0);

  return {
    totalCompanies: companies,
    totalImages: images.length,
    analyzedImages,
    storageUsed,
  };
}

// ============ Data Sources ============

export async function getDataSourcesForCompany(companyId: string): Promise<DataType[]> {
  const images = await db.images.where('companyId').equals(companyId).toArray();
  const sources = new Set(images.map(img => img.siteType));
  return Array.from(sources);
}
```

## 완료 기준

- [ ] Dexie DB 인스턴스 생성 성공
- [ ] Company CRUD 함수 동작
- [ ] Image CRUD 함수 동작
- [ ] 유닛 테스트 통과

## 참조 문서

- spec/04-data-flow.md Section 4 (데이터 모델)
