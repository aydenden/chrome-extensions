import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  // AI 모델 로드 시간 포함하여 3분
  timeout: 180000,

  expect: {
    // expect 타임아웃 1분
    timeout: 60000,
  },

  // 병렬 실행 비활성화 (Extension 충돌 방지)
  fullyParallel: false,
  workers: 1,

  // 재시도 없음
  retries: 0,

  // 리포터 설정
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  use: {
    // Extension은 headless 모드 미지원
    headless: false,

    // 스크린샷 및 비디오
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // 트레이스
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
