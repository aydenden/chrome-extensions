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

  it('변수가 없는 템플릿', () => {
    const template = 'No variables here';
    expect(fillTemplate(template, {})).toBe('No variables here');
  });

  it('존재하지 않는 변수는 치환하지 않음', () => {
    const template = 'Hello {{NAME}}, welcome to {{PLACE}}';
    expect(fillTemplate(template, { NAME: 'John' })).toBe('Hello John, welcome to {{PLACE}}');
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
