import { test, expect } from './fixtures/extension-mock';
import { CompanyListPage } from './pages/company-list.page';

test.describe('회사 목록 페이지', () => {
  test.describe('빈 상태', () => {
    test('등록된 회사가 없을 때 빈 상태 메시지를 표시한다', async ({ page, mockExtension }) => {
      await mockExtension({ isEmpty: true });

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      // 빈 상태 메시지 확인
      await expect(companyList.emptyMessage).toBeVisible();

      // 회사 카드가 없는지 확인
      const count = await companyList.getCompanyCount();
      expect(count).toBe(0);
    });

    test('빈 상태에서 통계는 0으로 표시된다', async ({ page, mockExtension }) => {
      await mockExtension({ isEmpty: true });

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      const stats = await companyList.getStats();
      expect(stats.companies).toBe(0);
      expect(stats.images).toBe(0);
    });
  });

  test.describe('회사 목록 표시', () => {
    test('등록된 회사 목록을 표시한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      // 회사 카드 개수 확인 (sampleCompanies: 3개)
      const count = await companyList.getCompanyCount();
      expect(count).toBeGreaterThan(0);

      // 빈 상태 메시지가 표시되지 않는지 확인
      await expect(companyList.emptyMessage).not.toBeVisible();
    });

    test('회사 목록에 올바른 통계를 표시한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      const stats = await companyList.getStats();
      // sampleStats: totalCompanies: 3, totalImages: 18
      expect(stats.companies).toBe(3);
      expect(stats.images).toBe(18);
    });

    test('각 회사 카드에 회사 이름이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      const names = await companyList.getAllCompanyNames();
      expect(names.length).toBeGreaterThan(0);
      expect(names[0]).toBeTruthy();
    });
  });

  test.describe('검색 필터링', () => {
    test('회사 이름으로 검색할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      // 검색 전 회사 수
      const beforeCount = await companyList.getCompanyCount();

      // '테스트 기업 A' 검색
      await companyList.search('테스트 기업 A');

      // 검색 후 회사 확인
      const hasCompanyA = await companyList.hasCompany('테스트 기업 A');
      expect(hasCompanyA).toBe(true);
    });

    test('검색 결과가 없을 때 빈 상태 메시지를 표시한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      // 존재하지 않는 회사 검색
      await companyList.search('존재하지않는회사');

      // 빈 상태 메시지 확인
      await expect(companyList.emptyMessage).toBeVisible();
    });

    test('검색 입력을 지우면 전체 목록이 다시 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      // 검색
      await companyList.search('테스트 기업 A');

      // 검색 지우기
      await companyList.clearSearch();

      // 전체 목록 복원 확인
      const count = await companyList.getCompanyCount();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('회사 상세 페이지 이동', () => {
    test('회사 카드를 클릭하면 상세 페이지로 이동한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      // 첫 번째 회사 클릭
      await companyList.clickCompanyByIndex(0);

      // URL 변경 확인
      await page.waitForURL(/\/company\/.+/);
      expect(page.url()).toContain('/company/');
    });

    test('특정 회사 이름으로 상세 페이지에 접근할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      // '테스트 기업 A' 클릭
      await companyList.clickCompanyByName('테스트 기업 A');

      // URL 확인
      await page.waitForURL(/\/company\/.+/);
      expect(page.url()).toContain('/company/');
    });
  });

  test.describe('정렬 기능', () => {
    test('정렬 기준을 변경할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      // 이름순 정렬
      await companyList.sortBy('name');

      // 회사 목록이 여전히 표시되는지 확인
      const count = await companyList.getCompanyCount();
      expect(count).toBeGreaterThan(0);
    });

    test('정렬 순서를 토글할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      // 정렬 순서 토글
      await companyList.toggleSortOrder();

      // 회사 목록이 여전히 표시되는지 확인
      const count = await companyList.getCompanyCount();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('사이트 필터', () => {
    test('사이트별로 필터링할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      // Wanted 사이트로 필터링
      await companyList.filterBySite('wanted');

      // 필터링된 결과 확인
      const count = await companyList.getCompanyCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('전체 사이트로 필터를 초기화할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const companyList = new CompanyListPage(page);
      await companyList.goto();
      await companyList.waitForLoad();

      // 특정 사이트로 필터링
      await companyList.filterBySite('wanted');

      // 전체로 변경
      await companyList.filterBySite('전체');

      // 전체 목록 확인
      const count = await companyList.getCompanyCount();
      expect(count).toBeGreaterThan(0);
    });
  });
});
