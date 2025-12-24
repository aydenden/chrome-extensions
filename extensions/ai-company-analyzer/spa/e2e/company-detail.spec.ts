/**
 * 회사 상세 E2E 테스트
 */
import { test, expect } from './fixtures/extension.fixture';
import { CompanyDetailPage } from './pages/company-detail.page';

test.describe('회사 상세 페이지', () => {
  let companyDetailPage: CompanyDetailPage;

  test.beforeEach(async ({ page }) => {
    companyDetailPage = new CompanyDetailPage(page);
    await companyDetailPage.goto('company-1');
    await companyDetailPage.waitForLoad();
  });

  test.describe('회사 정보 표시', () => {
    test('회사 이름이 표시된다', async () => {
      const name = await companyDetailPage.getCompanyName();
      expect(name).toBe('테스트 회사');
    });

    test('데이터 소스가 표시된다', async () => {
      await expect(companyDetailPage.dataSources).toBeVisible();
    });

    test('존재하지 않는 회사 ID로 접근하면 에러를 처리한다', async ({ page }) => {
      await page.goto('./company/invalid-id');
      await expect(page.getByText(/찾을 수 없습니다/)).toBeVisible();
    });
  });

  test.describe('탭 전환', () => {
    test('이미지 탭과 분석 결과 탭이 표시된다', async () => {
      await expect(companyDetailPage.imagesTab).toBeVisible();
      await expect(companyDetailPage.analysisTab).toBeVisible();
    });

    test('분석 탭 클릭 시 분석 결과 콘텐츠가 표시된다', async ({ page }) => {
      await companyDetailPage.clickAnalysisTab();
      // 분석 결과가 없을 때는 안내 메시지가 표시됨
      await expect(page.getByText(/아직 분석된 결과가 없습니다/)).toBeVisible();
    });

    test('이미지 탭 클릭 시 이미지 목록이 표시된다', async () => {
      await companyDetailPage.clickAnalysisTab();
      await companyDetailPage.clickImagesTab();
      await expect(companyDetailPage.imageCards.first()).toBeVisible();
    });
  });

  test.describe('뒤로가기', () => {
    test('뒤로가기 버튼이 표시된다', async () => {
      await expect(companyDetailPage.backButton).toBeVisible();
    });

    test('뒤로가기 클릭 시 목록 페이지로 이동한다', async ({ page }) => {
      await companyDetailPage.clickBack();
      await expect(page).toHaveURL(/\/ai-company-analyzer\/$/);
    });
  });

  test.describe('AI 분석', () => {
    test('AI 분석 시작 버튼이 표시된다', async () => {
      await expect(companyDetailPage.startAnalysisButton).toBeVisible();
    });

    test('AI 분석 시작 버튼 클릭 시 분석 페이지로 이동한다', async ({ page }) => {
      await companyDetailPage.clickStartAnalysis();
      // Ollama 연결 상태에 따라 다른 페이지로 이동할 수 있음
      await expect(page).toHaveURL(/\/(analysis|ollama-required)\//);
    });
  });

  test.describe('삭제', () => {
    test('삭제 버튼이 표시된다', async () => {
      await expect(companyDetailPage.deleteButton).toBeVisible();
    });

    test('삭제 버튼 클릭 시 확인 모달이 표시된다', async () => {
      await companyDetailPage.clickDelete();
      await expect(companyDetailPage.deleteModal).toBeVisible();
    });

    test('삭제 취소 시 모달이 닫힌다', async () => {
      await companyDetailPage.clickDelete();
      await companyDetailPage.cancelDelete();
      await expect(companyDetailPage.deleteModal).not.toBeVisible();
    });
  });
});
