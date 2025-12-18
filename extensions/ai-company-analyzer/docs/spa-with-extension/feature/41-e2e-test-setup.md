# Feature 41: Playwright E2E 환경

## 개요

Playwright를 사용한 E2E 테스트 환경을 설정합니다.

## 범위

- Playwright 설정
- 테스트 유틸리티
- Extension Mock
- CI 설정

## 의존성

- Feature 32: 분석 진행 페이지

## 구현 상세

### spa/playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5173/ai-company-analyzer',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/ai-company-analyzer',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### spa/e2e/setup/global-setup.ts

```typescript
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Extension Mock 초기화
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Mock Extension 스크립트 주입
  await page.addInitScript(() => {
    window.__EXTENSION_MOCK__ = true;

    // Chrome runtime mock
    (window as any).chrome = {
      runtime: {
        sendMessage: async (extensionId: string, message: any) => {
          return window.__mockExtensionResponse?.(message) ?? { success: true };
        },
      },
    };
  });

  await browser.close();
}

export default globalSetup;
```

### spa/e2e/fixtures/extension-mock.ts

```typescript
import { test as base, Page } from '@playwright/test';

interface MockCompany {
  id: string;
  name: string;
  dataSources: string[];
  imageCount: number;
  hasAnalysis: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MockImage {
  id: string;
  companyId: string;
  subCategory: string;
  hasAnalysis: boolean;
  createdAt: string;
}

interface ExtensionMockData {
  companies: MockCompany[];
  images: MockImage[];
  stats: { totalCompanies: number; totalImages: number; storageUsed: number };
}

export const test = base.extend<{ mockExtension: (data: ExtensionMockData) => Promise<void> }>({
  mockExtension: async ({ page }, use) => {
    const mock = async (data: ExtensionMockData) => {
      await page.addInitScript((mockData) => {
        window.__mockExtensionResponse = (message: any) => {
          switch (message.type) {
            case 'PING':
              return { success: true, data: 'pong' };

            case 'GET_STATS':
              return { success: true, data: mockData.stats };

            case 'GET_COMPANIES':
              return { success: true, data: mockData.companies };

            case 'GET_COMPANY':
              const company = mockData.companies.find(c => c.id === message.payload?.companyId);
              return company
                ? { success: true, data: company }
                : { success: false, error: { code: 'NOT_FOUND' } };

            case 'GET_IMAGES':
              const images = mockData.images.filter(i => i.companyId === message.payload?.companyId);
              return { success: true, data: images };

            case 'GET_IMAGE_DATA':
              return {
                success: true,
                data: {
                  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                },
              };

            case 'GET_IMAGE_THUMBNAIL':
              return {
                success: true,
                data: {
                  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                },
              };

            default:
              return { success: true };
          }
        };
      }, data);
    };

    await use(mock);
  },
});

export { expect } from '@playwright/test';
```

### spa/e2e/fixtures/test-data.ts

```typescript
import { ExtensionMockData } from './extension-mock';

export const emptyData: ExtensionMockData = {
  companies: [],
  images: [],
  stats: { totalCompanies: 0, totalImages: 0, storageUsed: 0 },
};

export const sampleData: ExtensionMockData = {
  companies: [
    {
      id: 'company-1',
      name: '테스트 회사 A',
      dataSources: ['WANTED', 'BLIND'],
      imageCount: 5,
      hasAnalysis: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    },
    {
      id: 'company-2',
      name: '테스트 회사 B',
      dataSources: ['DART'],
      imageCount: 3,
      hasAnalysis: false,
      createdAt: '2024-01-10T00:00:00Z',
      updatedAt: '2024-01-10T00:00:00Z',
    },
  ],
  images: [
    {
      id: 'image-1',
      companyId: 'company-1',
      subCategory: 'JOB_POSTING',
      hasAnalysis: true,
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'image-2',
      companyId: 'company-1',
      subCategory: 'COMPANY_REVIEW',
      hasAnalysis: false,
      createdAt: '2024-01-02T00:00:00Z',
    },
  ],
  stats: { totalCompanies: 2, totalImages: 5, storageUsed: 1024 * 1024 * 10 },
};
```

### spa/e2e/pages/company-list.page.ts

```typescript
import { Page, Locator } from '@playwright/test';

export class CompanyListPage {
  readonly page: Page;
  readonly companyCards: Locator;
  readonly searchInput: Locator;
  readonly siteFilter: Locator;
  readonly sortSelect: Locator;
  readonly emptyMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.companyCards = page.locator('[data-testid="company-card"]');
    this.searchInput = page.locator('input[placeholder*="검색"]');
    this.siteFilter = page.locator('select').first();
    this.sortSelect = page.locator('select').nth(1);
    this.emptyMessage = page.locator('text=수집된 회사가 없습니다');
  }

  async goto() {
    await this.page.goto('/');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
  }

  async filterBySite(site: string) {
    await this.siteFilter.selectOption(site);
  }

  async sortBy(option: string) {
    await this.sortSelect.selectOption(option);
  }

  async clickCompany(name: string) {
    await this.page.click(`text=${name}`);
  }
}
```

### package.json 스크립트

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:debug": "playwright test --debug",
    "e2e:report": "playwright show-report"
  }
}
```

## 완료 기준

- [ ] playwright.config.ts (chromium, firefox, mobile)
- [ ] Extension Mock 시스템
- [ ] 테스트 데이터 fixtures
- [ ] Page Object 패턴 (CompanyListPage)
- [ ] WebServer 설정 (dev 서버 자동 시작)
- [ ] CI 설정 (retries, reporters)

## 참조 문서

- spec/03-spa-structure.md Section 8.3 (E2E 테스트)
