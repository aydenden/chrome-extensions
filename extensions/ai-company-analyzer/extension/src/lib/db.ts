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
  analysis?: {
    score?: number;
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    recommendation?: 'recommend' | 'neutral' | 'not_recommend';
    reasoning?: string;
    analyzedAt?: string;
    analyzedModel?: string; // 종합 분석에 사용된 모델명
  };
  analysisContext?: string; // 전체 분석 컨텍스트 메모
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
  analyzedModel?: string; // 분석에 사용된 모델명
  memo?: string; // 개별 이미지 메모
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

    // Version 3: analyzedModel, memo 필드 추가
    this.version(3).stores({
      companies: 'id, name, url, siteType, createdAt, updatedAt',
      images: 'id, companyId, siteType, category, analyzedModel, createdAt',
    });
  }
}

export const db = new AnalyzerDatabase();
