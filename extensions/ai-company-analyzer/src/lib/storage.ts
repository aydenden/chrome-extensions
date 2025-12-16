import { db } from './db';
import type {
  Company,
  ExtractedData,
  BinaryData,
  DataType,
  AnalysisResult,
  ImageSubCategory,
  ClassificationStatus,
  ExtractionStatus,
  ExtractedText,
  VectorIndex,
  ExtractedMetadata,
} from '@/types/storage';

// ============ 회사 CRUD ============

// 회사 생성
export async function createCompany(name: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.companies.add({
    id,
    name,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

// 회사 조회
export async function getCompany(id: string): Promise<Company | undefined> {
  return db.companies.get(id);
}

// 회사 목록 조회
export async function getAllCompanies(): Promise<Company[]> {
  return db.companies.orderBy('updatedAt').reverse().toArray();
}

// 회사 이름으로 검색
export async function searchCompanies(query: string): Promise<Company[]> {
  const lowerQuery = query.toLowerCase();
  return db.companies
    .filter(c => c.name.toLowerCase().includes(lowerQuery))
    .toArray();
}

// 회사 수정
export async function updateCompany(id: string, updates: Partial<Company>): Promise<void> {
  await db.companies.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

// 회사 삭제 (cascade)
export async function deleteCompany(companyId: string): Promise<void> {
  await db.transaction('rw', [db.companies, db.extractedData, db.binaryData, db.analysisResults], async () => {
    // 관련 데이터 ID 조회
    const dataIds = await db.extractedData
      .where('companyId')
      .equals(companyId)
      .primaryKeys();

    // 바이너리 데이터 삭제
    await db.binaryData.bulkDelete(dataIds);

    // 추출 데이터 삭제
    await db.extractedData.where('companyId').equals(companyId).delete();

    // 분석 결과 삭제
    await db.analysisResults.where('companyId').equals(companyId).delete();

    // 회사 삭제
    await db.companies.delete(companyId);
  });
}

// ============ 데이터 저장 ============

// 이미지 저장 (분류 대기 상태로)
export async function saveImage(
  companyId: string,
  blob: Blob,
  type: DataType,
  source: string
): Promise<string> {
  const id = crypto.randomUUID();

  await db.transaction('rw', [db.extractedData, db.binaryData, db.companies], async () => {
    await db.extractedData.add({
      id,
      companyId,
      type,
      subCategory: 'pending',
      classificationStatus: 'pending',
      source,
      extractedAt: Date.now(),
    });

    await db.binaryData.add({
      id,
      blob,
      mimeType: blob.type,
    });

    await db.companies.update(companyId, { updatedAt: Date.now() });
  });

  return id;
}

// ============ 데이터 조회 ============

// 회사별 추출 데이터 조회
export async function getCompanyData(companyId: string): Promise<ExtractedData[]> {
  return db.extractedData
    .where('companyId')
    .equals(companyId)
    .toArray();
}

// 타입별 데이터 조회
export async function getDataByType(companyId: string, type: DataType): Promise<ExtractedData[]> {
  return db.extractedData
    .where('[companyId+type]')
    .equals([companyId, type])
    .toArray();
}

// 이미지 Blob 조회
export async function getImageBlob(id: string): Promise<Blob | undefined> {
  const data = await db.binaryData.get(id);
  return data?.blob;
}

// 이미지 URL 생성 (ObjectURL)
export async function getImageUrl(id: string): Promise<string | null> {
  const blob = await getImageBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

// 서브카테고리별 데이터 조회
export async function getDataBySubCategory(
  companyId: string,
  subCategory: ImageSubCategory
): Promise<ExtractedData[]> {
  return db.extractedData
    .where('[companyId+subCategory]')
    .equals([companyId, subCategory])
    .toArray();
}

// 단일 추출 데이터 조회
export async function getExtractedData(id: string): Promise<ExtractedData | undefined> {
  return db.extractedData.get(id);
}

// ============ 이미지 분류 ============

// 분류 결과 업데이트
export async function updateExtractedDataCategory(
  id: string,
  subCategory: ImageSubCategory
): Promise<void> {
  await db.extractedData.update(id, {
    subCategory,
    classificationStatus: 'completed' as ClassificationStatus,
  });
}

// 분류 실패 마킹
export async function markClassificationFailed(id: string): Promise<void> {
  await db.extractedData.update(id, {
    subCategory: 'unknown',
    classificationStatus: 'failed' as ClassificationStatus,
  });
}

// 분류 대기중인 이미지 조회
export async function getPendingClassifications(): Promise<ExtractedData[]> {
  return db.extractedData
    .where('classificationStatus')
    .equals('pending')
    .toArray();
}

// 분류 상태 업데이트
export async function updateClassificationStatus(
  id: string,
  status: ClassificationStatus
): Promise<void> {
  await db.extractedData.update(id, { classificationStatus: status });
}

// 수동 분류 (사용자가 직접 카테고리 선택)
export async function manualClassify(
  id: string,
  subCategory: ImageSubCategory
): Promise<void> {
  await db.extractedData.update(id, {
    subCategory,
    classificationStatus: 'completed' as ClassificationStatus,
  });
}

// ============ 분석 결과 ============

// 분석 결과 저장
export async function saveAnalysisResult(result: Omit<AnalysisResult, 'id'>): Promise<string> {
  const id = crypto.randomUUID();

  await db.analysisResults.add({
    id,
    ...result,
  });

  await db.companies.update(result.companyId, { updatedAt: Date.now() });

  return id;
}

// 분석 결과 조회
export async function getAnalysisResult(companyId: string): Promise<AnalysisResult | undefined> {
  return db.analysisResults
    .where('companyId')
    .equals(companyId)
    .last();
}

// ============ 유틸리티 ============

// 전체 데이터 내보내기
export async function exportAllData(): Promise<object> {
  const companies = await db.companies.toArray();
  const extractedData = await db.extractedData.toArray();
  const analysisResults = await db.analysisResults.toArray();

  // 바이너리 데이터는 base64로 변환
  const binaryData = await db.binaryData.toArray();
  const binaryBase64 = await Promise.all(
    binaryData.map(async (b) => ({
      id: b.id,
      mimeType: b.mimeType,
      data: await blobToBase64(b.blob),
    }))
  );

  return {
    version: 1,
    exportedAt: Date.now(),
    companies,
    extractedData,
    binaryData: binaryBase64,
    analysisResults,
  };
}

// Blob → Base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 전체 데이터 삭제
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.companies, db.extractedData, db.binaryData, db.analysisResults], async () => {
    await db.companies.clear();
    await db.extractedData.clear();
    await db.binaryData.clear();
    await db.analysisResults.clear();
  });
}

// 회사 수 조회
export async function getCompanyCount(): Promise<number> {
  return db.companies.count();
}

// 데이터 존재 여부 확인
export async function hasAnyData(): Promise<boolean> {
  const count = await db.companies.count();
  return count > 0;
}

// ============ RAG 시스템 ============

// 추출 상태 업데이트
export async function updateExtractionStatus(
  id: string,
  status: ExtractionStatus,
  error?: string
): Promise<void> {
  const updates: Partial<ExtractedData> = { extractionStatus: status };

  // 완료 시간 기록
  if (status === 'completed') {
    updates.embeddedAt = Date.now();
  }

  // 에러 메시지 저장
  if (status === 'failed' && error) {
    updates.extractionError = error;
  }

  await db.extractedData.update(id, updates);
}

// 텍스트 추출 완료 시간 업데이트
export async function markTextExtracted(id: string): Promise<void> {
  await db.extractedData.update(id, {
    textExtractedAt: Date.now(),
  });
}

// 추출 대기중인 데이터 조회 (새 RAG 파이프라인용)
export async function getPendingExtractions(): Promise<ExtractedData[]> {
  return db.extractedData
    .where('extractionStatus')
    .anyOf(['pending', 'classifying', 'extracting_text', 'embedding'])
    .toArray();
}

// 텍스트 추출이 필요한 데이터 조회
export async function getDataNeedingTextExtraction(): Promise<ExtractedData[]> {
  return db.extractedData
    .where('extractionStatus')
    .equals('extracting_text')
    .toArray();
}

// ============ 추출된 텍스트 CRUD ============

// 추출된 텍스트 저장
export async function saveExtractedText(
  id: string,
  companyId: string,
  category: ImageSubCategory,
  rawText: string,
  metadata: ExtractedMetadata
): Promise<void> {
  await db.extractedTexts.put({
    id,
    companyId,
    category,
    rawText,
    metadata,
    createdAt: Date.now(),
  });

  // 텍스트 추출 완료 시간 기록
  await markTextExtracted(id);
}

// 추출된 텍스트 조회
export async function getExtractedText(id: string): Promise<ExtractedText | undefined> {
  return db.extractedTexts.get(id);
}

// 회사별 추출된 텍스트 조회
export async function getExtractedTextsByCompany(companyId: string): Promise<ExtractedText[]> {
  return db.extractedTexts.where('companyId').equals(companyId).toArray();
}

// 카테고리별 추출된 텍스트 조회
export async function getExtractedTextsByCategory(
  companyId: string,
  category: ImageSubCategory
): Promise<ExtractedText[]> {
  return db.extractedTexts
    .where('[companyId+category]')
    .equals([companyId, category])
    .toArray();
}

// ============ 벡터 인덱스 CRUD ============

// 벡터 인덱스 저장 (청크 단위)
export async function saveVectorIndex(
  id: string,
  companyId: string,
  category: ImageSubCategory,
  chunkIndex: number,
  chunkText: string,
  embedding: Float32Array
): Promise<void> {
  await db.vectorIndex.put({
    id,
    companyId,
    category,
    chunkIndex,
    chunkText,
    embedding,
    createdAt: Date.now(),
  });
}

// 벡터 인덱스 일괄 저장
export async function saveVectorIndexBatch(
  id: string,
  companyId: string,
  category: ImageSubCategory,
  chunks: Array<{ chunkText: string; embedding: Float32Array }>
): Promise<void> {
  const now = Date.now();
  const records: VectorIndex[] = chunks.map((chunk, index) => ({
    id,
    companyId,
    category,
    chunkIndex: index,
    chunkText: chunk.chunkText,
    embedding: chunk.embedding,
    createdAt: now,
  }));

  await db.vectorIndex.bulkPut(records);
}

// 특정 데이터의 벡터 인덱스 조회
export async function getVectorIndexes(id: string): Promise<VectorIndex[]> {
  return db.vectorIndex.where('id').equals(id).toArray();
}

// 회사별 모든 벡터 인덱스 조회
export async function getVectorIndexesByCompany(companyId: string): Promise<VectorIndex[]> {
  return db.vectorIndex.where('companyId').equals(companyId).toArray();
}

// 카테고리별 벡터 인덱스 조회
export async function getVectorIndexesByCategory(
  companyId: string,
  category: ImageSubCategory
): Promise<VectorIndex[]> {
  return db.vectorIndex
    .where('[companyId+category]')
    .equals([companyId, category])
    .toArray();
}

// ============ RAG 데이터 정리 ============

// 특정 데이터의 RAG 관련 데이터 삭제
export async function deleteRAGData(id: string): Promise<void> {
  await db.transaction('rw', [db.extractedTexts, db.vectorIndex], async () => {
    await db.extractedTexts.delete(id);
    await db.vectorIndex.where('id').equals(id).delete();
  });
}

// 회사의 모든 RAG 데이터 삭제
export async function deleteCompanyRAGData(companyId: string): Promise<void> {
  await db.transaction('rw', [db.extractedTexts, db.vectorIndex], async () => {
    await db.extractedTexts.where('companyId').equals(companyId).delete();
    await db.vectorIndex.where('companyId').equals(companyId).delete();
  });
}

// 전체 RAG 데이터 삭제
export async function clearAllRAGData(): Promise<void> {
  await db.transaction('rw', [db.extractedTexts, db.vectorIndex], async () => {
    await db.extractedTexts.clear();
    await db.vectorIndex.clear();
  });
}

// ============ 회사 삭제 확장 (RAG 포함) ============

// 회사 삭제 (RAG 데이터 포함)
export async function deleteCompanyWithRAG(companyId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.companies, db.extractedData, db.binaryData, db.analysisResults, db.extractedTexts, db.vectorIndex],
    async () => {
      // 관련 데이터 ID 조회
      const dataIds = await db.extractedData
        .where('companyId')
        .equals(companyId)
        .primaryKeys();

      // 바이너리 데이터 삭제
      await db.binaryData.bulkDelete(dataIds);

      // 추출 데이터 삭제
      await db.extractedData.where('companyId').equals(companyId).delete();

      // 분석 결과 삭제
      await db.analysisResults.where('companyId').equals(companyId).delete();

      // RAG 데이터 삭제
      await db.extractedTexts.where('companyId').equals(companyId).delete();
      await db.vectorIndex.where('companyId').equals(companyId).delete();

      // 회사 삭제
      await db.companies.delete(companyId);
    }
  );
}
