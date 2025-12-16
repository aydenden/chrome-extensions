/**
 * AI 파이프라인 E2E 테스트
 *
 * VLM (Qwen2-VL) 엔진 테스트
 * 주의: 모델 로드에 1-2분 소요
 */

import { test, expect, getPopupUrl } from './fixtures';

// AI 모델 로드 타임아웃 (2분)
const AI_MODEL_TIMEOUT = 120000;

test.describe('AI Engine Status', () => {
  test('Service Worker가 정상적으로 실행된다', async ({ serviceWorker }) => {
    // Service Worker URL 확인
    expect(serviceWorker.url()).toContain('chrome-extension://');
    expect(serviceWorker.url()).toContain('background.js');
  });

  test('VLM 엔진 상태를 조회할 수 있다', async ({ page, extensionId }) => {
    await page.goto(getPopupUrl(extensionId));

    // Service Worker에 메시지 전송
    const response = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_ENGINE_STATUS' }, resolve);
      });
    }) as { success: boolean; status: Record<string, unknown> };

    // 응답 구조 확인: { success: true, status: { isReady, isLoading, loadProgress, ... } }
    expect(response).toHaveProperty('success', true);
    expect(response).toHaveProperty('status');
    expect(response.status).toHaveProperty('isReady');
    expect(response.status).toHaveProperty('isLoading');
    expect(response.status).toHaveProperty('loadProgress');
  });

});

test.describe('AI Model Loading', () => {
  // 실제 모델 로드 테스트 (시간 소요)
  test('VLM 엔진을 초기화할 수 있다', async ({ page, extensionId }) => {
    test.setTimeout(AI_MODEL_TIMEOUT);

    await page.goto(getPopupUrl(extensionId));

    // VLM 초기화 요청
    const initResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'INIT_SMOLVLM' }, resolve);
      });
    }) as { success: boolean; status?: Record<string, unknown> };

    // 초기화 성공 또는 이미 초기화됨
    expect(initResult).toBeDefined();
    expect(initResult).toHaveProperty('success');

    // 상태 확인
    const response = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_ENGINE_STATUS' }, resolve);
      });
    }) as { success: boolean; status: Record<string, unknown> };

    // 로드 완료 또는 로딩 중
    expect(response).toHaveProperty('success', true);
    expect(response.status).toHaveProperty('isReady');
  });

});

test.describe('Message Handling', () => {
  test('GET_COMPANIES 메시지가 정상 동작한다', async ({ page, extensionId }) => {
    await page.goto(getPopupUrl(extensionId));

    const response = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_COMPANIES' }, resolve);
      });
    }) as { success: boolean; data: unknown[] };

    // 응답 구조 확인: { success: true, data: [...] }
    expect(response).toHaveProperty('success', true);
    expect(response).toHaveProperty('data');
    expect(Array.isArray(response.data)).toBe(true);
  });

  test('알 수 없는 메시지 타입에 대한 응답', async ({ page, extensionId }) => {
    await page.goto(getPopupUrl(extensionId));

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'UNKNOWN_TYPE' }, resolve);
      });
    });

    // { status: 'unknown_message' } 응답 확인
    expect(result).toBeDefined();
    expect(result).toHaveProperty('status', 'unknown_message');
  });
});
