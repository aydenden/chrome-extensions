import { type Page, type Locator } from '@playwright/test';

/**
 * Analysis 페이지 Page Object
 */
export class AnalysisPage {
  readonly page: Page;

  // Locators
  readonly pageTitle: Locator;
  readonly backButton: Locator;
  readonly startButton: Locator;

  // AI Engine Status
  readonly engineStatus: Locator;
  readonly engineName: Locator;
  readonly engineUrl: Locator;

  // Image List
  readonly imageList: Locator;
  readonly imageItems: Locator;

  // Progress
  readonly progressBar: Locator;
  readonly progressText: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.pageTitle = page.getByRole('heading', { name: /AI 분석/ });
    this.backButton = page.getByRole('button', { name: /뒤로/ });
    this.startButton = page.getByRole('button', { name: /분석 시작/ });

    // AI Engine
    this.engineStatus = page.locator('[data-testid="engine-status"]');
    this.engineName = page.locator('[data-testid="engine-name"]');
    this.engineUrl = page.locator('[data-testid="engine-url"]');

    // Images
    this.imageList = page.locator('[data-testid="image-list"]');
    this.imageItems = page.locator('[data-testid="image-item"]');

    // Progress
    this.progressBar = page.locator('[data-testid="progress-bar"]');
    this.progressText = page.locator('[data-testid="progress-text"]');
  }

  /**
   * 페이지로 이동
   */
  async goto(companyId: string) {
    await this.page.goto(`/analysis/${companyId}`);
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
   * 분석 시작 버튼 클릭
   */
  async clickStart() {
    await this.startButton.click();
  }

  /**
   * 엔진 상태 조회
   */
  async getEngineStatus(): Promise<string> {
    const text = await this.engineStatus.textContent();
    return text?.trim() ?? '';
  }

  /**
   * 엔진 이름 조회
   */
  async getEngineName(): Promise<string> {
    const text = await this.engineName.textContent();
    return text?.trim() ?? '';
  }

  /**
   * 분석 대상 이미지 개수 조회
   */
  async getImageCount(): Promise<number> {
    return await this.imageItems.count();
  }

  /**
   * 시작 버튼이 활성화되어 있는지 확인
   */
  async isStartButtonEnabled(): Promise<boolean> {
    return await this.startButton.isEnabled();
  }

  /**
   * 진행률 텍스트 조회
   */
  async getProgressText(): Promise<string> {
    const text = await this.progressText.textContent();
    return text?.trim() ?? '';
  }
}
