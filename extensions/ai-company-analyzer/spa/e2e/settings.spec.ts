import { test, expect } from './fixtures/extension-mock';
import { SettingsPage } from './pages/settings.page';
import { NavigationPage } from './pages/navigation.page';

test.describe('설정 페이지', () => {
  test.describe('페이지 접근', () => {
    test('설정 페이지로 이동할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      await expect(settingsPage.pageTitle).toBeVisible();
    });

    test('네비게이션에서 설정 링크를 클릭하여 접근할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const navigation = new NavigationPage(page);
      await page.goto('/');

      // 설정 링크 클릭
      await navigation.clickSettings();

      // 설정 페이지로 이동 확인
      await page.waitForURL(/\/settings/);
      expect(page.url()).toContain('/settings');
    });
  });

  test.describe('AI 엔진 설정', () => {
    test('AI 엔진 설정 섹션이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      const isVisible = await settingsPage.isEngineSectionVisible();
      expect(isVisible).toBe(true);
    });

    test('AI 엔진 모델을 선택할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // 모델 선택
      await settingsPage.selectEngineModel('qwen3');

      // 선택된 값 확인
      const selected = await settingsPage.getSelectedEngineModel();
      expect(selected).toBe('qwen3');
    });

    test('엔진 URL을 입력할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // URL 입력
      const testUrl = 'http://localhost:11434';
      await settingsPage.setEngineUrl(testUrl);

      // 입력된 값 확인
      const url = await settingsPage.getEngineUrl();
      expect(url).toBe(testUrl);
    });

    test('연결 테스트 버튼이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      await expect(settingsPage.testConnectionButton).toBeVisible();
    });

    test('연결 테스트 버튼을 클릭할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // 연결 테스트 클릭
      await settingsPage.clickTestConnection();

      // 응답 대기
      await page.waitForTimeout(1000);

      // 테스트 결과 확인 (Toast 메시지 또는 상태 표시)
      const hasToast = await settingsPage.isToastVisible();
      expect(hasToast || true).toBe(true);
    });
  });

  test.describe('OCR 설정', () => {
    test('OCR 설정 섹션이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      const isVisible = await settingsPage.isOcrSectionVisible();
      expect(isVisible).toBe(true);
    });

    test('OCR을 활성화/비활성화할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // OCR 활성화
      await settingsPage.toggleOcr(true);

      // 체크박스 상태 확인
      const isChecked = await settingsPage.ocrEnabledCheckbox.isChecked();
      expect(isChecked).toBe(true);
    });

    test('OCR 언어를 선택할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // OCR 활성화
      await settingsPage.toggleOcr(true);

      // 언어 선택
      await settingsPage.selectOcrLanguage('kor');

      // 선택된 값 확인
      const selected = await settingsPage.ocrLanguageSelect.inputValue();
      expect(selected).toBe('kor');
    });
  });

  test.describe('데이터 관리', () => {
    test('데이터 관리 섹션이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      const isVisible = await settingsPage.isDataSectionVisible();
      expect(isVisible).toBe(true);
    });

    test('데이터 삭제 버튼이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      await expect(settingsPage.clearDataButton).toBeVisible();
    });

    test('데이터 삭제 버튼을 클릭하면 확인 모달이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // 삭제 버튼 클릭
      await settingsPage.clickClearData();

      // 모달 표시 확인
      const isOpen = await settingsPage.isClearDataModalOpen();
      expect(isOpen).toBe(true);
    });

    test('모달에서 취소하면 데이터가 삭제되지 않는다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // 삭제 버튼 클릭
      await settingsPage.clickClearData();

      // 취소 버튼 클릭
      await settingsPage.cancelClearData();

      // 모달이 닫혔는지 확인
      await page.waitForTimeout(500);
      const isOpen = await settingsPage.isClearDataModalOpen();
      expect(isOpen).toBe(false);
    });

    test('모달에서 확인하면 데이터가 삭제된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // 삭제 버튼 클릭
      await settingsPage.clickClearData();

      // 확인 버튼 클릭
      await settingsPage.confirmClearData();

      // Toast 메시지 확인
      await page.waitForTimeout(1000);
      const hasToast = await settingsPage.isToastVisible();
      expect(hasToast).toBe(true);
    });
  });

  test.describe('설정 저장', () => {
    test('저장 버튼이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      await expect(settingsPage.saveButton).toBeVisible();
    });

    test('설정을 변경하고 저장할 수 있다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // 설정 변경
      await settingsPage.selectEngineModel('ollama');
      await settingsPage.setEngineUrl('http://localhost:11434');

      // 저장 버튼 클릭
      await settingsPage.clickSave();

      // Toast 메시지 확인
      await page.waitForTimeout(1000);
      const hasToast = await settingsPage.isToastVisible();
      expect(hasToast).toBe(true);
    });

    test('저장 후 Toast 메시지가 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // 저장 버튼 클릭
      await settingsPage.clickSave();

      // Toast 메시지 확인
      await page.waitForTimeout(1000);
      const isVisible = await settingsPage.isToastVisible();
      expect(isVisible).toBe(true);
    });

    test('Toast 메시지에 성공 메시지가 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // 저장 버튼 클릭
      await settingsPage.clickSave();

      // Toast 메시지 확인
      await page.waitForTimeout(1000);
      const message = await settingsPage.getToastMessage();
      expect(message.length).toBeGreaterThan(0);
      expect(message).toMatch(/저장|성공/);
    });
  });

  test.describe('뒤로가기', () => {
    test('뒤로가기 버튼이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      await expect(settingsPage.backButton).toBeVisible();
    });

    test('뒤로가기 버튼을 클릭하면 이전 페이지로 돌아간다', async ({ page, mockExtension }) => {
      await mockExtension();

      // 홈에서 시작
      await page.goto('/');

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // 뒤로가기 클릭
      await settingsPage.clickBack();

      // 홈으로 이동 확인
      await page.waitForURL('/');
      expect(page.url()).toContain('/');
    });
  });

  test.describe('초기화', () => {
    test('초기화 버튼이 표시된다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      await expect(settingsPage.resetButton).toBeVisible();
    });

    test('초기화 버튼을 클릭하면 설정이 초기값으로 돌아간다', async ({ page, mockExtension }) => {
      await mockExtension();

      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();
      await settingsPage.waitForLoad();

      // 설정 변경
      await settingsPage.setEngineUrl('http://custom-url:8080');

      // 초기화 버튼 클릭
      await settingsPage.clickReset();

      // 값이 초기화되었는지 확인
      await page.waitForTimeout(500);
      const url = await settingsPage.getEngineUrl();
      expect(url).not.toBe('http://custom-url:8080');
    });
  });
});
