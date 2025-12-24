/**
 * 회사 목록 E2E 테스트
 */
import { test, expect } from './fixtures/extension.fixture';
import { CompanyListPage } from './pages/company-list.page';

test.describe('회사 목록', () => {
  let companyListPage: CompanyListPage;

  test.beforeEach(async ({ page }) => {
    companyListPage = new CompanyListPage(page);
    await companyListPage.goto();
    await companyListPage.waitForLoad();
  });

  test.describe('목록 표시', () => {
    test('회사 목록이 표시된다', async ({ page }) => {
      // Mock 데이터에 2개 회사가 있음
      await expect(page.getByText('테스트 회사')).toBeVisible();
      await expect(page.getByText('샘플 기업')).toBeVisible();
    });

    test('데이터 소스가 표시된다', async ({ page }) => {
      // 회사 카드 내에 데이터 소스 배지가 표시됨 (필터 드롭다운 제외)
      const companyCard = page.locator('main').getByText('테스트 회사').locator('..');
      await expect(companyCard.getByText('wanted')).toBeVisible();
    });
  });

  test.describe('검색', () => {
    test('검색창이 표시된다', async () => {
      await expect(companyListPage.searchInput).toBeVisible();
    });

    test('검색어 입력 시 목록이 필터링된다', async ({ page }) => {
      await companyListPage.search('테스트');

      // 필터링 결과 확인
      await expect(page.getByText('테스트 회사')).toBeVisible();
    });
  });

  test.describe('네비게이션', () => {
    test('회사 카드 클릭 시 상세 페이지로 이동한다', async ({ page }) => {
      await page.getByText('테스트 회사').click();

      await expect(page).toHaveURL(/\/company\//);
    });
  });
});
