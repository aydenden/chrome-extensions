/**
 * 설정 페이지 E2E 테스트
 */
import { test, expect } from './fixtures/extension.fixture';
import { SettingsPage } from './pages/settings.page';

test.describe('설정 페이지', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.waitForLoad();
  });

  test.describe('페이지 표시', () => {
    test('페이지 제목이 표시된다', async () => {
      await expect(settingsPage.pageTitle).toBeVisible();
    });

    test('뒤로가기 버튼이 표시된다', async () => {
      await expect(settingsPage.backButton).toBeVisible();
    });
  });

  test.describe('Ollama 설정', () => {
    test('엔드포인트 입력란이 표시된다', async () => {
      await expect(settingsPage.endpointInput).toBeVisible();
    });

    test('엔드포인트를 변경할 수 있다', async () => {
      await settingsPage.setEndpoint('http://localhost:12345');
      const value = await settingsPage.getEndpoint();
      expect(value).toBe('http://localhost:12345');
    });
  });

  test.describe('데이터 관리', () => {
    test('전체 삭제 버튼이 표시된다', async () => {
      await expect(settingsPage.deleteAllButton).toBeVisible();
    });

    test('전체 삭제 클릭 시 확인 모달이 표시된다', async ({ page }) => {
      await settingsPage.clickDeleteAll();
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });
});
