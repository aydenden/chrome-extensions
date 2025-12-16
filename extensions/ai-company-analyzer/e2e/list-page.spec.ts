/**
 * 회사 목록 페이지 E2E 테스트
 */

import { test, expect, getListPageUrl, clearDatabase } from './fixtures';

test.describe('ListPage', () => {
  test.beforeEach(async ({ extensionContext, extensionId }) => {
    // 테스트 전 DB 초기화
    await clearDatabase(extensionContext, extensionId);
  });

  test('페이지가 정상적으로 로드된다', async ({ page, extensionId }) => {
    await page.goto(getListPageUrl(extensionId));

    // 헤더 확인 (실제 텍스트: "저장된 회사 목록")
    await expect(page.locator('h1')).toHaveText('저장된 회사 목록');
  });

  test('빈 상태에서 안내 메시지가 표시된다', async ({ page, extensionId }) => {
    await page.goto(getListPageUrl(extensionId));

    // 빈 상태 메시지 확인
    const emptyState = page.locator('.empty-state');
    await expect(emptyState).toBeVisible();
  });

  test('검색창이 표시된다', async ({ page, extensionId }) => {
    await page.goto(getListPageUrl(extensionId));

    const searchInput = page.locator('input[type="search"], input[placeholder*="검색"]');
    await expect(searchInput).toBeVisible();
  });

  test('정렬 드롭다운이 표시된다', async ({ page, extensionId }) => {
    await page.goto(getListPageUrl(extensionId));

    const sortSelect = page.locator('select');
    await expect(sortSelect).toBeVisible();
  });

  test('정렬 옵션이 3가지 존재한다', async ({ page, extensionId }) => {
    await page.goto(getListPageUrl(extensionId));

    const sortSelect = page.locator('select');
    const options = sortSelect.locator('option');

    // 최근순, 이름순, 점수순
    await expect(options).toHaveCount(3);
  });
});

test.describe('ListPage with Data', () => {
  // 데이터가 있는 상태에서의 테스트
  // 실제 이미지 저장 후 테스트하려면 AI 파이프라인 테스트와 통합 필요

  test.skip('회사 카드가 표시된다', async ({ page, extensionId }) => {
    await page.goto(getListPageUrl(extensionId));

    // 회사 카드 확인
    const companyCards = page.locator('.company-card');
    await expect(companyCards.first()).toBeVisible();
  });

  test.skip('검색 필터가 동작한다', async ({ page, extensionId }) => {
    await page.goto(getListPageUrl(extensionId));

    const searchInput = page.locator('input[type="search"], input[placeholder*="검색"]');
    await searchInput.fill('테스트');

    // 필터링된 결과 확인
    // ...
  });

  test.skip('삭제 버튼이 동작한다', async ({ page, extensionId }) => {
    await page.goto(getListPageUrl(extensionId));

    // 삭제 버튼 클릭
    const deleteBtn = page.locator('.company-card .delete-btn').first();
    await deleteBtn.click();

    // confirm 다이얼로그 처리
    page.on('dialog', dialog => dialog.accept());

    // 삭제 확인
    // ...
  });
});
