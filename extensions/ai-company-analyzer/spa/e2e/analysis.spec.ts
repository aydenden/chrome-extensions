/**
 * AI 분석 E2E 테스트
 */
import { test, expect } from './fixtures/extension.fixture';
import { AnalysisPage } from './pages/analysis.page';

test.describe('AI 분석 페이지', () => {
  let analysisPage: AnalysisPage;

  test.beforeEach(async ({ page }) => {
    analysisPage = new AnalysisPage(page);
    await analysisPage.goto('company-1');
    await analysisPage.waitForLoad();
  });

  test.describe('페이지 표시', () => {
    test('페이지 제목이 표시된다', async () => {
      await expect(analysisPage.pageTitle).toBeVisible();
    });

    test('뒤로가기 버튼이 표시된다', async () => {
      await expect(analysisPage.backButton).toBeVisible();
    });

    test('뒤로가기 클릭 시 상세 페이지로 돌아간다', async ({ page }) => {
      await analysisPage.clickBack();
      await expect(page).toHaveURL(/\/company\//);
    });
  });

  test.describe('Ollama 상태', () => {
    test('연결 상태가 표시된다', async () => {
      await expect(analysisPage.engineStatus).toBeVisible();
    });

    test('모델 이름이 표시된다', async () => {
      await expect(analysisPage.engineName).toBeVisible();
    });
  });

  test.describe('분석 대상 이미지', () => {
    test('이미지 목록이 표시된다', async () => {
      await expect(analysisPage.imageList).toBeVisible();
    });

    test('이미지 항목들이 표시된다', async ({ page }) => {
      // 분석 대상 헤딩에 이미지 개수가 표시됨
      await expect(page.getByRole('heading', { name: /분석 대상 \(\d+개\)/ })).toBeVisible();
    });
  });

  test.describe('분석 시작', () => {
    test('분석 시작 버튼이 표시된다', async () => {
      await expect(analysisPage.startButton).toBeVisible();
    });

    test('진행률 표시가 있다', async () => {
      await expect(analysisPage.progressBar).toBeVisible();
    });
  });
});
