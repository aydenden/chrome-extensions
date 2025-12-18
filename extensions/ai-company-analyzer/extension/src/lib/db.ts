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

    this.version(2).stores({
      companies: 'id, name, url, siteType, createdAt, updatedAt',
      images: 'id, companyId, siteType, category, createdAt',
    });
  }
}

export const db = new AnalyzerDatabase();
