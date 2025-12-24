import { type Page, type Locator } from '@playwright/test';

/**
 * 회사 상세 페이지 Page Object
 */
export class CompanyDetailPage {
  readonly page: Page;
  readonly companyName: Locator;
  readonly dataSources: Locator;
  readonly backButton: Locator;
  readonly deleteButton: Locator;
  readonly startAnalysisButton: Locator;
  readonly imagesTab: Locator;
  readonly analysisTab: Locator;
  readonly imageCards: Locator;
  readonly analysisContent: Locator;
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.companyName = page.locator('[data-testid="company-name"]');
    this.dataSources = page.locator('[data-testid="data-sources"]');
    this.backButton = page.getByRole('link', { name: /뒤로/ });
    this.deleteButton = page.getByRole('button', { name: /삭제/ }).first();
    this.startAnalysisButton = page.getByRole('button', { name: /분석 시작/ });
    this.imagesTab = page.getByRole('button', { name: /^이미지\(\d+\)$/ });
    this.analysisTab = page.getByRole('button', { name: '분석 결과' });
    this.imageCards = page.locator('[data-testid="image-card"]');
    this.analysisContent = page.locator('[data-testid="analysis-content"]');
    this.deleteModal = page.getByRole('dialog');
    this.deleteConfirmButton = page.getByRole('dialog').getByRole('button', { name: '삭제' });
    this.deleteCancelButton = page.getByRole('dialog').getByRole('button', { name: '취소' });
  }

  async goto(companyId: string) {
    await this.page.goto(`./company/${companyId}`);
  }

  async waitForLoad() {
    await this.companyName.waitFor({ state: 'visible', timeout: 10000 });
  }

  async clickBack() {
    await this.backButton.click();
  }

  async clickDelete() {
    await this.deleteButton.click();
  }

  async clickStartAnalysis() {
    await this.startAnalysisButton.click();
  }

  async clickImagesTab() {
    await this.imagesTab.click();
  }

  async clickAnalysisTab() {
    await this.analysisTab.click();
  }

  async confirmDelete() {
    await this.deleteConfirmButton.click();
  }

  async cancelDelete() {
    await this.deleteCancelButton.click();
  }

  async getCompanyName(): Promise<string> {
    const text = await this.companyName.textContent();
    return text?.trim() ?? '';
  }

  async getImageCount(): Promise<number> {
    return await this.imageCards.count();
  }
}
