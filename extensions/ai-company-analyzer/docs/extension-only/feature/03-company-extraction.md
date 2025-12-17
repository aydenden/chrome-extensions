# 03. 회사명 추출

## 개요
Title 패턴 매칭 + lindera-wasm-ko-dic 형태소 분석 기반 회사명 자동 추출

## 선행 조건
- 02-data-storage 완료

## 기술 스택
| 분류 | 기술 | 용도 |
|------|------|------|
| 1순위 | Title 패턴 매칭 | 정규식으로 빠르게 추출 |
| 2순위 | lindera-wasm-ko-dic | 한국어 형태소 분석 |
| 3순위 | 수동 입력 | 폴백 |

---

## 추출 우선순위

1. **Title 패턴 매칭** - 즉시, 0KB
2. **lindera-wasm-ko-dic** - ~2-3MB, 형태소 분석
3. **수동 입력** - 사용자 직접 입력

### Chrome 빌트인 AI 미사용 이유
- 22GB 모델 다운로드 필요
- 한국어 미지원 (2025-12 기준)

---

## 사이트별 Title 패턴

| 사이트 | Title 형식 | 패턴 |
|--------|-----------|------|
| 원티드 | `{회사명} - 회사 소개 \| wanted` | `/^(.+?)\s*-\s*회사\s*소개/` |
| 혁신의숲 | `{회사명} - 혁신의숲` | `/^(.+?)\s*-\s*혁신의숲/` |
| DART | `{회사명} - DART` | `/^(.+?)\s*-\s*DART/` |
| 중기벤처확인 | 구조화된 텍스트 | HTML에서 추출 |
| 블라인드 | `{회사명} 기업정보 \| 블라인드` | `/^(.+?)\s+기업정보/` |
| 잡플래닛 | `{회사명} 기업리뷰 - 잡플래닛` | `/^(.+?)\s+기업리뷰/` |

---

## 구현

### src/lib/company-extractor.ts

```typescript
// 사이트별 추출 패턴
const SITE_PATTERNS: Record<string, RegExp> = {
  'wanted.co.kr': /^(.+?)\s*-\s*회사\s*소개/,
  'innoforest.co.kr': /^(.+?)\s*-\s*혁신의숲/,
  'dart.fss.or.kr': /^(.+?)\s*-\s*DART/,
  'teamblind.com': /^(.+?)\s+기업정보/,
  'jobplanet.co.kr': /^(.+?)\s+기업리뷰/,
};

// lindera WASM 인스턴스
let linderaInstance: any = null;

/**
 * 회사명 추출 (우선순위: Title → 형태소 분석 → null)
 */
export async function extractCompanyName(
  url: string,
  title: string,
  textContent?: string
): Promise<string | null> {
  // 1순위: Title 패턴 매칭
  const fromTitle = extractFromTitle(url, title);
  if (fromTitle) return fromTitle;

  // 2순위: 형태소 분석 (텍스트가 있는 경우)
  if (textContent) {
    const fromMorpheme = await extractFromMorpheme(textContent);
    if (fromMorpheme) return fromMorpheme;
  }

  // 3순위: null (수동 입력 필요)
  return null;
}

/**
 * Title에서 회사명 추출
 */
function extractFromTitle(url: string, title: string): string | null {
  const hostname = new URL(url).hostname.replace('www.', '');

  for (const [domain, pattern] of Object.entries(SITE_PATTERNS)) {
    if (hostname.includes(domain)) {
      const match = title.match(pattern);
      if (match?.[1]) {
        return cleanCompanyName(match[1]);
      }
    }
  }

  return null;
}

/**
 * 형태소 분석으로 회사명 추출
 */
async function extractFromMorpheme(text: string): Promise<string | null> {
  try {
    // lindera 초기화 (최초 1회)
    if (!linderaInstance) {
      const { Lindera } = await import('lindera-wasm-ko-dic');
      linderaInstance = await Lindera.create();
    }

    // 최대 500자만 분석 (성능 최적화)
    const truncatedText = text.slice(0, 500);
    const tokens = linderaInstance.tokenize(truncatedText);

    // 고유명사(NNP) + 일반명사(NNG) 조합 찾기
    const candidates: string[] = [];
    let currentCandidate = '';

    for (const token of tokens) {
      const pos = token.part_of_speech?.split(',')[0];

      if (pos === 'NNP' || pos === 'NNG') {
        currentCandidate += token.surface;
      } else if (currentCandidate) {
        if (currentCandidate.length >= 2) {
          candidates.push(currentCandidate);
        }
        currentCandidate = '';
      }
    }

    // 마지막 후보 추가
    if (currentCandidate.length >= 2) {
      candidates.push(currentCandidate);
    }

    // 가장 긴 후보 반환 (회사명은 보통 가장 긴 명사 조합)
    if (candidates.length > 0) {
      return candidates.sort((a, b) => b.length - a.length)[0];
    }

    return null;
  } catch (error) {
    console.error('형태소 분석 실패:', error);
    return null;
  }
}

/**
 * 회사명 정리
 */
function cleanCompanyName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')           // 다중 공백 제거
    .replace(/\(주\)|\(유\)/g, '')  // 법인 표기 제거
    .replace(/㈜|㈜/g, '')          // 특수 법인 표기 제거
    .trim();
}

/**
 * 현재 탭의 회사명 추출 (Content Script용)
 */
export async function extractFromCurrentPage(): Promise<string | null> {
  const url = window.location.href;
  const title = document.title;

  // 선택된 텍스트가 있으면 해당 텍스트에서도 추출 시도
  const selection = window.getSelection()?.toString();

  return extractCompanyName(url, title, selection || undefined);
}
```

---

## 사용 예시

### Content Script에서 사용

```typescript
import { extractFromCurrentPage } from '@/lib/company-extractor';

// 현재 페이지에서 회사명 추출
const companyName = await extractFromCurrentPage();

if (companyName) {
  console.log('추출된 회사명:', companyName);
} else {
  // 수동 입력 요청
  console.log('회사명을 자동으로 추출할 수 없습니다.');
}
```

### 텍스트 데이터에서 추출

```typescript
import { extractCompanyName } from '@/lib/company-extractor';

const url = 'https://www.wanted.co.kr/company/12345';
const title = '삼성전자 - 회사 소개 | wanted';
const text = '삼성전자는 1969년에 설립된...';

const companyName = await extractCompanyName(url, title, text);
// 결과: '삼성전자'
```

---

## lindera-wasm-ko-dic 설정

### 설치

```bash
bun add lindera-wasm-ko-dic
```

### Vite 설정 (WASM 지원)

```typescript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: ['lindera-wasm-ko-dic'],
  },
  build: {
    target: 'esnext', // Top-level await 지원
  },
});
```

### Manifest 설정 (CSP)

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/lib/company-extractor.ts` | 회사명 추출 로직 |

---

## 참조 문서
- [research/04-company-extraction.md](../research/04-company-extraction.md) - 회사명 추출 기술 조사
