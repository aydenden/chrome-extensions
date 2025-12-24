/**
 * 앱 기본 동작 E2E 테스트
 */
import { test, expect } from './fixtures/extension.fixture';

test.describe('앱 기본 동작', () => {
  test('Extension 연결 시 회사 목록 페이지가 표시된다', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');

    // 페이지 제목 확인
    await expect(page.getByRole('heading', { name: /회사 목록/ })).toBeVisible();
  });

  test('설정 링크가 표시된다', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: /설정/ })).toBeVisible();
  });

  test('설정 링크 클릭 시 설정 페이지로 이동한다', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: /설정/ }).click();
    await expect(page).toHaveURL(/\/settings/);
  });
});
