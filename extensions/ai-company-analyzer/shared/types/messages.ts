import type { DataType, ImageSubCategory } from '../constants/categories';
import type {
  CompanyDTO,
  CompanyDetailDTO,
  ImageMetaDTO,
  ImageDataDTO,
  StatsDTO,
} from './models';
import type { ErrorCode } from './errors';

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
  | 'UPDATE_COMPANY_ANALYSIS'
  | 'UPDATE_IMAGE_MEMO'
  | 'UPDATE_COMPANY_CONTEXT'
  | 'GET_PROMPT_SETTINGS'
  | 'SET_PROMPT_SETTINGS'
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
      analyzedModel: string; // 분석에 사용된 모델명
    }>;
  };
  UPDATE_IMAGE_MEMO: {
    imageId: string;
    memo: string;
  };
  UPDATE_COMPANY_CONTEXT: {
    companyId: string;
    analysisContext: string;
  };
  UPDATE_COMPANY_ANALYSIS: {
    companyId: string;
    analysis: {
      score: number;
      summary: string;
      strengths: string[];
      weaknesses: string[];
      recommendation: 'recommend' | 'neutral' | 'not_recommend';
      reasoning: string;
      analyzedModel?: string; // 종합 분석에 사용된 모델명
    };
  };
  GET_PROMPT_SETTINGS: undefined;
  SET_PROMPT_SETTINGS: {
    imageAnalysis?: { prompt: string };
    synthesis?: { prompt: string };
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
  UPDATE_COMPANY_ANALYSIS: { updatedAt: string };
  UPDATE_IMAGE_MEMO: { updatedAt: string };
  UPDATE_COMPANY_CONTEXT: { updatedAt: string };
  GET_PROMPT_SETTINGS: {
    imageAnalysis: { prompt: string; updatedAt: string } | null;
    synthesis: { prompt: string; updatedAt: string } | null;
  };
  SET_PROMPT_SETTINGS: { updatedAt: string };
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
  | { type: 'UPDATE_COMPANY_ANALYSIS'; payload: MessagePayload['UPDATE_COMPANY_ANALYSIS'] }
  | { type: 'UPDATE_IMAGE_MEMO'; payload: MessagePayload['UPDATE_IMAGE_MEMO'] }
  | { type: 'UPDATE_COMPANY_CONTEXT'; payload: MessagePayload['UPDATE_COMPANY_CONTEXT'] }
  | { type: 'GET_PROMPT_SETTINGS' }
  | { type: 'SET_PROMPT_SETTINGS'; payload: MessagePayload['SET_PROMPT_SETTINGS'] }
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
