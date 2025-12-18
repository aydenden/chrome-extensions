import { type Page, type Locator } from '@playwright/test';

/**
 * CompanyDetail 페이지 Page Object
 */
export class CompanyDetailPage {
  readonly page: Page;

  // Locators
  readonly pageTitle: Locator;
  readonly backButton: Locator;
  readonly deleteButton: Locator;
  readonly startAnalysisButton: Locator;

  // Tabs
  readonly imagesTab: Locator;
  readonly analysisTab: Locator;

  // Company Info
  readonly companyName: Locator;
  readonly dataSources: Locator;

  // Images Tab
  readonly imageCards: Locator;

  // Analysis Tab
  readonly analysisContent: Locator;

  // Modals
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.backButton = page.getByRole('button', { name: /뒤로/ });
    this.deleteButton = page.getByRole('button', { name: /삭제/ });
    this.startAnalysisButton = page.getByRole('button', { name: /분석 시작/ });

    // Tabs
    this.imagesTab = page.getByRole('tab', { name: /이미지/ });
    this.analysisTab = page.getByRole('tab', { name: /분석/ });

    // Company Info
    this.companyName = page.locator('[data-testid="company-name"]');
    this.dataSources = page.locator('[data-testid="data-sources"]');

    // Content
    this.imageCards = page.locator('[data-testid="image-card"]');
    this.analysisContent = page.locator('[data-testid="analysis-content"]');

    // Modals
    this.deleteModal = page.getByRole('dialog', { name: /삭제/ });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: '삭제' });
    this.deleteCancelButton = this.deleteModal.getByRole('button', { name: '취소' });
  }

  /**
   * 페이지로 이동
   */
  async goto(companyId: string) {
    await this.page.goto(`/company/${companyId}`);
  }

  /**
   * 페이지가 로드될 때까지 대기
   */
  async waitForLoad() {
    await this.companyName.waitFor({ state: 'visible' });
  }

  /**
   * 뒤로가기 버튼 클릭
   */
  async clickBack() {
    await this.backButton.click();
  }

  /**
   * 삭제 버튼 클릭
   */
  async clickDelete() {
    await this.deleteButton.click();
  }

  /**
   * 분석 시작 버튼 클릭
   */
  async clickStartAnalysis() {
    await this.startAnalysisButton.click();
  }

  /**
   * 이미지 탭 클릭
   */
  async clickImagesTab() {
    await this.imagesTab.click();
  }

  /**
   * 분석 탭 클릭
   */
  async clickAnalysisTab() {
    await this.analysisTab.click();
  }

  /**
   * 삭제 확인
   */
  async confirmDelete() {
    await this.deleteConfirmButton.click();
  }

  /**
   * 삭제 취소
   */
  async cancelDelete() {
    await this.deleteCancelButton.click();
  }

  /**
   * 회사 이름 조회
   */
  async getCompanyName(): Promise<string> {
    const text = await this.companyName.textContent();
    return text?.trim() ?? '';
  }

  /**
   * 데이터 소스 조회
   */
  async getDataSources(): Promise<string[]> {
    const text = await this.dataSources.textContent();
    if (!text) return [];

    return text.split(',').map(s => s.trim());
  }

  /**
   * 이미지 카드 개수 조회
   */
  async getImageCount(): Promise<number> {
    return await this.imageCards.count();
  }

  /**
   * 삭제 모달이 열려있는지 확인
   */
  async isDeleteModalOpen(): Promise<boolean> {
    return await this.deleteModal.isVisible();
  }

  /**
   * 이미지 탭이 선택되어 있는지 확인
   */
  async isImagesTabSelected(): Promise<boolean> {
    const isSelected = await this.imagesTab.getAttribute('aria-selected');
    return isSelected === 'true';
  }

  /**
   * 분석 탭이 선택되어 있는지 확인
   */
  async isAnalysisTabSelected(): Promise<boolean> {
    const isSelected = await this.analysisTab.getAttribute('aria-selected');
    return isSelected === 'true';
  }
}
