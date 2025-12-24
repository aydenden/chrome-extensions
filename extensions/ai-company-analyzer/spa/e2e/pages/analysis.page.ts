import { type Page, type Locator } from '@playwright/test';

/**
 * AI 분석 페이지 Page Object
 */
export class AnalysisPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly backButton: Locator;
  readonly engineStatus: Locator;
  readonly engineName: Locator;
  readonly imageList: Locator;
  readonly imageItems: Locator;
  readonly startButton: Locator;
  readonly stopButton: Locator;
  readonly progressBar: Locator;
  readonly progressText: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('[data-testid="company-name"]');
    this.backButton = page.getByRole('link', { name: /뒤로/ });
    this.engineStatus = page.locator('[data-testid="engine-status"]');
    this.engineName = page.locator('[data-testid="engine-name"]');
    this.imageList = page.locator('[data-testid="image-list"]');
    this.imageItems = page.locator('[data-testid="image-item"]');
    this.startButton = page.getByRole('button', { name: /분석 시작/ });
    this.stopButton = page.getByRole('button', { name: /중단/ });
    this.progressBar = page.locator('[data-testid="progress-bar"]');
    this.progressText = page.locator('[data-testid="progress-text"]');
  }

  async goto(companyId: string) {
    await this.page.goto(`./analysis/${companyId}`);
  }

  async waitForLoad() {
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  async clickBack() {
    await this.backButton.click();
  }

  async clickStart() {
    await this.startButton.click();
  }

  async getEngineStatus(): Promise<string> {
    const text = await this.engineStatus.textContent();
    return text?.trim() ?? '';
  }

  async getEngineName(): Promise<string> {
    const text = await this.engineName.textContent();
    return text?.trim() ?? '';
  }

  async getImageCount(): Promise<number> {
    return await this.imageItems.count();
  }

  async isStartButtonEnabled(): Promise<boolean> {
    return await this.startButton.isEnabled();
  }

  async getProgressText(): Promise<string> {
    const text = await this.progressText.textContent();
    return text?.trim() ?? '';
  }
}
