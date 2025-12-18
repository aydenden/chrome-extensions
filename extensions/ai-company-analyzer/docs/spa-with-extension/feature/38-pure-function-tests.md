# Feature 38: 순수 함수 테스트

## 개요

텍스트 처리, 프롬프트, 유틸리티 등 순수 함수에 대한 단위 테스트를 작성합니다.

## 범위

- 텍스트 정규화 테스트
- 키워드 추출 테스트
- 프롬프트 템플릿 테스트
- 유틸리티 함수 테스트

## 의존성

- Feature 26: 텍스트 후처리 파이프라인
- Feature 30: 분류/분석 프롬프트 정의

## 구현 상세

### spa/src/lib/text/normalizer.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  extractNumbers,
  extractPercentages,
  extractMoney,
} from './normalizer';

describe('normalizeText', () => {
  it('유니코드 정규화', () => {
    const input = '\u00A0test\u3000text';
    expect(normalizeText(input)).toBe('test text');
  });

  it('연속 공백 제거', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
  });

  it('앞뒤 공백 제거', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('줄바꿈 정규화', () => {
    expect(normalizeText('line1\r\n\r\nline2')).toBe('line1\nline2');
  });
});

describe('extractNumbers', () => {
  it('정수 추출', () => {
    expect(extractNumbers('가격은 1000원입니다')).toEqual([1000]);
  });

  it('소수점 추출', () => {
    expect(extractNumbers('3.14159')).toEqual([3.14159]);
  });

  it('쉼표 포함 숫자', () => {
    expect(extractNumbers('1,000,000원')).toEqual([1000000]);
  });

  it('여러 숫자 추출', () => {
    expect(extractNumbers('10에서 20 사이')).toEqual([10, 20]);
  });
});

describe('extractPercentages', () => {
  it('퍼센트 추출', () => {
    expect(extractPercentages('성장률 25%')).toEqual([25]);
  });

  it('소수점 퍼센트', () => {
    expect(extractPercentages('3.5%')).toEqual([3.5]);
  });

  it('여러 퍼센트', () => {
    expect(extractPercentages('A: 10%, B: 20%')).toEqual([10, 20]);
  });
});

describe('extractMoney', () => {
  it('원 단위', () => {
    const result = extractMoney('5000원');
    expect(result).toEqual([{ value: 5000, unit: '원', raw: '5000원' }]);
  });

  it('만원 단위', () => {
    const result = extractMoney('500만원');
    expect(result).toEqual([{ value: 500, unit: '만원', raw: '500만원' }]);
  });

  it('억원 단위', () => {
    const result = extractMoney('투자금 100억원');
    expect(result).toEqual([{ value: 100, unit: '억원', raw: '100억원' }]);
  });

  it('복합 추출', () => {
    const result = extractMoney('연봉 5000만원, 상여 500만원');
    expect(result).toHaveLength(2);
  });
});
```

### spa/src/lib/text/stopwords.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { isStopword, removeStopwords } from './stopwords';

describe('isStopword', () => {
  it('조사 불용어', () => {
    expect(isStopword('이')).toBe(true);
    expect(isStopword('를')).toBe(true);
    expect(isStopword('에서')).toBe(true);
  });

  it('짧은 단어 불용어', () => {
    expect(isStopword('가')).toBe(true);
  });

  it('일반 단어 비불용어', () => {
    expect(isStopword('회사')).toBe(false);
    expect(isStopword('개발자')).toBe(false);
  });
});

describe('removeStopwords', () => {
  it('불용어 제거', () => {
    const words = ['회사', '는', '좋은', '것', '이다'];
    const result = removeStopwords(words);
    expect(result).toEqual(['회사', '좋은', '이다']);
  });

  it('빈 배열 처리', () => {
    expect(removeStopwords([])).toEqual([]);
  });
});
```

### spa/src/lib/ai/prompts/index.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { fillTemplate, estimateTokens, truncateForTokenLimit } from './index';

describe('fillTemplate', () => {
  it('단일 변수 치환', () => {
    const template = 'Hello, {{NAME}}!';
    expect(fillTemplate(template, { NAME: 'World' })).toBe('Hello, World!');
  });

  it('다중 변수 치환', () => {
    const template = '{{A}} + {{B}} = {{C}}';
    expect(fillTemplate(template, { A: '1', B: '2', C: '3' })).toBe('1 + 2 = 3');
  });

  it('같은 변수 여러 번 치환', () => {
    const template = '{{X}} {{X}} {{X}}';
    expect(fillTemplate(template, { X: 'a' })).toBe('a a a');
  });
});

describe('estimateTokens', () => {
  it('영어 텍스트 추정', () => {
    const text = 'Hello World';
    expect(estimateTokens(text)).toBeGreaterThan(0);
    expect(estimateTokens(text)).toBeLessThan(10);
  });

  it('한글 텍스트 추정', () => {
    const text = '안녕하세요';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
  });

  it('빈 문자열', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('truncateForTokenLimit', () => {
  it('제한 미달 시 원본 반환', () => {
    const text = 'Short text';
    expect(truncateForTokenLimit(text, 100)).toBe(text);
  });

  it('제한 초과 시 자르기', () => {
    const text = 'A'.repeat(1000);
    const result = truncateForTokenLimit(text, 50);
    expect(result.length).toBeLessThan(text.length);
    expect(result.endsWith('...')).toBe(true);
  });
});
```

### spa/src/lib/utils.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn (classnames)', () => {
  it('단일 클래스', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('여러 클래스', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('조건부 클래스', () => {
    expect(cn('foo', true && 'bar', false && 'baz')).toBe('foo bar');
  });

  it('tailwind 병합', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});
```

### spa/src/lib/resilience/circuit-breaker.test.ts

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 1000 });
  });

  it('초기 상태는 CLOSED', () => {
    expect(cb.getState()).toBe('CLOSED');
  });

  it('성공 시 CLOSED 유지', async () => {
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe('CLOSED');
  });

  it('임계치 도달 시 OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(() => Promise.reject(new Error('fail')));
      } catch {}
    }
    expect(cb.getState()).toBe('OPEN');
  });

  it('OPEN 상태에서 CircuitOpenError', async () => {
    cb.trip();
    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError);
  });

  it('타임아웃 후 HALF_OPEN', async () => {
    vi.useFakeTimers();
    cb.trip();
    expect(cb.getState()).toBe('OPEN');

    vi.advanceTimersByTime(1000);
    expect(cb.getState()).toBe('HALF_OPEN');

    vi.useRealTimers();
  });

  it('HALF_OPEN에서 성공 시 CLOSED', async () => {
    vi.useFakeTimers();
    cb.trip();
    vi.advanceTimersByTime(1000);

    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe('CLOSED');

    vi.useRealTimers();
  });
});
```

## 완료 기준

- [ ] normalizer 테스트: 정규화, 숫자/금액 추출
- [ ] stopwords 테스트: 불용어 판별 및 제거
- [ ] prompts 테스트: 템플릿 치환, 토큰 추정
- [ ] utils 테스트: cn 함수
- [ ] circuit-breaker 테스트: 상태 전이

## 참조 문서

- spec/03-spa-structure.md Section 8.1 (단위 테스트)
