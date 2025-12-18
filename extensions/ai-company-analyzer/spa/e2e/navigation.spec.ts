import { test, expect } from './fixtures/extension-mock';
import { NavigationPage } from './pages/navigation.page';
import { CompanyListPage } from './pages/company-list.page';
import { CompanyDetailPage } from './pages/company-detail.page';
import { SettingsPage } from './pages/settings.page';

test.describe('네비게이션', () => {
  test.describe('로고 클릭', () => {
    test('로고가 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      await page.goto('/');

      const navigation = new NavigationPage(page);
      await expect(navigation.logo).toBeVisible();
    });

    test('로고를 클릭하면 홈으로 이동한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);
      const settingsPage = new SettingsPage(page);

      // 설정 페이지로 이동
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // 로고 클릭
      await navigation.clickLogo();

      // 홈으로 이동 확인
      await page.waitForURL('/');
      expect(navigation.isAtPath('/')).toBe(true);
    });

    test('상세 페이지에서 로고를 클릭하면 홈으로 이동한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);
      const detailPage = new CompanyDetailPage(page);

      // 상세 페이지로 이동
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      // 로고 클릭
      await navigation.clickLogo();

      // 홈으로 이동 확인
      await page.waitForURL('/');
      expect(navigation.isAtPath('/')).toBe(true);
    });
  });

  test.describe('404 페이지', () => {
    test('존재하지 않는 경로로 접근하면 404 페이지가 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);

      // 잘못된 경로로 이동
      await navigation.gotoNotFound();

      // 404 페이지 확인
      const isVisible = await navigation.isNotFoundPageVisible();
      expect(isVisible).toBe(true);
    });

    test('404 페이지에 홈으로 돌아가기 버튼이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);

      // 404 페이지로 이동
      await navigation.gotoNotFound();

      // 홈으로 돌아가기 버튼 확인
      await expect(navigation.backToHomeButton).toBeVisible();
    });

    test('404 페이지에서 홈으로 돌아갈 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);

      // 404 페이지로 이동
      await navigation.gotoNotFound();

      // 홈으로 돌아가기 버튼 클릭
      await navigation.clickBackToHome();

      // 홈으로 이동 확인
      await page.waitForURL('/');
      expect(navigation.isAtPath('/')).toBe(true);
    });
  });

  test.describe('브라우저 뒤로가기/앞으로가기', () => {
    test('브라우저 뒤로가기로 이전 페이지로 이동한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);
      const companyList = new CompanyListPage(page);
      const detailPage = new CompanyDetailPage(page);

      // 홈에서 시작
      await companyList.goto();
      await companyList.waitForLoad();

      // 상세 페이지로 이동
      await companyList.clickCompanyByIndex(0);
      await page.waitForURL(/\/company\/.+/);

      // 브라우저 뒤로가기
      await navigation.goBack();

      // 홈으로 돌아왔는지 확인
      await page.waitForURL('/');
      expect(navigation.isAtPath('/')).toBe(true);
    });

    test('브라우저 앞으로가기로 다음 페이지로 이동한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);
      const companyList = new CompanyListPage(page);

      // 홈에서 시작
      await companyList.goto();
      await companyList.waitForLoad();

      // 상세 페이지로 이동
      await companyList.clickCompanyByIndex(0);
      await page.waitForURL(/\/company\/.+/);

      // 브라우저 뒤로가기
      await navigation.goBack();
      await page.waitForURL('/');

      // 브라우저 앞으로가기
      await navigation.goForward();

      // 다시 상세 페이지로 이동했는지 확인
      await page.waitForURL(/\/company\/.+/);
      expect(page.url()).toContain('/company/');
    });

    test('여러 페이지를 거쳐 뒤로가기를 할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);
      const companyList = new CompanyListPage(page);
      const settingsPage = new SettingsPage(page);

      // 홈 -> 설정 -> 홈 순서로 이동
      await companyList.goto();
      await companyList.waitForLoad();

      await navigation.clickSettings();
      await page.waitForURL(/\/settings/);

      await navigation.clickLogo();
      await page.waitForURL('/');

      // 뒤로가기 (설정으로)
      await navigation.goBack();
      await page.waitForURL(/\/settings/);
      expect(page.url()).toContain('/settings');

      // 다시 뒤로가기 (홈으로)
      await navigation.goBack();
      await page.waitForURL('/');
      expect(navigation.isAtPath('/')).toBe(true);
    });
  });

  test.describe('설정 페이지 접근', () => {
    test('설정 링크가 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      await page.goto('/');

      const navigation = new NavigationPage(page);
      await expect(navigation.settingsLink).toBeVisible();
    });

    test('설정 링크를 클릭하면 설정 페이지로 이동한다', async ({ page, mockExtension }) => {
      await mockExtension();

      await page.goto('/');

      const navigation = new NavigationPage(page);

      // 설정 링크 클릭
      await navigation.clickSettings();

      // 설정 페이지로 이동 확인
      await page.waitForURL(/\/settings/);
      expect(page.url()).toContain('/settings');
    });
  });

  test.describe('페이지 간 이동 플로우', () => {
    test('홈 -> 상세 -> 분석 -> 상세 -> 홈 플로우가 정상 작동한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);
      const companyList = new CompanyListPage(page);
      const detailPage = new CompanyDetailPage(page);

      // 1. 홈에서 시작
      await companyList.goto();
      await companyList.waitForLoad();
      expect(navigation.isAtPath('/')).toBe(true);

      // 2. 상세 페이지로 이동
      await companyList.clickCompanyByIndex(0);
      await page.waitForURL(/\/company\/.+/);
      expect(page.url()).toContain('/company/');

      // 3. 분석 페이지로 이동
      await detailPage.clickStartAnalysis();
      await page.waitForURL(/\/analysis\/.+/);
      expect(page.url()).toContain('/analysis/');

      // 4. 뒤로가기로 상세 페이지로
      await navigation.goBack();
      await page.waitForURL(/\/company\/.+/);
      expect(page.url()).toContain('/company/');

      // 5. 뒤로가기 버튼으로 홈으로
      await detailPage.clickBack();
      await page.waitForURL('/');
      expect(navigation.isAtPath('/')).toBe(true);
    });

    test('홈 -> 설정 -> 홈 플로우가 정상 작동한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);
      const companyList = new CompanyListPage(page);
      const settingsPage = new SettingsPage(page);

      // 1. 홈에서 시작
      await companyList.goto();
      await companyList.waitForLoad();
      expect(navigation.isAtPath('/')).toBe(true);

      // 2. 설정 페이지로 이동
      await navigation.clickSettings();
      await page.waitForURL(/\/settings/);
      expect(page.url()).toContain('/settings');

      // 3. 뒤로가기 버튼으로 홈으로
      await settingsPage.clickBack();
      await page.waitForURL('/');
      expect(navigation.isAtPath('/')).toBe(true);
    });
  });

  test.describe('URL 직접 접근', () => {
    test('URL로 직접 상세 페이지에 접근할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      expect(page.url()).toContain('/company/company-1');
    });

    test('URL로 직접 설정 페이지에 접근할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      expect(page.url()).toContain('/settings');
    });

    test('잘못된 URL로 접근하면 404 페이지가 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);
      await navigation.gotoNotFound();

      const isVisible = await navigation.isNotFoundPageVisible();
      expect(isVisible).toBe(true);
    });
  });
});
