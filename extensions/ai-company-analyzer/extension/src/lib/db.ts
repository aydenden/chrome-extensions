import Dexie, { type Table } from 'dexie';
import type { DataType, ImageSubCategory } from '@shared/constants/categories';
import type { AnalysisStep, SynthesisResult } from '@shared/types';

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

/** AnalysisSession 테이블 스키마 (백그라운드 분석 세션) */
export interface AnalysisSession {
  id: string;
  companyId: string;
  companyName: string;
  imageIds: string[];
  step: AnalysisStep;
  current: number;
  total: number;
  currentImageId?: string;
  completedImageIds: string[];
  failedImageIds: string[];
  results: Array<{
    imageId: string;
    category: ImageSubCategory;
    rawText: string;
    analysis: string;
  }>;
  synthesis: SynthesisResult | null;
  analysisContext?: string;
  promptSettings?: {
    imageAnalysis?: string;
    synthesis?: string;
  };
  model: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** OllamaSettings 테이블 스키마 */
export interface OllamaSettings {
  id: 'default';
  endpoint: string;
  model: string;
  updatedAt: Date;
}

class AnalyzerDatabase extends Dexie {
  companies!: Table<Company, string>;
  images!: Table<StoredImage, string>;
  analysisSessions!: Table<AnalysisSession, string>;
  ollamaSettings!: Table<OllamaSettings, string>;

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

    // Version 4: 백그라운드 분석 세션 및 Ollama 설정 테이블 추가
    this.version(4).stores({
      companies: 'id, name, url, siteType, createdAt, updatedAt',
      images: 'id, companyId, siteType, category, analyzedModel, createdAt',
      analysisSessions: 'id, companyId, step, createdAt, updatedAt',
      ollamaSettings: 'id',
    });
  }
}

export const db = new AnalyzerDatabase();
