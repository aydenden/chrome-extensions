/**
 * Playwright E2E 테스트 Fixtures
 *
 * Chrome Extension 로드 및 Extension ID 동적 추출
 * Worker scope로 컨텍스트 공유 (AI 엔진 상태 유지)
 */

import {
  test as base,
  chromium,
  type BrowserContext,
  type Worker,
} from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extension 경로 (프로젝트 루트 - manifest.json 위치)
const EXTENSION_PATH = path.join(__dirname, '..');

// 테스트 타임아웃 (AI 모델 로드 대기)
const SERVICE_WORKER_TIMEOUT = 120000; // 2분

/**
 * Test-scoped Fixtures (각 테스트마다 생성)
 */
type TestFixtures = {
  // 없음 - 모든 fixture가 worker scope
};

/**
 * Worker-scoped Fixtures (워커 내 모든 테스트에서 공유)
 */
type WorkerFixtures = {
  extensionContext: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
};

/**
 * Extension 테스트용 Fixtures
 * Worker scope로 설정하여 모든 테스트에서 동일한 컨텍스트 공유
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  // BrowserContext with Extension loaded (Worker scope)
  extensionContext: [
    async ({}, use) => {
      const context = await chromium.launchPersistentContext('', {
        headless: false,
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`,
          // GPU 관련 설정 (WebGPU 지원)
          '--enable-features=Vulkan',
          '--enable-gpu-rasterization',
          '--enable-zero-copy',
        ],
      });

      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  // Extension ID 동적 추출 (Worker scope)
  extensionId: [
    async ({ extensionContext }, use) => {
      // Service Worker가 등록될 때까지 대기
      let serviceWorker = extensionContext.serviceWorkers()[0];

      if (!serviceWorker) {
        serviceWorker = await extensionContext.waitForEvent('serviceworker', {
          timeout: SERVICE_WORKER_TIMEOUT,
        });
      }

      // URL에서 Extension ID 추출
      // chrome-extension://[extension-id]/background.js
      const extensionId = serviceWorker.url().split('/')[2];

      await use(extensionId);
    },
    { scope: 'worker' },
  ],

  // Service Worker 접근 (Worker scope)
  serviceWorker: [
    async ({ extensionContext }, use) => {
      let serviceWorker = extensionContext.serviceWorkers()[0];

      if (!serviceWorker) {
        serviceWorker = await extensionContext.waitForEvent('serviceworker', {
          timeout: SERVICE_WORKER_TIMEOUT,
        });
      }

      await use(serviceWorker);
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';

/**
 * Extension 페이지 URL 생성 헬퍼
 */
export function getExtensionUrl(extensionId: string, page: string): string {
  return `chrome-extension://${extensionId}/${page}`;
}

/**
 * Popup URL 생성
 */
export function getPopupUrl(extensionId: string): string {
  return getExtensionUrl(extensionId, 'dist/src/popup/popup.html');
}

/**
 * List 페이지 URL 생성
 */
export function getListPageUrl(extensionId: string): string {
  return getExtensionUrl(extensionId, 'dist/src/pages/list/list.html');
}

/**
 * Detail 페이지 URL 생성
 */
export function getDetailPageUrl(extensionId: string, companyId: string): string {
  return getExtensionUrl(extensionId, `dist/src/pages/detail/detail.html?id=${companyId}`);
}

/**
 * Settings 페이지 URL 생성
 */
export function getSettingsPageUrl(extensionId: string): string {
  return getExtensionUrl(extensionId, 'dist/src/pages/settings/settings.html');
}

/**
 * IndexedDB 초기화 헬퍼
 */
export async function clearDatabase(context: BrowserContext, extensionId: string): Promise<void> {
  const page = await context.newPage();
  await page.goto(getPopupUrl(extensionId));

  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('ai-company-analyzer');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  await page.close();
}
