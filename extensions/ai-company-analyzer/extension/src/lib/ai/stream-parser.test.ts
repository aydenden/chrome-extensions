import { describe, it, expect } from 'vitest';
import { extractJsonFromContent, parseStreamLine, StreamBuffer } from './stream-parser';

describe('stream-parser', () => {
  describe('extractJsonFromContent', () => {
    it('null이나 빈 문자열에서는 null을 반환한다', () => {
      expect(extractJsonFromContent(null as unknown as string)).toBeNull();
      expect(extractJsonFromContent('')).toBeNull();
      expect(extractJsonFromContent('   ')).toBeNull();
    });

    it('JSON 코드 블록에서 추출한다', () => {
      const content = `
분석 결과입니다.
\`\`\`json
{"score": 85, "summary": "좋은 회사입니다"}
\`\`\`
더 자세한 내용은...
      `;

      const result = extractJsonFromContent(content);

      expect(result).toEqual({ score: 85, summary: '좋은 회사입니다' });
    });

    it('일반 코드 블록에서 추출한다', () => {
      const content = `
결과:
\`\`\`
{"name": "테스트", "value": 123}
\`\`\`
      `;

      const result = extractJsonFromContent(content);

      expect(result).toEqual({ name: '테스트', value: 123 });
    });

    it('순수 JSON 문자열을 파싱한다', () => {
      const content = '{"key": "value", "number": 42}';

      const result = extractJsonFromContent(content);

      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('텍스트 중간의 JSON 객체를 찾아서 추출한다', () => {
      const content = '분석 결과: {"result": true, "data": [1, 2, 3]} 끝.';

      const result = extractJsonFromContent(content);

      expect(result).toEqual({ result: true, data: [1, 2, 3] });
    });

    it('배열 형태의 JSON도 추출한다', () => {
      const content = '[{"id": 1}, {"id": 2}]';

      const result = extractJsonFromContent(content);

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('줄바꿈으로 구분된 JSON을 찾는다', () => {
      const content = `
이건 텍스트입니다.
{"found": true}
그리고 이건 다른 텍스트
      `;

      const result = extractJsonFromContent(content);

      expect(result).toEqual({ found: true });
    });

    it('유효하지 않은 JSON이면 null을 반환한다', () => {
      const content = '이건 JSON이 아닙니다. {broken: json}';

      const result = extractJsonFromContent(content);

      expect(result).toBeNull();
    });
  });

  describe('parseStreamLine', () => {
    it('빈 줄은 null을 반환한다', () => {
      expect(parseStreamLine('')).toBeNull();
      expect(parseStreamLine('   ')).toBeNull();
      expect(parseStreamLine(null as unknown as string)).toBeNull();
    });

    it('thinking 필드를 파싱한다', () => {
      const line = JSON.stringify({
        message: { thinking: '생각 중...' },
        done: false,
      });

      const result = parseStreamLine(line);

      expect(result).toEqual({
        thinking: '생각 중...',
        content: undefined,
        done: false,
      });
    });

    it('content 필드를 파싱한다', () => {
      const line = JSON.stringify({
        message: { content: '응답 내용' },
        done: false,
      });

      const result = parseStreamLine(line);

      expect(result).toEqual({
        thinking: undefined,
        content: '응답 내용',
        done: false,
      });
    });

    it('done 상태를 파싱한다', () => {
      const line = JSON.stringify({
        message: { content: '' },
        done: true,
      });

      const result = parseStreamLine(line);

      expect(result?.done).toBe(true);
    });

    it('done 필드가 없으면 false로 처리한다', () => {
      const line = JSON.stringify({ message: { content: '테스트' } });

      const result = parseStreamLine(line);

      expect(result?.done).toBe(false);
    });

    it('잘못된 JSON은 null을 반환한다', () => {
      const result = parseStreamLine('{invalid json}');

      expect(result).toBeNull();
    });
  });

  describe('StreamBuffer', () => {
    it('청크를 누적하고 완전한 줄을 반환한다', () => {
      const buffer = new StreamBuffer();
      const encoder = new TextEncoder();

      const lines1 = buffer.append(encoder.encode('첫 번째 줄\n두 번'));
      expect(lines1).toEqual(['첫 번째 줄']);

      const lines2 = buffer.append(encoder.encode('째 줄\n'));
      expect(lines2).toEqual(['두 번째 줄']);
    });

    it('불완전한 줄은 버퍼에 유지한다', () => {
      const buffer = new StreamBuffer();
      const encoder = new TextEncoder();

      const lines = buffer.append(encoder.encode('불완전한'));
      expect(lines).toEqual([]);

      const flush = buffer.flush();
      expect(flush).toBe('불완전한');
    });

    it('빈 줄은 필터링한다', () => {
      const buffer = new StreamBuffer();
      const encoder = new TextEncoder();

      const lines = buffer.append(encoder.encode('라인1\n\n\n라인2\n'));
      expect(lines).toEqual(['라인1', '라인2']);
    });

    it('여러 줄을 한 번에 처리한다', () => {
      const buffer = new StreamBuffer();
      const encoder = new TextEncoder();

      const lines = buffer.append(encoder.encode('A\nB\nC\nD\n'));
      expect(lines).toEqual(['A', 'B', 'C', 'D']);
    });

    it('멀티바이트 문자를 정상 처리한다', () => {
      const buffer = new StreamBuffer();
      const encoder = new TextEncoder();

      // 한글 문자가 청크 경계에서 잘리는 경우 시뮬레이션
      const fullText = '한글 테스트\n';
      const encoded = encoder.encode(fullText);

      // 첫 번째 청크 (완전한 라인)
      const lines = buffer.append(encoded);
      expect(lines).toEqual(['한글 테스트']);
    });

    it('flush 후 버퍼가 비워진다', () => {
      const buffer = new StreamBuffer();
      const encoder = new TextEncoder();

      buffer.append(encoder.encode('남은 데이터'));
      buffer.flush();

      const remaining = buffer.flush();
      expect(remaining).toBe('');
    });
  });
});
