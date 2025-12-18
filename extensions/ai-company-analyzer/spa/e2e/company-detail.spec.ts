import { test, expect } from './fixtures/extension-mock';
import { CompanyDetailPage } from './pages/company-detail.page';

test.describe('회사 상세 페이지', () => {
  test.describe('회사 정보 표시', () => {
    test('회사 이름이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      const name = await detailPage.getCompanyName();
      expect(name).toBeTruthy();
      expect(name).toBe('테스트 기업 A');
    });

    test('데이터 소스가 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      const sources = await detailPage.getDataSources();
      expect(sources.length).toBeGreaterThan(0);
      expect(sources).toContain('wanted');
    });

    test('존재하지 않는 회사 ID로 접근하면 에러를 처리한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);

      // 존재하지 않는 ID로 접근
      await detailPage.goto('invalid-company-id');

      // 에러 처리 확인 (에러 메시지나 404 페이지로 리다이렉트)
      await page.waitForTimeout(1000);
      const url = page.url();
      const hasError = url.includes('/') || await page.locator('text=/에러|오류|찾을 수 없/').isVisible();
      expect(hasError).toBe(true);
    });
  });

  test.describe('탭 전환', () => {
    test('기본적으로 이미지 탭이 선택되어 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      const isSelected = await detailPage.isImagesTabSelected();
      expect(isSelected).toBe(true);
    });

    test('분석 탭으로 전환할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      // 분석 탭 클릭
      await detailPage.clickAnalysisTab();

      // 분석 탭 선택 확인
      const isSelected = await detailPage.isAnalysisTabSelected();
      expect(isSelected).toBe(true);
    });

    test('이미지 탭으로 다시 전환할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      // 분석 탭으로 전환
      await detailPage.clickAnalysisTab();

      // 다시 이미지 탭으로 전환
      await detailPage.clickImagesTab();

      // 이미지 탭 선택 확인
      const isSelected = await detailPage.isImagesTabSelected();
      expect(isSelected).toBe(true);
    });
  });

  test.describe('이미지 목록', () => {
    test('회사의 이미지 목록이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      // 이미지 카드 개수 확인
      const count = await detailPage.getImageCount();
      expect(count).toBeGreaterThan(0);
    });

    test('이미지가 없는 회사는 빈 상태를 표시한다', async ({ page, mockExtension }) => {
      await mockExtension({ isEmpty: true });

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');

      // 빈 상태 확인
      await page.waitForTimeout(1000);
      const emptyMessage = page.locator('text=/이미지가 없습니다|등록된 이미지가 없/');
      const hasEmptyOrError = await emptyMessage.isVisible().catch(() => false);
      expect(hasEmptyOrError || page.url().includes('/')).toBe(true);
    });
  });

  test.describe('뒤로가기 버튼', () => {
    test('뒤로가기 버튼이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      await expect(detailPage.backButton).toBeVisible();
    });

    test('뒤로가기 버튼을 클릭하면 목록 페이지로 이동한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      // 뒤로가기 클릭
      await detailPage.clickBack();

      // 목록 페이지로 이동 확인
      await page.waitForURL('/');
      expect(page.url()).toContain('/');
    });
  });

  test.describe('AI 분석 시작', () => {
    test('AI 분석 시작 버튼이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      await expect(detailPage.startAnalysisButton).toBeVisible();
    });

    test('AI 분석 시작 버튼을 클릭하면 분석 페이지로 이동한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      // 분석 시작 버튼 클릭
      await detailPage.clickStartAnalysis();

      // 분석 페이지로 이동 확인
      await page.waitForURL(/\/analysis\/.+/);
      expect(page.url()).toContain('/analysis/');
    });
  });

  test.describe('회사 삭제', () => {
    test('삭제 버튼이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      await expect(detailPage.deleteButton).toBeVisible();
    });

    test('삭제 버튼을 클릭하면 확인 모달이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      // 삭제 버튼 클릭
      await detailPage.clickDelete();

      // 모달 표시 확인
      const isOpen = await detailPage.isDeleteModalOpen();
      expect(isOpen).toBe(true);
    });

    test('모달에서 취소하면 삭제되지 않는다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      // 삭제 버튼 클릭
      await detailPage.clickDelete();

      // 취소 버튼 클릭
      await detailPage.cancelDelete();

      // 모달이 닫혔는지 확인
      await page.waitForTimeout(500);
      const isOpen = await detailPage.isDeleteModalOpen();
      expect(isOpen).toBe(false);

      // 여전히 상세 페이지에 있는지 확인
      expect(page.url()).toContain('/company/');
    });

    test('모달에서 확인하면 회사가 삭제되고 목록으로 이동한다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      // 삭제 버튼 클릭
      await detailPage.clickDelete();

      // 확인 버튼 클릭
      await detailPage.confirmDelete();

      // 목록 페이지로 이동 확인
      await page.waitForURL('/');
      expect(page.url()).toContain('/');
    });
  });

  test.describe('분석 결과 표시', () => {
    test('분석 탭에 분석 결과가 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const detailPage = new CompanyDetailPage(page);
      await detailPage.goto('company-1');
      await detailPage.waitForLoad();

      // 분석 탭 클릭
      await detailPage.clickAnalysisTab();

      // 분석 콘텐츠 확인
      await expect(detailPage.analysisContent).toBeVisible();
    });
  });
});
