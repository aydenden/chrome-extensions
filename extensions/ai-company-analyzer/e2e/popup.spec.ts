/**
 * Popup UI E2E 테스트
 */

import { test, expect, getPopupUrl } from './fixtures';

test.describe('Popup', () => {
  test('페이지가 정상적으로 로드된다', async ({ page, extensionId }) => {
    await page.goto(getPopupUrl(extensionId));

    // 헤더 확인
    await expect(page.locator('h1')).toHaveText('AI 기업분석');
  });

  test('저장된 회사 수가 표시된다', async ({ page, extensionId }) => {
    await page.goto(getPopupUrl(extensionId));

    // 통계 섹션 확인
    const statValue = page.locator('.stat-value');
    await expect(statValue).toBeVisible();
    await expect(statValue).toContainText('개');
  });

  test('이미지 캡처 버튼이 표시된다', async ({ page, extensionId }) => {
    await page.goto(getPopupUrl(extensionId));

    const captureBtn = page.locator('button:has-text("이미지 캡처")');
    await expect(captureBtn).toBeVisible();
  });

  test('PDF 업로드 버튼이 표시된다', async ({ page, extensionId }) => {
    await page.goto(getPopupUrl(extensionId));

    const pdfBtn = page.locator('button:has-text("PDF 업로드")');
    await expect(pdfBtn).toBeVisible();
  });

  test('PDF 업로드 버튼 클릭 시 업로드 섹션이 토글된다', async ({ page, extensionId }) => {
    await page.goto(getPopupUrl(extensionId));

    const pdfBtn = page.locator('button:has-text("PDF 업로드")');
    const uploadSection = page.locator('.pdf-upload-section');

    // 초기 상태: 숨김
    await expect(uploadSection).not.toBeVisible();

    // 클릭 후: 표시
    await pdfBtn.click();
    await expect(uploadSection).toBeVisible();

    // 다시 클릭: 숨김
    await pdfBtn.click();
    await expect(uploadSection).not.toBeVisible();
  });

  test('회사 목록 보기 링크가 표시된다', async ({ page, extensionId }) => {
    await page.goto(getPopupUrl(extensionId));

    const listLink = page.locator('button:has-text("회사 목록 보기")');
    await expect(listLink).toBeVisible();
  });

  test('설정 링크가 표시된다', async ({ page, extensionId }) => {
    await page.goto(getPopupUrl(extensionId));

    const settingsLink = page.locator('button:has-text("설정")');
    await expect(settingsLink).toBeVisible();
  });

  test('미지원 사이트에서는 이미지 캡처 버튼이 비활성화된다', async ({ page, extensionId }) => {
    await page.goto(getPopupUrl(extensionId));

    // Popup 페이지 자체는 미지원 사이트로 감지됨
    const captureBtn = page.locator('button:has-text("이미지 캡처")');
    await expect(captureBtn).toBeDisabled();

    // 미지원 사이트 배지 확인
    const unsupportedBadge = page.locator('.site-badge.unsupported');
    await expect(unsupportedBadge).toBeVisible();
  });
});
