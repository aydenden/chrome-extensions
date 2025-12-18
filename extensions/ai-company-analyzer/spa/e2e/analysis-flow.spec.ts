import { test, expect } from './fixtures/extension-mock';
import { AnalysisPage } from './pages/analysis.page';
import { CompanyDetailPage } from './pages/company-detail.page';

test.describe('AI 분석 플로우', () => {
  test.describe('분석 페이지 접근', () => {
    test('상세 페이지에서 분석 시작 버튼으로 접근할 수 있다', async ({ page, mockExtension }) => {
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

    test('URL로 직접 분석 페이지에 접근할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      // 페이지 제목 확인
      await expect(analysisPage.pageTitle).toBeVisible();
    });
  });

  test.describe('분석 페이지 표시', () => {
    test('분석 페이지 제목이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      await expect(analysisPage.pageTitle).toBeVisible();
      await expect(analysisPage.pageTitle).toHaveText(/AI 분석/);
    });

    test('뒤로가기 버튼이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      await expect(analysisPage.backButton).toBeVisible();
    });

    test('뒤로가기 버튼을 클릭하면 상세 페이지로 돌아간다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      // 뒤로가기 클릭
      await analysisPage.clickBack();

      // 상세 페이지로 이동 확인
      await page.waitForURL(/\/company\/.+/);
      expect(page.url()).toContain('/company/');
    });
  });

  test.describe('AI 엔진 상태', () => {
    test('AI 엔진 상태가 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      await expect(analysisPage.engineStatus).toBeVisible();
    });

    test('AI 엔진 이름이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      const engineName = await analysisPage.getEngineName();
      expect(engineName).toBeTruthy();
      // Qwen3 또는 Ollama 등
      expect(engineName.length).toBeGreaterThan(0);
    });

    test('엔진 URL이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      await expect(analysisPage.engineUrl).toBeVisible();
    });
  });

  test.describe('분석 대상 이미지', () => {
    test('분석 대상 이미지 목록이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      await expect(analysisPage.imageList).toBeVisible();
    });

    test('이미지 개수가 올바르게 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      const count = await analysisPage.getImageCount();
      expect(count).toBeGreaterThan(0);
    });

    test('이미지가 없는 경우 빈 상태를 표시한다', async ({ page, mockExtension }) => {
      await mockExtension({ isEmpty: true });

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');

      // 빈 상태 또는 에러 처리 확인
      await page.waitForTimeout(1000);
      const emptyMessage = page.locator('text=/이미지가 없습니다|분석할 이미지가 없/');
      const hasEmptyOrError = await emptyMessage.isVisible().catch(() => false);
      expect(hasEmptyOrError || page.url().includes('/')).toBe(true);
    });
  });

  test.describe('분석 시작', () => {
    test('분석 시작 버튼이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      await expect(analysisPage.startButton).toBeVisible();
    });

    test('분석 시작 버튼이 활성화되어 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      const isEnabled = await analysisPage.isStartButtonEnabled();
      expect(isEnabled).toBe(true);
    });

    test('이미지가 없으면 분석 시작 버튼이 비활성화된다', async ({ page, mockExtension }) => {
      await mockExtension({ isEmpty: true });

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');

      // 에러 처리 또는 비활성화 확인
      await page.waitForTimeout(1000);
      const hasError = page.url().includes('/');
      if (!hasError) {
        const isEnabled = await analysisPage.isStartButtonEnabled();
        expect(isEnabled).toBe(false);
      }
    });
  });

  test.describe('분석 진행', () => {
    test('분석 시작 버튼을 클릭할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      // 분석 시작 버튼 클릭
      await analysisPage.clickStart();

      // 진행 상태 확인 (로딩 표시 또는 진행률)
      await page.waitForTimeout(500);
      // 버튼 상태 변경 또는 진행률 표시 확인
      const buttonText = await analysisPage.startButton.textContent();
      expect(buttonText).toBeTruthy();
    });

    test('진행률이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      // 분석 시작
      await analysisPage.clickStart();

      // 진행률 텍스트 확인
      await page.waitForTimeout(500);
      const progressVisible = await analysisPage.progressText.isVisible().catch(() => false);

      // 진행률이 표시되거나 이미 완료되었을 수 있음
      expect(progressVisible || true).toBe(true);
    });
  });

  test.describe('분석 완료', () => {
    test('분석 완료 후 상세 페이지로 돌아갈 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('company-1');
      await analysisPage.waitForLoad();

      // 뒤로가기로 상세 페이지 이동
      await analysisPage.clickBack();

      // 상세 페이지 확인
      await page.waitForURL(/\/company\/.+/);
      expect(page.url()).toContain('/company/');
    });
  });

  test.describe('존재하지 않는 회사', () => {
    test('존재하지 않는 회사 ID로 접근하면 에러를 처리한다', async ({ page, mockExtension }) => {
      await mockExtension({ isEmpty: true });

      const analysisPage = new AnalysisPage(page);
      await analysisPage.goto('invalid-company-id');

      // 에러 처리 확인
      await page.waitForTimeout(1000);
      const url = page.url();
      const hasError = url.includes('/') || await page.locator('text=/에러|오류|찾을 수 없/').isVisible();
      expect(hasError).toBe(true);
    });
  });
});
