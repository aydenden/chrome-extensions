import { z } from 'zod';
import { DATA_TYPES, IMAGE_SUB_CATEGORIES } from '../constants/categories';

export const DataTypeSchema = z.enum(DATA_TYPES);
export const ImageSubCategorySchema = z.enum(IMAGE_SUB_CATEGORIES);

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  url: z.string().url(),
  siteType: DataTypeSchema,
  dataSources: z.array(DataTypeSchema).optional().default([]),
  imageCount: z.number().int().min(0),
  analyzedCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CompanyDetailSchema = CompanySchema.extend({
  metadata: z.object({
    industry: z.string().optional(),
    employeeCount: z.string().optional(),
    foundedYear: z.string().optional(),
  }).optional(),
  analysis: z.object({
    score: z.number().min(0).max(100).optional(),
    runway: z.string().optional(),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    summary: z.string().optional(),
    analyzedAt: z.string().datetime().optional(),
  }).optional(),
});

export const ImageMetaSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  mimeType: z.string(),
  size: z.number().int().min(0),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  category: ImageSubCategorySchema.optional(),
  hasRawText: z.boolean(),
  hasAnalysis: z.boolean(),
  createdAt: z.string().datetime(),
});

export const ImageDataSchema = z.object({
  id: z.string(),
  base64: z.string(),
  mimeType: z.string(),
  rawText: z.string().optional(),
  analysis: z.string().optional(),
  category: ImageSubCategorySchema.optional(),
});

export const StatsSchema = z.object({
  totalCompanies: z.number().int().min(0),
  totalImages: z.number().int().min(0),
  analyzedImages: z.number().int().min(0),
  storageUsed: z.number().int().min(0),
});

// 타입 추론 헬퍼
export type ValidatedCompany = z.infer<typeof CompanySchema>;
export type ValidatedCompanyDetail = z.infer<typeof CompanyDetailSchema>;
export type ValidatedImageMeta = z.infer<typeof ImageMetaSchema>;
export type ValidatedImageData = z.infer<typeof ImageDataSchema>;
