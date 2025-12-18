import { type Page, type Locator } from '@playwright/test';

/**
 * Navigation Page Object (공통 네비게이션 요소)
 */
export class NavigationPage {
  readonly page: Page;

  // Locators
  readonly logo: Locator;
  readonly settingsLink: Locator;
  readonly notFoundPage: Locator;
  readonly backToHomeButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.logo = page.getByRole('link', { name: /AI 기업분석|로고/ });
    this.settingsLink = page.getByRole('link', { name: /설정/ });

    // 404 Page
    this.notFoundPage = page.locator('[data-testid="not-found"]');
    this.backToHomeButton = page.getByRole('link', { name: /홈으로|돌아가기/ });
  }

  /**
   * 로고 클릭 (홈으로 이동)
   */
  async clickLogo() {
    await this.logo.click();
  }

  /**
   * 설정 링크 클릭
   */
  async clickSettings() {
    await this.settingsLink.click();
  }

  /**
   * 404 페이지로 이동
   */
  async gotoNotFound() {
    await this.page.goto('/invalid-page-url');
  }

  /**
   * 홈으로 돌아가기 버튼 클릭 (404 페이지에서)
   */
  async clickBackToHome() {
    await this.backToHomeButton.click();
  }

  /**
   * 브라우저 뒤로가기
   */
  async goBack() {
    await this.page.goBack();
  }

  /**
   * 브라우저 앞으로가기
   */
  async goForward() {
    await this.page.goForward();
  }

  /**
   * 현재 URL 조회
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * 404 페이지가 표시되는지 확인
   */
  async isNotFoundPageVisible(): Promise<boolean> {
    return await this.notFoundPage.isVisible();
  }

  /**
   * 특정 경로에 있는지 확인
   */
  isAtPath(path: string): boolean {
    const url = new URL(this.getCurrentUrl());
    return url.pathname.endsWith(path);
  }
}
