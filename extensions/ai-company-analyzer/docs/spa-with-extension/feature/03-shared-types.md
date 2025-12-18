# Feature 03: Shared Types + Zod 스키마 정의

## 개요

Extension과 SPA 간 공유되는 타입과 Zod 런타임 검증 스키마를 정의합니다.

## 범위

- `shared/types/` 디렉토리 생성
- messages.ts (Discriminated Union 메시지 타입)
- models.ts (Company, Image, Analysis DTO)
- validation.ts (Zod 스키마)
- errors.ts (에러 타입 계층)
- constants/categories.ts (DataType, ImageSubCategory)

## 의존성

없음 (독립적으로 시작 가능)

## 구현 상세

### 디렉토리 구조

```
shared/
├── types/
│   ├── index.ts            # re-export
│   ├── messages.ts         # API 메시지 타입
│   ├── models.ts           # 데이터 모델
│   ├── validation.ts       # Zod 스키마
│   └── errors.ts           # 에러 타입
└── constants/
    ├── index.ts
    └── categories.ts       # 상수 정의
```

### shared/constants/categories.ts

```typescript
export const DATA_TYPES = [
  'WANTED',
  'JOBPLANET',
  'SARAMIN',
  'INNOFOREST',
  'DART',
  'SMES',
  'BLIND',
  'OTHER',
] as const;

export type DataType = (typeof DATA_TYPES)[number];

export const IMAGE_SUB_CATEGORIES = [
  'revenue_trend',
  'balance_sheet',
  'income_statement',
  'employee_trend',
  'review_positive',
  'review_negative',
  'company_overview',
  'unknown',
] as const;

export type ImageSubCategory = (typeof IMAGE_SUB_CATEGORIES)[number];

/** 카테고리 한글 매핑 */
export const CATEGORY_LABELS: Record<ImageSubCategory, string> = {
  revenue_trend: '매출 추이',
  balance_sheet: '재무상태표',
  income_statement: '손익계산서',
  employee_trend: '직원 추이',
  review_positive: '긍정 리뷰',
  review_negative: '부정 리뷰',
  company_overview: '회사 개요',
  unknown: '미분류',
};

/** 데이터 소스 컬러 */
export const SOURCE_COLORS: Record<DataType, string> = {
  WANTED: '#2563EB',
  JOBPLANET: '#0D9488',
  SARAMIN: '#7C3AED',
  INNOFOREST: '#047857',
  DART: '#1E293B',
  SMES: '#C2410C',
  BLIND: '#CA8A04',
  OTHER: '#6B7280',
};
```

### shared/types/models.ts

```typescript
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
  createdAt: string;  // ISO 8601
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
    runway?: string;
    riskLevel?: 'low' | 'medium' | 'high';
    summary?: string;
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
```

### shared/types/messages.ts

```typescript
import type { DataType, ImageSubCategory } from '../constants/categories';
import type {
  CompanyDTO,
  CompanyDetailDTO,
  ImageMetaDTO,
  ImageDataDTO,
  StatsDTO,
} from './models';

/** 메시지 타입 */
export type MessageType =
  | 'GET_COMPANIES'
  | 'GET_COMPANY'
  | 'DELETE_COMPANY'
  | 'GET_IMAGES'
  | 'GET_IMAGE_DATA'
  | 'GET_IMAGE_THUMBNAIL'
  | 'DELETE_IMAGE'
  | 'SAVE_ANALYSIS'
  | 'BATCH_SAVE_ANALYSIS'
  | 'PING'
  | 'GET_STATS';

/** 요청 Payload 타입 맵 */
export interface MessagePayload {
  GET_COMPANIES: {
    siteType?: DataType;
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
  } | undefined;
  GET_COMPANY: { companyId: string };
  DELETE_COMPANY: { companyId: string };
  GET_IMAGES: {
    companyId: string;
    filter?: {
      category?: ImageSubCategory;
      hasAnalysis?: boolean;
    };
  };
  GET_IMAGE_DATA: {
    imageId: string;
    includeRawText?: boolean;
    includeAnalysis?: boolean;
  };
  GET_IMAGE_THUMBNAIL: {
    imageId: string;
    maxWidth?: number;
    maxHeight?: number;
  };
  DELETE_IMAGE: { imageId: string };
  SAVE_ANALYSIS: {
    imageId: string;
    category: ImageSubCategory;
    rawText: string;
    analysis: string;
  };
  BATCH_SAVE_ANALYSIS: {
    results: Array<{
      imageId: string;
      category: ImageSubCategory;
      rawText: string;
      analysis: string;
    }>;
  };
  PING: undefined;
  GET_STATS: undefined;
}

/** 응답 타입 맵 */
export interface MessageResponse {
  GET_COMPANIES: CompanyDTO[];
  GET_COMPANY: CompanyDetailDTO;
  DELETE_COMPANY: { deletedImages: number };
  GET_IMAGES: ImageMetaDTO[];
  GET_IMAGE_DATA: ImageDataDTO;
  GET_IMAGE_THUMBNAIL: {
    base64: string;
    mimeType: 'image/jpeg';
    width: number;
    height: number;
  };
  DELETE_IMAGE: null;
  SAVE_ANALYSIS: { updatedAt: string };
  BATCH_SAVE_ANALYSIS: { savedCount: number; failedIds: string[] };
  PING: { version: string; timestamp: string };
  GET_STATS: StatsDTO;
}

/** Discriminated Union 요청 타입 */
export type ExtensionRequest =
  | { type: 'GET_COMPANIES'; payload?: MessagePayload['GET_COMPANIES'] }
  | { type: 'GET_COMPANY'; payload: MessagePayload['GET_COMPANY'] }
  | { type: 'DELETE_COMPANY'; payload: MessagePayload['DELETE_COMPANY'] }
  | { type: 'GET_IMAGES'; payload: MessagePayload['GET_IMAGES'] }
  | { type: 'GET_IMAGE_DATA'; payload: MessagePayload['GET_IMAGE_DATA'] }
  | { type: 'GET_IMAGE_THUMBNAIL'; payload: MessagePayload['GET_IMAGE_THUMBNAIL'] }
  | { type: 'DELETE_IMAGE'; payload: MessagePayload['DELETE_IMAGE'] }
  | { type: 'SAVE_ANALYSIS'; payload: MessagePayload['SAVE_ANALYSIS'] }
  | { type: 'BATCH_SAVE_ANALYSIS'; payload: MessagePayload['BATCH_SAVE_ANALYSIS'] }
  | { type: 'PING' }
  | { type: 'GET_STATS' };

/** API 응답 래퍼 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
  };
}

/** 에러 코드 */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INVALID_PAYLOAD'
  | 'INTERNAL_ERROR'
  | 'RATE_LIMITED';
```

### shared/types/validation.ts

```typescript
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
```

### shared/types/errors.ts

```typescript
export type ErrorCode =
  | 'EXTENSION_ERROR'
  | 'AI_ENGINE_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

/** 기본 앱 에러 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Extension 연결 에러 */
export class ExtensionError extends AppError {
  constructor(message: string) {
    super(message, 'EXTENSION_ERROR', false);
    this.name = 'ExtensionError';
  }
}

/** AI 엔진 에러 */
export class AIEngineError extends AppError {
  constructor(message: string, public engine: string) {
    super(message, 'AI_ENGINE_ERROR', true);
    this.name = 'AIEngineError';
  }
}

/** 유효성 검증 에러 */
export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', true);
    this.name = 'ValidationError';
  }
}
```

### shared/types/index.ts

```typescript
export * from './messages';
export * from './models';
export * from './errors';

export type {
  ValidatedCompany,
  ValidatedCompanyDetail,
  ValidatedImageMeta,
  ValidatedImageData,
} from './validation';

export {
  CompanySchema,
  CompanyDetailSchema,
  ImageMetaSchema,
  ImageDataSchema,
  StatsSchema,
  DataTypeSchema,
  ImageSubCategorySchema,
} from './validation';
```

### shared/constants/index.ts

```typescript
export * from './categories';
```

## 완료 기준

- [ ] TypeScript 컴파일 성공
- [ ] 모든 타입이 Extension과 SPA에서 import 가능
- [ ] Zod 스키마로 런타임 검증 가능

## 참조 문서

- spec/01-architecture.md Section 10 (공유 타입 관리)
- spec/02-extension-api.md Section 3-4 (API 타입)
