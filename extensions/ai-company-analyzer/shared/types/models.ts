import type { DataType, ImageSubCategory } from '../constants/categories';

/** 회사 목록 DTO */
export interface CompanyDTO {
  id: string;
  name: string;
  url: string;
  siteType: DataType;
  dataSources: DataType[];
  imageCount: number;
  analyzedCount: number;
  analysisScore?: number;
  analysisRecommendation?: 'recommend' | 'neutral' | 'not_recommend';
  createdAt: string;
  updatedAt: string;
}

/** 회사 상세 DTO */
export interface CompanyDetailDTO extends CompanyDTO {
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
  };
}

/** 이미지 메타데이터 DTO */
export interface ImageMetaDTO {
  id: string;
  companyId: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  category?: ImageSubCategory;
  hasRawText: boolean;
  hasAnalysis: boolean;
  createdAt: string;
}

/** 이미지 데이터 DTO (Base64 포함) */
export interface ImageDataDTO {
  id: string;
  base64: string;
  mimeType: string;
  rawText?: string;
  analysis?: string;
  category?: ImageSubCategory;
}

/** 통계 DTO */
export interface StatsDTO {
  totalCompanies: number;
  totalImages: number;
  analyzedImages: number;
  storageUsed: number;
}
