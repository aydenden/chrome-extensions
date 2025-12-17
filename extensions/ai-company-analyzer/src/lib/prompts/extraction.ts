/**
 * OCR 프롬프트 (v3.0)
 *
 * 변경 이력:
 * - v3.0: VLM은 OCR만 담당, 분류/분석은 텍스트 LM으로 분리
 *         모든 카테고리별 힌트 제거, 단일 OCR 프롬프트 사용
 * - v2.0: JSON 형식 제거, 단순 텍스트 추출로 전환
 * - v1.0: JSON 형식 사용 (중국어 반복 출력 문제 발생)
 */

import type { ImageSubCategory, DataType } from '@/types/storage';

/**
 * 단일 OCR 프롬프트 (v3.0)
 * VLM은 이미지에서 텍스트만 추출하고, 분류/분석은 텍스트 LM에서 수행
 */
const OCR_PROMPT = 'Read all text in this image.';

/**
 * OCR 프롬프트 반환
 * 카테고리와 사이트 타입은 무시 (호환성 유지용 파라미터)
 */
export function getExtractionPrompt(_category?: ImageSubCategory): string {
  return OCR_PROMPT;
}

/**
 * 사이트 힌트 조회 (deprecated, 호환성 유지용)
 */
export function getSiteHint(_siteType: DataType): string {
  return '';
}

/**
 * OCR 프롬프트 반환 (호환성 유지용)
 * 카테고리와 사이트 타입은 무시됨
 */
export function buildExtractionPrompt(
  _category?: ImageSubCategory,
  _siteType?: DataType
): string {
  return OCR_PROMPT;
}

// ============================================================
// 텍스트 후처리 유틸리티 (추출된 텍스트에서 구조화된 데이터 파싱)
// ============================================================

/**
 * 추출된 숫자 정보 (내부용)
 * storage.ts의 ExtractedNumber와 구분
 */
export interface ParsedNumber {
  value: number;
  unit: string;
  context?: string; // 주변 텍스트
}

/**
 * 구조화된 추출 결과
 */
export interface StructuredExtraction {
  rawText: string;
  numbers: ParsedNumber[];
  years: string[];
  percentages: number[];
}

/**
 * 추출된 텍스트에서 숫자 파싱
 * 예: "156억원", "12.5%", "1,234명"
 */
export function extractNumbers(text: string): ParsedNumber[] {
  const results: ParsedNumber[] = [];

  // 한국어 단위 패턴
  const koreanPattern = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(억원|만원|천원|원|%|명|개)/g;
  let match;
  while ((match = koreanPattern.exec(text)) !== null) {
    results.push({
      value: parseFloat(match[1].replace(/,/g, '')),
      unit: match[2],
      context: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
    });
  }

  return results;
}

/**
 * 연도 추출
 * 예: "2024년", "2023", "FY2022"
 */
export function extractYears(text: string): string[] {
  const yearPattern = /(?:FY)?(\b20\d{2})\b년?/g;
  const years: string[] = [];
  let match;
  while ((match = yearPattern.exec(text)) !== null) {
    years.push(match[1]);
  }
  return [...new Set(years)].sort();
}

/**
 * 퍼센트 추출
 */
export function extractPercentages(text: string): number[] {
  const percentPattern = /(-?\d+(?:\.\d+)?)\s*%/g;
  const percentages: number[] = [];
  let match;
  while ((match = percentPattern.exec(text)) !== null) {
    percentages.push(parseFloat(match[1]));
  }
  return percentages;
}

/**
 * 텍스트를 구조화된 데이터로 파싱
 */
export function parseExtractedText(rawText: string): StructuredExtraction {
  return {
    rawText,
    numbers: extractNumbers(rawText),
    years: extractYears(rawText),
    percentages: extractPercentages(rawText),
  };
}
