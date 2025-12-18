# Feature 26: 텍스트 후처리 파이프라인

## 개요

OCR 결과 및 AI 분석 텍스트의 후처리 파이프라인을 구현합니다.

## 범위

- 한글 형태소 분석 (lindera-wasm-ko-dic)
- 불용어 제거
- 키워드 추출
- 텍스트 정규화

## 의존성

- 없음 (독립 유틸리티)

## 구현 상세

### spa/src/lib/text/tokenizer.ts

```typescript
import { Tokenizer, TokenizerBuilder } from 'lindera-wasm';
import linderaKoDic from 'lindera-wasm-ko-dic';

let tokenizer: Tokenizer | null = null;

export async function initTokenizer(): Promise<Tokenizer> {
  if (tokenizer) return tokenizer;

  const builder = new TokenizerBuilder();
  builder.loadDic(linderaKoDic);
  tokenizer = builder.build();

  return tokenizer;
}

export interface Token {
  surface: string;      // 원형
  pos: string;          // 품사
  baseForm: string;     // 기본형
}

export async function tokenize(text: string): Promise<Token[]> {
  const t = await initTokenizer();
  const tokens = t.tokenize(text);

  return tokens.map((token: any) => ({
    surface: token.surface,
    pos: token.pos,
    baseForm: token.base_form || token.surface,
  }));
}

/** 명사만 추출 */
export async function extractNouns(text: string): Promise<string[]> {
  const tokens = await tokenize(text);
  return tokens
    .filter(t => t.pos.startsWith('NNG') || t.pos.startsWith('NNP'))
    .map(t => t.baseForm);
}
```

### spa/src/lib/text/stopwords.ts

```typescript
/** 한국어 불용어 목록 */
const KOREAN_STOPWORDS = new Set([
  // 조사
  '이', '가', '을', '를', '의', '에', '에서', '로', '으로', '와', '과',
  '도', '만', '은', '는', '이나', '나', '든지', '든', '까지', '부터',
  // 대명사
  '나', '너', '그', '그녀', '우리', '저희', '이것', '그것', '저것',
  // 부사
  '매우', '아주', '정말', '진짜', '너무', '많이', '조금', '약간',
  // 기타
  '등', '및', '또는', '그리고', '하지만', '그러나', '따라서', '그래서',
  '있다', '없다', '하다', '되다', '있는', '없는', '하는', '되는',
  '것', '수', '때', '곳', '바', '데', '점', '분', '명', '개',
]);

export function isStopword(word: string): boolean {
  return KOREAN_STOPWORDS.has(word) || word.length < 2;
}

export function removeStopwords(words: string[]): string[] {
  return words.filter(word => !isStopword(word));
}
```

### spa/src/lib/text/keywords.ts

```typescript
import { extractNouns } from './tokenizer';
import { removeStopwords } from './stopwords';

interface KeywordScore {
  word: string;
  count: number;
  score: number;
}

/** TF 기반 키워드 추출 */
export async function extractKeywords(
  text: string,
  topK: number = 10
): Promise<KeywordScore[]> {
  // 명사 추출
  const nouns = await extractNouns(text);

  // 불용어 제거
  const filtered = removeStopwords(nouns);

  // 빈도 계산
  const freq = new Map<string, number>();
  for (const word of filtered) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // 점수 계산 (TF)
  const totalWords = filtered.length;
  const scores: KeywordScore[] = Array.from(freq.entries()).map(([word, count]) => ({
    word,
    count,
    score: count / totalWords,
  }));

  // 정렬 및 상위 K개 반환
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** 문서 집합에서 TF-IDF 키워드 추출 */
export async function extractKeywordsTFIDF(
  documents: string[],
  topK: number = 10
): Promise<KeywordScore[]> {
  // 각 문서의 단어 집합
  const docWords: Set<string>[] = [];
  const allWords: string[] = [];

  for (const doc of documents) {
    const nouns = await extractNouns(doc);
    const filtered = removeStopwords(nouns);
    docWords.push(new Set(filtered));
    allWords.push(...filtered);
  }

  // TF 계산
  const tf = new Map<string, number>();
  for (const word of allWords) {
    tf.set(word, (tf.get(word) || 0) + 1);
  }

  // IDF 계산
  const N = documents.length;
  const idf = new Map<string, number>();
  for (const word of tf.keys()) {
    const df = docWords.filter(set => set.has(word)).length;
    idf.set(word, Math.log(N / df) + 1);
  }

  // TF-IDF 점수
  const scores: KeywordScore[] = Array.from(tf.entries()).map(([word, count]) => ({
    word,
    count,
    score: count * (idf.get(word) || 1),
  }));

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
```

### spa/src/lib/text/normalizer.ts

```typescript
/** 텍스트 정규화 파이프라인 */
export function normalizeText(text: string): string {
  return text
    // 유니코드 정규화
    .normalize('NFC')
    // 특수 공백 → 일반 공백
    .replace(/[\u00A0\u2000-\u200B\u3000]/g, ' ')
    // 연속 공백 → 단일 공백
    .replace(/\s+/g, ' ')
    // 줄바꿈 정규화
    .replace(/[\r\n]+/g, '\n')
    // 앞뒤 공백 제거
    .trim();
}

/** 숫자 추출 */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/[\d,]+(?:\.\d+)?/g) || [];
  return matches.map(m => parseFloat(m.replace(/,/g, '')));
}

/** 퍼센트 추출 */
export function extractPercentages(text: string): number[] {
  const matches = text.match(/([\d,]+(?:\.\d+)?)\s*%/g) || [];
  return matches.map(m => parseFloat(m.replace(/[,%]/g, '')));
}

/** 금액 추출 (원, 만원, 억원) */
export function extractMoney(text: string): Array<{ value: number; unit: string; raw: string }> {
  const pattern = /([\d,]+(?:\.\d+)?)\s*(원|만원|억원|천만원)/g;
  const results: Array<{ value: number; unit: string; raw: string }> = [];

  let match;
  while ((match = pattern.exec(text)) !== null) {
    results.push({
      value: parseFloat(match[1].replace(/,/g, '')),
      unit: match[2],
      raw: match[0],
    });
  }

  return results;
}
```

### spa/src/lib/text/index.ts

```typescript
export * from './tokenizer';
export * from './stopwords';
export * from './keywords';
export * from './normalizer';
```

## 완료 기준

- [ ] lindera-wasm 한글 형태소 분석
- [ ] 명사 추출 함수
- [ ] 한국어 불용어 제거
- [ ] TF 기반 키워드 추출
- [ ] TF-IDF 키워드 추출 (문서 집합)
- [ ] 텍스트 정규화 (공백, 유니코드)
- [ ] 숫자/퍼센트/금액 추출 유틸리티

## 참조 문서

- spec/03-spa-structure.md Section 5.2 (텍스트 처리)
