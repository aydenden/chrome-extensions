/**
 * 회사명 자동 추출 유틸리티
 *
 * 우선순위:
 * 1. lindera-wasm-ko-dic 형태소 분석 (NER)
 * 2. 페이지 Title 패턴 매칭
 * 3. HTML 직접 추출
 * 4. null 반환
 */

import { detectCurrentSite, type SiteKey } from './sites';

// ============================================================================
// lindera-wasm-ko-dic 초기화
// ============================================================================

// 타입 정의 (lindera-wasm-ko-dic)
interface LinderaToken {
  text: string;
  detail: string[];
}

type Tokenizer = {
  tokenize(text: string): LinderaToken[];
  free(): void;
};

type TokenizerBuilder = {
  build(): Tokenizer;
  free(): void;
};

let tokenizer: Tokenizer | null = null;
let initPromise: Promise<void> | null = null;
let initError: Error | null = null;

/**
 * lindera-wasm-ko-dic 초기화
 * 싱글톤 패턴으로 중복 초기화 방지
 */
async function initLindera(): Promise<void> {
  // 이미 초기화됨
  if (tokenizer) return;

  // 이전 초기화 실패
  if (initError) {
    console.warn('lindera 초기화 이전 실패, 스킵:', initError.message);
    return;
  }

  // 초기화 진행 중
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const lindera = await import('lindera-wasm-ko-dic');

      // Chrome Extension Content Script에서는 chrome.runtime.getURL()로 WASM 경로 지정
      let wasmUrl: string | undefined;
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        wasmUrl = chrome.runtime.getURL('dist/lindera_wasm_bg.wasm');
        console.log('WASM URL:', wasmUrl);
      }

      // WASM 초기화 (경로 지정 또는 기본값)
      if (wasmUrl) {
        await lindera.default(wasmUrl);
      } else {
        await lindera.default();
      }

      const builder = new lindera.TokenizerBuilder() as unknown as TokenizerBuilder;
      tokenizer = builder.build();
      console.log('lindera-wasm-ko-dic 초기화 완료');
    } catch (error) {
      initError = error instanceof Error ? error : new Error(String(error));
      console.error('lindera-wasm-ko-dic 초기화 실패:', initError);
      throw initError;
    }
  })();

  return initPromise;
}

// ============================================================================
// 사이트별 Title 패턴 정의
// ============================================================================

interface SitePattern {
  /** 정규식 패턴 (캡처 그룹으로 회사명 추출) */
  pattern: RegExp;
  /** HTML에서 직접 추출 필요 여부 */
  requiresHTML?: boolean;
}

const SITE_PATTERNS: Record<SiteKey, SitePattern> = {
  wanted: {
    pattern: /^(.+?)\s*-\s*회사\s*소개/,
  },
  innoforest: {
    pattern: /^(.+?)\s*-\s*혁신의숲/,
  },
  dart: {
    pattern: /^(.+?)\s*-\s*DART/,
  },
  blind: {
    pattern: /^(.+?)\s+기업정보/,
  },
  jobplanet: {
    pattern: /^(.+?)\s+기업리뷰/,
  },
  smes: {
    pattern: /^(.+?)(?:\s*-\s*중소벤처기업부\s*확인서)?$/,
    requiresHTML: true, // HTML에서 더 정확한 추출 필요
  },
};

// ============================================================================
// 회사명 정리 함수
// ============================================================================

/**
 * 추출된 회사명을 정리합니다.
 * - 법인 표기 제거: (주), ㈜, (유), 주식회사, 유한회사
 * - 불필요한 공백 제거
 *
 * @param name 원본 회사명
 * @returns 정리된 회사명
 */
export function cleanCompanyName(name: string): string {
  return name
    .replace(/\(주\)/g, '')
    .replace(/㈜/g, '')
    .replace(/\(유\)/g, '')
    .replace(/주식회사\s*/g, '')
    .replace(/유한회사\s*/g, '')
    .trim()
    .replace(/\s+/g, ' '); // 연속된 공백을 하나로
}

// ============================================================================
// Title 패턴 매칭
// ============================================================================

/**
 * 페이지 Title에서 회사명을 추출합니다.
 *
 * @param url 현재 페이지 URL
 * @param title 페이지 Title
 * @returns 추출된 회사명 또는 null
 */
export function extractFromTitle(url: string, title: string): string | null {
  const siteKey = detectCurrentSite(url);
  if (!siteKey) {
    return null;
  }

  const sitePattern = SITE_PATTERNS[siteKey];
  if (!sitePattern) {
    return null;
  }

  const match = title.match(sitePattern.pattern);
  if (match && match[1]) {
    const companyName = match[1].trim();
    return cleanCompanyName(companyName);
  }

  return null;
}

// ============================================================================
// HTML 직접 추출 (중기부확인 등)
// ============================================================================

/**
 * HTML에서 직접 회사명을 추출합니다.
 * 현재는 중기부확인 사이트에서만 사용됩니다.
 *
 * @param url 현재 페이지 URL
 * @param textContent 페이지의 textContent (선택)
 * @returns 추출된 회사명 또는 null
 */
function extractFromHTML(url: string, textContent?: string): string | null {
  const siteKey = detectCurrentSite(url);

  if (siteKey === 'smes' && textContent) {
    // 중기부확인 사이트에서 회사명 추출 로직
    // 예: "기업명: 주식회사 ABC" 형태에서 추출
    const match = textContent.match(/기업명\s*[:：]\s*(.+?)(?:\n|$)/);
    if (match && match[1]) {
      return cleanCompanyName(match[1].trim());
    }
  }

  return null;
}

// ============================================================================
// 형태소 분석 (lindera-wasm-ko-dic)
// ============================================================================

/**
 * 형태소 분석으로 회사명을 추출합니다.
 * lindera-wasm-ko-dic (mecab-ko-dic 기반)을 사용합니다.
 *
 * 품사 태그 (세종 품사 태그):
 * - NNP: 고유명사 (예: 삼성, 카카오)
 * - NNG: 일반명사 (예: 전자, 뱅크)
 *
 * @param textContent 페이지 텍스트
 * @returns 추출된 회사명 또는 null
 */
async function extractFromMorpheme(textContent: string): Promise<string | null> {
  try {
    await initLindera();
    if (!tokenizer) return null;

    // 최대 500자만 분석 (성능 최적화)
    const truncatedText = textContent.slice(0, 500);
    const tokens = tokenizer.tokenize(truncatedText);

    // 디버깅: 토큰 구조 확인 (첫 실행 시)
    if (tokens.length > 0) {
      console.log('lindera 토큰 샘플:', JSON.stringify(tokens[0]));
    }

    // 고유명사(NNP) + 일반명사(NNG) 조합 찾기
    const candidates: string[] = [];
    let current = '';

    for (const token of tokens) {
      // ko-dic 품사 태그는 detail[0]에 있음 (예: "NNP", "NNG", "VV" 등)
      // 또는 문자열 형태로 "NNP,*,*,*,*,*,*,*" 형식일 수 있음
      const pos = Array.isArray(token.detail)
        ? token.detail[0]
        : typeof token.detail === 'string'
          ? token.detail.split(',')[0]
          : '';

      // 고유명사 또는 일반명사인 경우 연결
      if (pos === 'NNP' || pos === 'NNG') {
        current += token.text;
      } else {
        // 명사가 아닌 경우, 현재까지 모은 후보 저장
        if (current.length >= 2) {
          candidates.push(current);
        }
        current = '';
      }
    }

    // 마지막 후보 추가
    if (current.length >= 2) {
      candidates.push(current);
    }

    // 첫 번째 후보 반환 (페이지 상단에 회사명이 나올 가능성 높음)
    const result = candidates[0] ?? null;
    if (result) {
      console.log('형태소 분석으로 추출된 회사명:', result);
    }
    return result;
  } catch (error) {
    console.error('형태소 분석 실패:', error);
    return null;
  }
}

// ============================================================================
// 메인 추출 함수
// ============================================================================

/**
 * URL과 Title, 텍스트 내용에서 회사명을 추출합니다.
 *
 * 우선순위:
 * 1. 형태소 분석 (lindera-wasm-ko-dic) - NER 기반
 * 2. Title 패턴 매칭
 * 3. HTML 직접 추출 (중기부확인)
 * 4. null 반환
 *
 * @param url 페이지 URL
 * @param title 페이지 Title
 * @param textContent 페이지 텍스트 내용 (선택)
 * @returns 추출된 회사명 또는 null
 */
export async function extractCompanyName(
  url: string,
  title: string,
  textContent?: string
): Promise<string | null> {
  // 1. 형태소 분석 시도 (NER)
  if (textContent) {
    const fromMorpheme = await extractFromMorpheme(textContent);
    if (fromMorpheme) {
      return fromMorpheme;
    }
  }

  // 2. Title 패턴 매칭 시도
  const fromTitle = extractFromTitle(url, title);
  if (fromTitle) {
    return fromTitle;
  }

  // 3. HTML 직접 추출 시도 (중기부확인 등)
  if (textContent) {
    const fromHTML = extractFromHTML(url, textContent);
    if (fromHTML) {
      return fromHTML;
    }
  }

  return null;
}

// ============================================================================
// Content Script용 헬퍼
// ============================================================================

/**
 * 현재 페이지에서 회사명을 추출합니다.
 * Content Script에서 사용하기 위한 헬퍼 함수입니다.
 *
 * @returns 추출된 회사명 또는 null
 */
export async function extractFromCurrentPage(): Promise<string | null> {
  const url = window.location.href;
  const title = document.title;
  const textContent = document.body.textContent || '';

  return extractCompanyName(url, title, textContent);
}
