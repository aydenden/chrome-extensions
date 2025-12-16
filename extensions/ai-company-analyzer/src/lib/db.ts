import Dexie, { Table } from 'dexie';
import type {
  Company,
  ExtractedData,
  BinaryData,
  AnalysisResult,
  ExtractedText,
} from '@/types/storage';

export class AppDatabase extends Dexie {
  companies!: Table<Company>;
  extractedData!: Table<ExtractedData>;
  binaryData!: Table<BinaryData>;
  analysisResults!: Table<AnalysisResult>;
  extractedTexts!: Table<ExtractedText>;

  constructor() {
    super('ai-company-analyzer');

    // v1: 초기 스키마
    this.version(1).stores({
      companies: 'id, name, createdAt, updatedAt',
      extractedData: 'id, companyId, type, extractedAt, [companyId+type]',
      binaryData: 'id',
      analysisResults: 'id, companyId, analyzedAt',
    });

    // v2: 이미지 분류 시스템 추가
    this.version(2).stores({
      companies: 'id, name, createdAt, updatedAt',
      extractedData: 'id, companyId, type, subCategory, classificationStatus, extractedAt, [companyId+type], [companyId+subCategory]',
      binaryData: 'id',
      analysisResults: 'id, companyId, analyzedAt',
    }).upgrade(tx => {
      // 기존 데이터에 기본값 설정
      return tx.table('extractedData').toCollection().modify(data => {
        if (!data.subCategory) {
          data.subCategory = 'pending';
        }
        if (!data.classificationStatus) {
          data.classificationStatus = 'pending';
        }
      });
    });

    // v3: RAG 시스템 추가 (텍스트 추출 + 벡터 임베딩)
    this.version(3).stores({
      companies: 'id, name, createdAt, updatedAt',
      extractedData: 'id, companyId, type, subCategory, classificationStatus, extractionStatus, extractedAt, [companyId+type], [companyId+subCategory], [companyId+extractionStatus]',
      binaryData: 'id',
      analysisResults: 'id, companyId, analyzedAt',
      // 신규 테이블
      extractedTexts: 'id, companyId, category, createdAt, [companyId+category]',
      vectorIndex: '[id+chunkIndex], id, companyId, category, [companyId+category]',
    }).upgrade(tx => {
      // 기존 데이터에 extractionStatus 추가
      return tx.table('extractedData').toCollection().modify(data => {
        if (!data.extractionStatus) {
          // 기존 분류 완료된 데이터는 텍스트 추출 대기 상태로
          data.extractionStatus = data.classificationStatus === 'completed'
            ? 'extracting_text'
            : data.classificationStatus || 'pending';
        }
      });
    });

    // v4: 임베딩 제거 (vectorIndex 테이블 삭제)
    this.version(4).stores({
      companies: 'id, name, createdAt, updatedAt',
      extractedData: 'id, companyId, type, subCategory, classificationStatus, extractionStatus, extractedAt, [companyId+type], [companyId+subCategory], [companyId+extractionStatus]',
      binaryData: 'id',
      analysisResults: 'id, companyId, analyzedAt',
      extractedTexts: 'id, companyId, category, createdAt, [companyId+category]',
      vectorIndex: null, // 테이블 삭제
    });
  }
}

export const db = new AppDatabase();
