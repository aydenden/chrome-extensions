/**
 * 벡터 유사도 검색
 * 직접 코사인 유사도 구현 (MeMemo 대신 단순 구현)
 *
 * 선택 이유:
 * - MeMemo는 대규모(100만+) 벡터에 최적화
 * - 회사당 10-50개 문서면 직접 구현이 더 효율적
 * - 의존성 최소화
 */

import { db } from './db';
import { generateQueryEmbedding } from '@/background/embedding-engine';
import type { VectorIndex, ImageSubCategory } from '@/types/storage';

export interface SearchResult {
  extractedDataId: string;
  chunkText: string;
  category: ImageSubCategory;
  similarity: number;
  companyId: string;
}

export interface SearchOptions {
  topK?: number;
  categories?: ImageSubCategory[];
  minSimilarity?: number;
}

/**
 * 코사인 유사도 계산
 * 두 벡터가 정규화되어 있으면 내적만으로 계산 가능
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`벡터 차원 불일치: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * 회사별 벡터 검색
 */
export async function searchByCompany(
  companyId: string,
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const { topK = 5, categories, minSimilarity = 0.3 } = options || {};

  // 쿼리 임베딩 생성
  const queryEmbedding = await generateQueryEmbedding(query);

  // 회사의 모든 벡터 조회
  let vectors: VectorIndex[];

  if (categories && categories.length > 0) {
    // 특정 카테고리만 조회
    const categoryResults = await Promise.all(
      categories.map(category =>
        db.vectorIndex
          .where('[companyId+category]')
          .equals([companyId, category])
          .toArray()
      )
    );
    vectors = categoryResults.flat();
  } else {
    // 모든 카테고리 조회
    vectors = await db.vectorIndex.where('companyId').equals(companyId).toArray();
  }

  if (vectors.length === 0) {
    return [];
  }

  // 유사도 계산 및 정렬
  const results: SearchResult[] = vectors
    .map(v => ({
      extractedDataId: v.id,
      chunkText: v.chunkText,
      category: v.category,
      similarity: cosineSimilarity(queryEmbedding, v.embedding),
      companyId: v.companyId,
    }))
    .filter(r => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return results;
}

/**
 * 전체 데이터베이스 검색 (회사 무관)
 */
export async function searchAll(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const { topK = 10, categories, minSimilarity = 0.3 } = options || {};

  // 쿼리 임베딩 생성
  const queryEmbedding = await generateQueryEmbedding(query);

  // 모든 벡터 조회
  let vectors: VectorIndex[];

  if (categories && categories.length > 0) {
    // 특정 카테고리만 (모든 회사)
    const categoryResults = await Promise.all(
      categories.map(category =>
        db.vectorIndex.where('category').equals(category).toArray()
      )
    );
    vectors = categoryResults.flat();
  } else {
    vectors = await db.vectorIndex.toArray();
  }

  if (vectors.length === 0) {
    return [];
  }

  // 유사도 계산 및 정렬
  return vectors
    .map(v => ({
      extractedDataId: v.id,
      chunkText: v.chunkText,
      category: v.category,
      similarity: cosineSimilarity(queryEmbedding, v.embedding),
      companyId: v.companyId,
    }))
    .filter(r => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * 카테고리 그룹별 검색 (재무/리뷰/기타)
 */
export async function searchByGroup(
  companyId: string,
  query: string,
  group: 'financial' | 'review' | 'company' | 'chart',
  options?: Omit<SearchOptions, 'categories'>
): Promise<SearchResult[]> {
  const categoryGroups: Record<string, ImageSubCategory[]> = {
    financial: [
      'balance_sheet',
      'income_statement',
      'cash_flow',
      'financial_ratio',
      'revenue_trend',
      'employee_trend',
    ],
    review: ['review_positive', 'review_negative', 'review_mixed', 'rating_summary'],
    company: ['company_overview', 'team_info', 'benefits_info', 'tech_stack'],
    chart: ['bar_chart', 'line_chart', 'pie_chart', 'table_data'],
  };

  return searchByCompany(companyId, query, {
    ...options,
    categories: categoryGroups[group],
  });
}

/**
 * 중복 제거된 검색 결과 (같은 extractedDataId 중 최고 유사도만)
 */
export async function searchUniqueByCompany(
  companyId: string,
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const results = await searchByCompany(companyId, query, {
    ...options,
    topK: (options?.topK || 5) * 3, // 더 많이 가져와서 중복 제거
  });

  // extractedDataId별 최고 유사도만 유지
  const uniqueMap = new Map<string, SearchResult>();

  for (const result of results) {
    const existing = uniqueMap.get(result.extractedDataId);
    if (!existing || result.similarity > existing.similarity) {
      uniqueMap.set(result.extractedDataId, result);
    }
  }

  return Array.from(uniqueMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, options?.topK || 5);
}

/**
 * 벡터 검색 통계
 */
export async function getVectorStats(companyId?: string): Promise<{
  totalVectors: number;
  totalDocuments: number;
  byCategory: Record<string, number>;
}> {
  let vectors: VectorIndex[];

  if (companyId) {
    vectors = await db.vectorIndex.where('companyId').equals(companyId).toArray();
  } else {
    vectors = await db.vectorIndex.toArray();
  }

  // 문서별 고유 ID 수
  const uniqueDocIds = new Set(vectors.map(v => v.id));

  // 카테고리별 벡터 수
  const byCategory: Record<string, number> = {};
  for (const v of vectors) {
    byCategory[v.category] = (byCategory[v.category] || 0) + 1;
  }

  return {
    totalVectors: vectors.length,
    totalDocuments: uniqueDocIds.size,
    byCategory,
  };
}
