import { type Page, type Locator } from '@playwright/test';
import type { DataType } from '@shared/constants';

/**
 * CompanyList 페이지 Page Object
 */
export class CompanyListPage {
  readonly page: Page;

  // Locators
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;
  readonly searchInput: Locator;
  readonly siteFilter: Locator;
  readonly sortBySelect: Locator;
  readonly sortOrderButton: Locator;
  readonly companyCards: Locator;
  readonly emptyMessage: Locator;
  readonly loadingSpinner: Locator;
  readonly errorMessage: Locator;
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // 페이지 헤더
    this.pageTitle = page.getByRole('heading', { name: '회사 목록' });
    this.pageSubtitle = page.locator('.text-ink-muted').first();

    // 필터 컨트롤
    this.searchInput = page.getByPlaceholder('회사 이름 검색...');
    this.siteFilter = page.getByLabel('사이트 필터');
    this.sortBySelect = page.getByLabel('정렬 기준');
    this.sortOrderButton = page.getByRole('button', { name: /오름차순|내림차순/ });

    // 회사 카드
    this.companyCards = page.locator('[data-testid="company-card"]');

    // 상태 메시지
    this.emptyMessage = page.getByText(/등록된 회사가 없습니다|검색 결과가 없습니다/);
    this.loadingSpinner = page.locator('[data-testid="spinner"]');
    this.errorMessage = page.getByText(/데이터를 불러오는데 실패했습니다/);

    // 삭제 모달
    this.deleteModal = page.getByRole('dialog', { name: '회사 삭제' });
    this.deleteConfirmButton = page.getByRole('button', { name: '삭제' });
    this.deleteCancelButton = page.getByRole('button', { name: '취소' });
  }

  /**
   * 페이지로 이동
   */
  async goto() {
    await this.page.goto('/');
  }

  /**
   * 페이지가 로드될 때까지 대기
   */
  async waitForLoad() {
    // 로딩 스피너가 사라질 때까지 대기
    await this.page.waitForSelector('[data-testid="spinner"]', { state: 'detached', timeout: 5000 })
      .catch(() => {
        // 스피너가 없으면 이미 로드된 것으로 간주
      });

    // 페이지 타이틀이 표시될 때까지 대기
    await this.pageTitle.waitFor({ state: 'visible' });
  }

  /**
   * 회사 검색
   */
  async search(query: string) {
    await this.searchInput.fill(query);
    // 디바운스 대기 (필요시)
    await this.page.waitForTimeout(300);
  }

  /**
   * 검색 입력 지우기
   */
  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(300);
  }

  /**
   * 사이트 필터 선택
   */
  async filterBySite(siteType: DataType | '전체') {
    await this.siteFilter.selectOption(siteType === '전체' ? '' : siteType);
    await this.page.waitForTimeout(300);
  }

  /**
   * 정렬 기준 선택
   */
  async sortBy(sortBy: 'name' | 'createdAt' | 'updatedAt') {
    await this.sortBySelect.selectOption(sortBy);
    await this.page.waitForTimeout(300);
  }

  /**
   * 정렬 순서 토글
   */
  async toggleSortOrder() {
    await this.sortOrderButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * 회사 카드 클릭 (이름으로)
   */
  async clickCompanyByName(companyName: string) {
    const card = this.page.locator(`[data-testid="company-card"]:has-text("${companyName}")`);
    await card.click();
  }

  /**
   * 회사 카드 클릭 (인덱스로)
   */
  async clickCompanyByIndex(index: number) {
    const card = this.companyCards.nth(index);
    await card.click();
  }

  /**
   * 회사 삭제 버튼 클릭
   */
  async clickDeleteButton(companyName: string) {
    const card = this.page.locator(`[data-testid="company-card"]:has-text("${companyName}")`);
    const deleteButton = card.getByRole('button', { name: /삭제/ });
    await deleteButton.click();
  }

  /**
   * 삭제 모달에서 확인 버튼 클릭
   */
  async confirmDelete() {
    await this.deleteConfirmButton.click();
  }

  /**
   * 삭제 모달에서 취소 버튼 클릭
   */
  async cancelDelete() {
    await this.deleteCancelButton.click();
  }

  /**
   * 회사 카드 개수 조회
   */
  async getCompanyCount(): Promise<number> {
    return await this.companyCards.count();
  }

  /**
   * 특정 회사가 표시되는지 확인
   */
  async hasCompany(companyName: string): Promise<boolean> {
    const card = this.page.locator(`[data-testid="company-card"]:has-text("${companyName}")`);
    return await card.isVisible();
  }

  /**
   * 빈 상태 메시지가 표시되는지 확인
   */
  async isEmptyMessageVisible(): Promise<boolean> {
    return await this.emptyMessage.isVisible();
  }

  /**
   * 로딩 스피너가 표시되는지 확인
   */
  async isLoadingSpinnerVisible(): Promise<boolean> {
    return await this.loadingSpinner.isVisible();
  }

  /**
   * 에러 메시지가 표시되는지 확인
   */
  async isErrorMessageVisible(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * 삭제 모달이 열려있는지 확인
   */
  async isDeleteModalOpen(): Promise<boolean> {
    return await this.deleteModal.isVisible();
  }

  /**
   * 서브타이틀에서 회사 수와 이미지 수 추출
   */
  async getStats(): Promise<{ companies: number; images: number }> {
    const text = await this.pageSubtitle.textContent();
    const match = text?.match(/전체 (\d+)개 회사, (\d+)개 이미지/);

    if (!match) {
      return { companies: 0, images: 0 };
    }

    return {
      companies: parseInt(match[1], 10),
      images: parseInt(match[2], 10),
    };
  }

  /**
   * 모든 회사 이름 조회
   */
  async getAllCompanyNames(): Promise<string[]> {
    const cards = await this.companyCards.all();
    const names: string[] = [];

    for (const card of cards) {
      const nameElement = card.locator('[data-testid="company-name"]');
      const name = await nameElement.textContent();
      if (name) {
        names.push(name.trim());
      }
    }

    return names;
  }
}
