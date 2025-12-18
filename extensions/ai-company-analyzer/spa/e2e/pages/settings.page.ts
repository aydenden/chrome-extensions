import { type Page, type Locator } from '@playwright/test';

/**
 * Settings 페이지 Page Object
 */
export class SettingsPage {
  readonly page: Page;

  // Locators
  readonly pageTitle: Locator;
  readonly backButton: Locator;

  // AI Engine Settings
  readonly engineSection: Locator;
  readonly engineModelSelect: Locator;
  readonly engineUrlInput: Locator;
  readonly testConnectionButton: Locator;

  // OCR Settings
  readonly ocrSection: Locator;
  readonly ocrEnabledCheckbox: Locator;
  readonly ocrLanguageSelect: Locator;

  // Data Management
  readonly dataSection: Locator;
  readonly clearDataButton: Locator;
  readonly exportDataButton: Locator;

  // Save
  readonly saveButton: Locator;
  readonly resetButton: Locator;

  // Modals
  readonly clearDataModal: Locator;
  readonly clearDataConfirmButton: Locator;
  readonly clearDataCancelButton: Locator;

  // Toast
  readonly toast: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.pageTitle = page.getByRole('heading', { name: '설정' });
    this.backButton = page.getByRole('button', { name: /뒤로/ });

    // AI Engine
    this.engineSection = page.locator('[data-testid="engine-section"]');
    this.engineModelSelect = page.getByLabel(/AI 엔진|모델/);
    this.engineUrlInput = page.getByLabel(/엔진 URL|Ollama URL/);
    this.testConnectionButton = page.getByRole('button', { name: /연결 테스트/ });

    // OCR
    this.ocrSection = page.locator('[data-testid="ocr-section"]');
    this.ocrEnabledCheckbox = page.getByLabel(/OCR 활성화/);
    this.ocrLanguageSelect = page.getByLabel(/OCR 언어/);

    // Data Management
    this.dataSection = page.locator('[data-testid="data-section"]');
    this.clearDataButton = page.getByRole('button', { name: /데이터 삭제|모든 데이터 삭제/ });
    this.exportDataButton = page.getByRole('button', { name: /데이터 내보내기/ });

    // Actions
    this.saveButton = page.getByRole('button', { name: /저장/ });
    this.resetButton = page.getByRole('button', { name: /초기화/ });

    // Modals
    this.clearDataModal = page.getByRole('dialog', { name: /데이터 삭제/ });
    this.clearDataConfirmButton = this.clearDataModal.getByRole('button', { name: '삭제' });
    this.clearDataCancelButton = this.clearDataModal.getByRole('button', { name: '취소' });

    // Toast
    this.toast = page.locator('[data-testid="toast"]');
  }

  /**
   * 페이지로 이동
   */
  async goto() {
    await this.page.goto('/settings');
  }

  /**
   * 페이지가 로드될 때까지 대기
   */
  async waitForLoad() {
    await this.pageTitle.waitFor({ state: 'visible' });
  }

  /**
   * 뒤로가기 버튼 클릭
   */
  async clickBack() {
    await this.backButton.click();
  }

  /**
   * AI 엔진 모델 선택
   */
  async selectEngineModel(model: string) {
    await this.engineModelSelect.selectOption(model);
  }

  /**
   * 엔진 URL 입력
   */
  async setEngineUrl(url: string) {
    await this.engineUrlInput.fill(url);
  }

  /**
   * 연결 테스트 버튼 클릭
   */
  async clickTestConnection() {
    await this.testConnectionButton.click();
  }

  /**
   * OCR 활성화/비활성화
   */
  async toggleOcr(enabled: boolean) {
    const isChecked = await this.ocrEnabledCheckbox.isChecked();
    if (isChecked !== enabled) {
      await this.ocrEnabledCheckbox.click();
    }
  }

  /**
   * OCR 언어 선택
   */
  async selectOcrLanguage(language: string) {
    await this.ocrLanguageSelect.selectOption(language);
  }

  /**
   * 데이터 삭제 버튼 클릭
   */
  async clickClearData() {
    await this.clearDataButton.click();
  }

  /**
   * 데이터 삭제 확인
   */
  async confirmClearData() {
    await this.clearDataConfirmButton.click();
  }

  /**
   * 데이터 삭제 취소
   */
  async cancelClearData() {
    await this.clearDataCancelButton.click();
  }

  /**
   * 저장 버튼 클릭
   */
  async clickSave() {
    await this.saveButton.click();
  }

  /**
   * 초기화 버튼 클릭
   */
  async clickReset() {
    await this.resetButton.click();
  }

  /**
   * AI 엔진 섹션이 표시되는지 확인
   */
  async isEngineSectionVisible(): Promise<boolean> {
    return await this.engineSection.isVisible();
  }

  /**
   * OCR 섹션이 표시되는지 확인
   */
  async isOcrSectionVisible(): Promise<boolean> {
    return await this.ocrSection.isVisible();
  }

  /**
   * 데이터 관리 섹션이 표시되는지 확인
   */
  async isDataSectionVisible(): Promise<boolean> {
    return await this.dataSection.isVisible();
  }

  /**
   * 데이터 삭제 모달이 열려있는지 확인
   */
  async isClearDataModalOpen(): Promise<boolean> {
    return await this.clearDataModal.isVisible();
  }

  /**
   * Toast 메시지가 표시되는지 확인
   */
  async isToastVisible(): Promise<boolean> {
    return await this.toast.isVisible();
  }

  /**
   * Toast 메시지 내용 조회
   */
  async getToastMessage(): Promise<string> {
    const text = await this.toast.textContent();
    return text?.trim() ?? '';
  }

  /**
   * 현재 선택된 엔진 모델 조회
   */
  async getSelectedEngineModel(): Promise<string> {
    return await this.engineModelSelect.inputValue();
  }

  /**
   * 현재 엔진 URL 조회
   */
  async getEngineUrl(): Promise<string> {
    return await this.engineUrlInput.inputValue();
  }
}
