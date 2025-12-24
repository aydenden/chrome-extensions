import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaClient } from './ollama-client';
import { mockFetch, mockStreamingFetch } from '../../../test/setup';

describe('OllamaClient', () => {
  let client: OllamaClient;

  beforeEach(() => {
    client = new OllamaClient('http://localhost:11434', 'llava:latest');
    vi.clearAllMocks();
  });

  describe('checkConnection', () => {
    it('서버가 실행 중이면 true를 반환한다', async () => {
      mockFetch('Ollama is running');

      const result = await client.checkConnection();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://localhost:11434', { method: 'GET' });
    });

    it('서버가 다른 응답을 보내면 false를 반환한다', async () => {
      mockFetch('Not Ollama');

      const result = await client.checkConnection();

      expect(result).toBe(false);
    });

    it('연결 실패시 false를 반환한다', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await client.checkConnection();

      expect(result).toBe(false);
    });
  });

  describe('getModels', () => {
    it('모델 목록을 반환한다', async () => {
      mockFetch({
        models: [{ name: 'llava:latest' }, { name: 'gemma:7b' }, { name: 'mistral:latest' }],
      });

      const models = await client.getModels();

      expect(models).toEqual(['llava:latest', 'gemma:7b', 'mistral:latest']);
      expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
    });

    it('빈 목록을 처리한다', async () => {
      mockFetch({ models: [] });

      const models = await client.getModels();

      expect(models).toEqual([]);
    });

    it('API 에러시 빈 배열을 반환한다', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const models = await client.getModels();

      expect(models).toEqual([]);
    });

    it('models 필드가 없으면 빈 배열을 반환한다', async () => {
      mockFetch({});

      const models = await client.getModels();

      expect(models).toEqual([]);
    });
  });

  describe('analyzeImageStream', () => {
    it('이미지 분석 스트리밍을 수행한다', async () => {
      const chunks = [
        JSON.stringify({ message: { thinking: '분석 중...' }, done: false }),
        JSON.stringify({ message: { content: '이 이미지는' }, done: false }),
        JSON.stringify({ message: { content: ' 차트입니다.' }, done: false }),
        JSON.stringify({ message: { content: '' }, done: true }),
      ];
      mockStreamingFetch(chunks);

      const results: string[] = [];
      const generator = client.analyzeImageStream('base64image', '이미지를 분석해주세요');

      for await (const chunk of generator) {
        results.push(`${chunk.type}:${chunk.text}`);
      }

      expect(results).toContain('thinking:분석 중...');
      expect(results).toContain('content:이 이미지는');
      expect(results).toContain('content: 차트입니다.');
      expect(results).toContain('done:');
    });

    it('API 에러시 throw하지 않고 처리한다', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      });

      const generator = client.analyzeImageStream('base64image', '분석해주세요');

      // generator 소비 시 에러가 throw되지 않아야 함
      const chunks: unknown[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // 에러 발생 시에도 청크를 생성하지 않음
      expect(chunks).toHaveLength(0);
    });

    it('네트워크 에러시 throw하지 않고 처리한다', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const generator = client.analyzeImageStream('base64image', '분석해주세요');

      // generator 소비 시 에러가 throw되지 않아야 함
      const chunks: unknown[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
    });
  });

  describe('chatStream', () => {
    it('채팅 스트리밍을 수행한다', async () => {
      const chunks = [
        JSON.stringify({ message: { content: '안녕하세요!' }, done: false }),
        JSON.stringify({ message: { content: '' }, done: true }),
      ];
      mockStreamingFetch(chunks);

      const results: string[] = [];
      const generator = client.chatStream([{ role: 'user', content: '안녕?' }]);

      for await (const chunk of generator) {
        if (chunk.type === 'content' && chunk.text) {
          results.push(chunk.text);
        }
      }

      expect(results).toContain('안녕하세요!');
    });

    it('콜백 옵션이 호출된다', async () => {
      const chunks = [
        JSON.stringify({ message: { thinking: '생각...' }, done: false }),
        JSON.stringify({ message: { content: '응답' }, done: false }),
        JSON.stringify({ message: { content: '' }, done: true }),
      ];
      mockStreamingFetch(chunks);

      const onThinking = vi.fn();
      const onContent = vi.fn();

      const generator = client.chatStream([{ role: 'user', content: '질문' }], {
        onThinking,
        onContent,
      });

      for await (const _ of generator) {
        // consume
      }

      expect(onThinking).toHaveBeenCalledWith('생각...', '생각...');
      expect(onContent).toHaveBeenCalledWith('응답', '응답');
    });
  });

  describe('unloadModel', () => {
    it('모델 언로드 요청을 보낸다', async () => {
      mockFetch({});

      await client.unloadModel();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"keep_alive":0'),
        })
      );
    });

    it('언로드 실패를 조용히 처리한다', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed'));

      // 에러가 발생해도 throw하지 않음
      await expect(client.unloadModel()).resolves.toBeUndefined();
    });
  });

  describe('설정 변경', () => {
    it('setModel로 모델을 변경할 수 있다', () => {
      client.setModel('gemma:7b');

      expect(client.getModel()).toBe('gemma:7b');
    });

    it('setEndpoint로 엔드포인트를 변경할 수 있다', () => {
      client.setEndpoint('http://remote:11434');

      expect(client.getEndpoint()).toBe('http://remote:11434');
    });
  });
});
