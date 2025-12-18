# Feature 42: E2E 핵심 시나리오

## 개요

핵심 사용자 시나리오에 대한 E2E 테스트를 작성합니다.

## 범위

- 회사 목록 시나리오
- 회사 상세 시나리오
- 분석 플로우 시나리오
- 설정 시나리오

## 의존성

- Feature 41: Playwright E2E 환경

## 구현 상세

### spa/e2e/company-list.spec.ts

```typescript
import { test, expect } from './fixtures/extension-mock';
import { sampleData, emptyData } from './fixtures/test-data';
import { CompanyListPage } from './pages/company-list.page';

test.describe('회사 목록 페이지', () => {
  test('빈 상태 표시', async ({ page, mockExtension }) => {
    await mockExtension(emptyData);

    const listPage = new CompanyListPage(page);
    await listPage.goto();

    await expect(listPage.emptyMessage).toBeVisible();
  });

  test('회사 목록 표시', async ({ page, mockExtension }) => {
    await mockExtension(sampleData);

    const listPage = new CompanyListPage(page);
    await listPage.goto();

    await expect(listPage.companyCards).toHaveCount(2);
    await expect(page.getByText('테스트 회사 A')).toBeVisible();
    await expect(page.getByText('테스트 회사 B')).toBeVisible();
  });

  test('검색 필터링', async ({ page, mockExtension }) => {
    await mockExtension(sampleData);

    const listPage = new CompanyListPage(page);
    await listPage.goto();

    await listPage.search('회사 A');

    await expect(page.getByText('테스트 회사 A')).toBeVisible();
    await expect(page.getByText('테스트 회사 B')).not.toBeVisible();
  });

  test('회사 카드 클릭으로 상세 페이지 이동', async ({ page, mockExtension }) => {
    await mockExtension(sampleData);

    const listPage = new CompanyListPage(page);
    await listPage.goto();

    await listPage.clickCompany('테스트 회사 A');

    await expect(page).toHaveURL(/\/company\/company-1/);
  });

  test('통계 표시', async ({ page, mockExtension }) => {
    await mockExtension(sampleData);

    const listPage = new CompanyListPage(page);
    await listPage.goto();

    await expect(page.getByText('2개 회사')).toBeVisible();
    await expect(page.getByText('5개 이미지')).toBeVisible();
  });
});
```

### spa/e2e/company-detail.spec.ts

```typescript
import { test, expect } from './fixtures/extension-mock';
import { sampleData } from './fixtures/test-data';

test.describe('회사 상세 페이지', () => {
  test.beforeEach(async ({ page, mockExtension }) => {
    await mockExtension(sampleData);
  });

  test('회사 정보 표시', async ({ page }) => {
    await page.goto('/company/company-1');

    await expect(page.getByRole('heading', { name: '테스트 회사 A' })).toBeVisible();
    await expect(page.getByText('WANTED')).toBeVisible();
    await expect(page.getByText('BLIND')).toBeVisible();
  });

  test('이미지 탭 기본 표시', async ({ page }) => {
    await page.goto('/company/company-1');

    // 이미지 탭이 기본 선택
    await expect(page.getByRole('button', { name: /이미지/ })).toHaveClass(/bg-ink/);
  });

  test('분석 탭 전환', async ({ page }) => {
    await page.goto('/company/company-1');

    await page.click('text=분석 결과');

    await expect(page.getByRole('button', { name: /분석 결과/ })).toHaveClass(/bg-ink/);
  });

  test('뒤로가기 버튼', async ({ page }) => {
    await page.goto('/company/company-1');

    await page.click('text=뒤로');

    await expect(page).toHaveURL('/');
  });

  test('AI 분석 시작 버튼', async ({ page }) => {
    await page.goto('/company/company-1');

    await page.click('text=AI 분석 시작');

    await expect(page).toHaveURL(/\/analysis\/company-1/);
  });

  test('삭제 버튼 모달', async ({ page }) => {
    await page.goto('/company/company-1');

    // 삭제 버튼 클릭
    await page.click('[aria-label="삭제"]');

    // 모달 표시 확인
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('삭제하시겠습니까')).toBeVisible();

    // 취소
    await page.click('text=취소');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
```

### spa/e2e/analysis-flow.spec.ts

```typescript
import { test, expect } from './fixtures/extension-mock';
import { sampleData } from './fixtures/test-data';

test.describe('분석 플로우', () => {
  test.beforeEach(async ({ page, mockExtension }) => {
    await mockExtension(sampleData);
  });

  test('분석 페이지 표시', async ({ page }) => {
    await page.goto('/analysis/company-1');

    await expect(page.getByRole('heading', { name: 'AI 분석' })).toBeVisible();
    await expect(page.getByText('테스트 회사 A')).toBeVisible();
  });

  test('AI 엔진 상태 표시', async ({ page }) => {
    await page.goto('/analysis/company-1');

    // AI 엔진 섹션 확인
    await expect(page.getByText('AI 엔진')).toBeVisible();
  });

  test('분석 대상 이미지 목록', async ({ page }) => {
    await page.goto('/analysis/company-1');

    await expect(page.getByText('분석 대상')).toBeVisible();
    await expect(page.getByText(/개 이미지/)).toBeVisible();
  });

  test('분석 시작 버튼 존재', async ({ page }) => {
    await page.goto('/analysis/company-1');

    // AI 엔진 로드 대기
    await page.waitForTimeout(1000);

    await expect(page.getByRole('button', { name: '분석 시작' })).toBeVisible();
  });
});
```

### spa/e2e/settings.spec.ts

```typescript
import { test, expect } from './fixtures/extension-mock';
import { sampleData } from './fixtures/test-data';

test.describe('설정 페이지', () => {
  test.beforeEach(async ({ page, mockExtension }) => {
    await mockExtension(sampleData);
  });

  test('설정 페이지 접근', async ({ page }) => {
    await page.goto('/');

    // 설정 버튼 클릭
    await page.click('[aria-label="설정"]');

    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();
  });

  test('AI 엔진 설정 표시', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByText('AI 엔진')).toBeVisible();
    await expect(page.getByText('Qwen3 (WebGPU)')).toBeVisible();
    await expect(page.getByText('Ollama (로컬 서버)')).toBeVisible();
  });

  test('OCR 설정 표시', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByText('OCR 설정')).toBeVisible();
    await expect(page.getByText('인식 언어')).toBeVisible();
  });

  test('데이터 관리 표시', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByText('데이터 관리')).toBeVisible();
    await expect(page.getByText('2')).toBeVisible(); // 회사 수
    await expect(page.getByText('5')).toBeVisible(); // 이미지 수
  });

  test('데이터 삭제 모달', async ({ page }) => {
    await page.goto('/settings');

    await page.click('text=모든 데이터 삭제');

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('되돌릴 수 없습니다')).toBeVisible();
  });

  test('설정 변경 저장', async ({ page }) => {
    await page.goto('/settings');

    // Ollama 선택
    await page.click('text=Ollama (로컬 서버)');

    // Ollama endpoint 필드 표시 확인
    await expect(page.getByPlaceholder('http://localhost:11434')).toBeVisible();

    // Toast 메시지 확인
    await expect(page.getByText('설정이 저장되었습니다')).toBeVisible();
  });
});
```

### spa/e2e/navigation.spec.ts

```typescript
import { test, expect } from './fixtures/extension-mock';
import { sampleData } from './fixtures/test-data';

test.describe('네비게이션', () => {
  test.beforeEach(async ({ page, mockExtension }) => {
    await mockExtension(sampleData);
  });

  test('로고 클릭으로 홈 이동', async ({ page }) => {
    await page.goto('/settings');

    await page.click('text=AI COMPANY ANALYZER');

    await expect(page).toHaveURL('/');
  });

  test('404 페이지', async ({ page }) => {
    await page.goto('/non-existent-page');

    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText('페이지를 찾을 수 없습니다')).toBeVisible();
  });

  test('404에서 홈으로 돌아가기', async ({ page }) => {
    await page.goto('/non-existent-page');

    await page.click('text=홈으로 돌아가기');

    await expect(page).toHaveURL('/');
  });

  test('브라우저 뒤로가기', async ({ page }) => {
    await page.goto('/');
    await page.goto('/settings');

    await page.goBack();

    await expect(page).toHaveURL('/');
  });
});
```

## 완료 기준

- [ ] 회사 목록: 빈 상태, 목록 표시, 검색, 네비게이션
- [ ] 회사 상세: 정보 표시, 탭 전환, 삭제 모달
- [ ] 분석 플로우: 페이지 표시, 엔진 상태, 시작 버튼
- [ ] 설정: 엔진 선택, OCR, 데이터 관리
- [ ] 네비게이션: 로고, 404, 뒤로가기

## 참조 문서

- spec/03-spa-structure.md Section 8.3 (E2E 테스트)
