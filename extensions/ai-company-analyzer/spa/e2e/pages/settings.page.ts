import { type Page, type Locator } from '@playwright/test';

/**
 * 설정 페이지 Page Object
 */
export class SettingsPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly backButton: Locator;
  readonly endpointInput: Locator;
  readonly connectionStatus: Locator;
  readonly modelSelect: Locator;
  readonly deleteAllButton: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: '설정' });
    this.backButton = page.getByRole('link', { name: 'AI COMPANY ANALYZER' });
    this.endpointInput = page.getByRole('textbox', { name: /localhost/ });
    this.connectionStatus = page.getByText(/연결됨|연결 안됨/);
    this.modelSelect = page.locator('input[type="radio"]').first();
    this.deleteAllButton = page.getByRole('button', { name: /모든 데이터 삭제/ });
    this.deleteConfirmButton = page.getByRole('dialog').getByRole('button', { name: /삭제/ });
  }

  async goto() {
    await this.page.goto('./settings');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async setEndpoint(url: string) {
    await this.endpointInput.fill(url);
    await this.endpointInput.blur();
  }

  async getEndpoint(): Promise<string> {
    return await this.endpointInput.inputValue();
  }

  async selectModel(modelName: string) {
    await this.modelSelect.selectOption({ label: modelName });
  }

  async clickDeleteAll() {
    await this.deleteAllButton.click();
  }

  async confirmDelete() {
    await this.deleteConfirmButton.click();
  }

  async getConnectionStatus(): Promise<string> {
    const text = await this.connectionStatus.textContent();
    return text?.trim() ?? '';
  }
}
