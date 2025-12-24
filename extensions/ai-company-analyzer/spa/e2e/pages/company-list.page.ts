import { type Page, type Locator } from '@playwright/test';

/**
 * 회사 목록 페이지 Page Object
 */
export class CompanyListPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly searchInput: Locator;
  readonly companyCards: Locator;
  readonly settingsLink: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('[data-testid="company-name"]');
    this.searchInput = page.getByPlaceholder(/검색/);
    this.companyCards = page.locator('.cursor-pointer').filter({ has: page.locator('[data-testid="data-sources"]') });
    this.settingsLink = page.getByRole('link', { name: /설정/ });
    this.emptyState = page.getByText(/등록된 회사가 없습니다/);
  }

  async goto() {
    await this.page.goto('./');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async search(keyword: string) {
    await this.searchInput.fill(keyword);
  }

  async getCompanyCount(): Promise<number> {
    return await this.companyCards.count();
  }

  async clickCompanyCard(index: number) {
    await this.companyCards.nth(index).click();
  }
}
