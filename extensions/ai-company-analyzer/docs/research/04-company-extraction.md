# 회사명 자동 추출 조사

> 조사일: 2025-12-15
> 관련 스펙: [02-data-extraction.md](../spec/02-data-extraction.md)

## 결정사항

- **1순위**: Title 패턴 매칭 (정규식)
- **2순위**: lindera-wasm-ko-dic (WASM 형태소 분석)
- **3순위**: 수동 입력
- **Chrome 빌트인 AI**: 사용 안 함

### Chrome 빌트인 AI 미사용 이유

| 문제 | 설명 |
|------|------|
| 모델 크기 | 22GB 다운로드 필요 |
| 한국어 미지원 | 영어, 스페인어, 일본어만 지원 (2025-12 기준) |
| 시스템 요구사항 | GPU 4GB+ VRAM 또는 CPU 16GB RAM |

## 조사 대상

### 접근법 비교

| 방식 | 번들 크기 | 정확도 | 속도 | 채택 |
|------|----------|--------|------|------|
| Title 패턴 | 0KB | 높음 (사이트별) | 즉시 | ⭐ 1순위 |
| lindera-wasm-ko-dic | ~2-3MB | 중간 | 빠름 | ⭐ 2순위 |
| Chrome 빌트인 AI | 22GB | 높음 | 느림 | ❌ |
| Transformers.js | 50-200MB | 매우 높음 | 느림 | ❌ |
| WinkNLP | ~10KB | 낮음 (영어) | 빠름 | ❌ |

### 한국어 NER 라이브러리

| 라이브러리 | 타입 | 브라우저 지원 | 한국어 | 채택 |
|-----------|------|--------------|--------|------|
| [lindera-wasm-ko-dic](https://www.npmjs.com/package/lindera-wasm-ko-dic) | WASM | ✅ | ✅ | ⭐ 채택 |
| [Transformers.js](https://huggingface.co/docs/transformers.js) | ONNX | ✅ | ⚠️ 다국어 | ❌ |
| [KoalaNLP](https://github.com/koalanlp/nodejs-support) | Node.js | ❌ | ✅ | ❌ |
| [nlp.js](https://github.com/axa-group/nlp.js) | JS | ⚠️ | ⚠️ 커스텀 필요 | ❌ |
| [Kiwi](https://github.com/bab2min/Kiwi) | WASM | ⚠️ npm 없음 | ✅ | ❌ |

## 상세 분석

### 1. Title 패턴 매칭 (1순위)

대부분의 사이트는 `<title>`에 회사명 포함:

```
원티드:     "카카오 | 기업정보 | wanted"
혁신의숲:   "카카오 기업 정보 - 혁신의숲"
블라인드:   "카카오 기업리뷰 - 블라인드"
잡플래닛:   "카카오 기업정보 - 잡플래닛"
```

**장점:**
- 번들 크기 0KB
- 즉시 실행
- 높은 정확도 (사이트별 패턴)

**단점:**
- 새 사이트 추가 시 패턴 추가 필요

**구현:**
```typescript
const TITLE_PATTERNS: Record<string, RegExp> = {
  'wanted.co.kr': /^(.+?)\s*\|\s*기업정보/,
  'innoforest.co.kr': /^(.+?)\s*기업\s*정보/,
  'blind.com': /^(.+?)\s*기업리뷰/,
  'jobplanet.co.kr': /^(.+?)\s*기업정보/,
  'smes.go.kr': /^(.+?)\s*-\s*중소기업/,
};

function extractFromTitle(url: string, title: string): string | null {
  for (const [domain, pattern] of Object.entries(TITLE_PATTERNS)) {
    if (url.includes(domain)) {
      const match = title.match(pattern);
      return match?.[1]?.trim() ?? null;
    }
  }
  return null;
}
```

### 2. lindera-wasm-ko-dic (2순위)

**특징:**
- Rust로 작성된 형태소 분석기를 WASM으로 컴파일
- mecab-ko 사전 포함
- 세종 품사 태그 체계 사용

**장점:**
- 브라우저 완벽 지원
- 네이티브에 가까운 속도
- 한국어 특화

**단점:**
- 번들 크기 ~2-3MB
- NER이 아닌 형태소 분석 (고유명사 추출은 휴리스틱 필요)

**구현:**
```typescript
import __wbg_init, { TokenizerBuilder } from 'lindera-wasm-ko-dic';

let tokenizer: any;

async function initTokenizer() {
  await __wbg_init();
  tokenizer = new TokenizerBuilder().buildKoDic();
}

function extractCompanyFromText(text: string): string | null {
  if (!tokenizer) return null;

  const tokens = tokenizer.tokenize(text.slice(0, 500));

  // 품사 태그:
  // NNP: 고유명사
  // NNG: 일반명사
  // 회사명은 보통 NNP + NNG 조합 (예: "삼성" + "전자")

  const candidates: string[] = [];
  let current = '';

  for (const token of tokens) {
    const pos = token.pos;
    if (pos.startsWith('NNP') || pos.startsWith('NNG')) {
      current += token.token;
    } else {
      if (current.length >= 2) {
        candidates.push(current);
      }
      current = '';
    }
  }

  if (current.length >= 2) {
    candidates.push(current);
  }

  // 첫 번째 후보 반환 (보통 제목/헤더에 회사명이 먼저 나옴)
  return candidates[0] ?? null;
}
```

### 3. Chrome 빌트인 AI (미채택)

**요구사항:**
| 항목 | 요구사항 |
|------|---------|
| Chrome 버전 | 138+ |
| 저장공간 | 22GB 이상 |
| GPU | 4GB+ VRAM (권장) |
| CPU (GPU 없을 시) | 16GB RAM, 4코어+ |
| 지원 언어 | 영어, 스페인어, 일본어 |

**API 예시 (참고용):**
```typescript
// Chrome 138+ Extension 전용
const availability = await LanguageModel.availability();
// 'available' | 'downloading' | 'downloadable' | 'unavailable'

const session = await LanguageModel.create();
const response = await session.prompt('Extract company name from: ...');
```

### 4. Transformers.js (미채택)

**특징:**
- ONNX Runtime 기반
- 다국어 NER 모델 사용 가능

**미채택 이유:**
- 모델 크기 50-200MB
- 첫 로드 시간 매우 느림

**모델 예시:**
- `Xenova/bert-base-multilingual-cased-ner-hrl` - 다국어 NER

**API 예시 (참고용):**
```typescript
import { pipeline } from '@xenova/transformers';

const ner = await pipeline('token-classification',
  'Xenova/bert-base-multilingual-cased-ner-hrl');

const result = await ner('삼성전자가 서울에서 새 제품을 출시했다');
// [{ entity: 'B-ORG', word: '삼성', score: 0.98 }, ...]
```

### 5. WinkNLP (미채택)

**특징:**
- ~10KB (gzipped)
- 브라우저 동작

**미채택 이유:**
- 영어 특화, 한국어 NER 미지원

## 통합 추출 함수

```typescript
// lib/companyExtractor.ts
import __wbg_init, { TokenizerBuilder } from 'lindera-wasm-ko-dic';

let tokenizer: any;
let initialized = false;

async function initTokenizer() {
  if (initialized) return;
  await __wbg_init();
  tokenizer = new TokenizerBuilder().buildKoDic();
  initialized = true;
}

export async function extractCompanyName(
  url: string,
  bodyText: string
): Promise<string> {
  // 1순위: Title 패턴 (빠르고 정확)
  const fromTitle = extractFromTitle(url, document.title);
  if (fromTitle) return fromTitle;

  // 2순위: WASM 형태소 분석 (fallback)
  await initTokenizer();
  const fromNLP = extractCompanyFromText(bodyText);
  if (fromNLP) return fromNLP;

  // 3순위: 수동 입력
  return '';
}
```

## manifest.json 설정

```json
{
  "web_accessible_resources": [{
    "resources": ["*.wasm"],
    "matches": ["<all_urls>"]
  }]
}
```

## 미채택 사유

| 옵션 | 사유 |
|------|------|
| Chrome 빌트인 AI | 22GB 모델, 한국어 미지원 |
| Transformers.js | 50-200MB 모델, 첫 로드 느림 |
| KoalaNLP | Node.js 전용, 브라우저 미지원 |
| nlp.js | 한국어 NER 미지원 (커스텀 엔티티만 가능) |
| Kiwi | npm 패키지 없음, 직접 빌드 필요 |
| WinkNLP | 영어 특화 |

## 참고 자료

### Chrome 빌트인 AI
- [The Prompt API](https://developer.chrome.com/docs/extensions/ai/prompt-api)
- [Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in-apis)
- [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started)

### 한국어 NLP
- [lindera-wasm-ko-dic](https://www.npmjs.com/package/lindera-wasm-ko-dic)
- [GitHub - lindera/lindera-wasm](https://github.com/lindera/lindera-wasm)
- [Kiwi 형태소 분석기](https://github.com/bab2min/Kiwi)

### NER 라이브러리
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [WinkNLP](https://winkjs.org/wink-nlp/)
- [nlp.js](https://github.com/axa-group/nlp.js)
