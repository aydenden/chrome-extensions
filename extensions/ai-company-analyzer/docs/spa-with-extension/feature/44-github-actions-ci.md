# Feature 44: CI 테스트 파이프라인

## 개요

PR 및 push 시 자동으로 테스트를 실행하는 CI 파이프라인을 구성합니다.

## 범위

- 단위 테스트 (Vitest)
- E2E 테스트 (Playwright)
- 타입 체크
- 린트 체크

## 의존성

- Feature 37: Vitest 환경 설정
- Feature 41: Playwright E2E 환경

## 구현 상세

### .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'extensions/ai-company-analyzer/**'
      - '.github/workflows/ci.yml'

  pull_request:
    branches: [main, develop]
    paths:
      - 'extensions/ai-company-analyzer/**'

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # 타입 체크 & 린트
  check:
    name: Type Check & Lint
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Cache dependencies
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
          restore-keys: |
            ${{ runner.os }}-bun-

      - name: Install dependencies (Extension)
        run: bun install
        working-directory: extensions/ai-company-analyzer/extension

      - name: Install dependencies (SPA)
        run: bun install
        working-directory: extensions/ai-company-analyzer/spa

      - name: Type check (Extension)
        run: bun run typecheck
        working-directory: extensions/ai-company-analyzer/extension

      - name: Type check (SPA)
        run: bun run typecheck
        working-directory: extensions/ai-company-analyzer/spa

      - name: Lint (Extension)
        run: bun run lint
        working-directory: extensions/ai-company-analyzer/extension

      - name: Lint (SPA)
        run: bun run lint
        working-directory: extensions/ai-company-analyzer/spa

  # 단위 테스트
  unit-test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: check

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Cache dependencies
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
          restore-keys: |
            ${{ runner.os }}-bun-

      - name: Install dependencies (Extension)
        run: bun install
        working-directory: extensions/ai-company-analyzer/extension

      - name: Install dependencies (SPA)
        run: bun install
        working-directory: extensions/ai-company-analyzer/spa

      - name: Test (Extension)
        run: bun run test:run
        working-directory: extensions/ai-company-analyzer/extension

      - name: Test (SPA)
        run: bun run test:run
        working-directory: extensions/ai-company-analyzer/spa

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: extensions/ai-company-analyzer/spa/coverage/lcov.info,extensions/ai-company-analyzer/extension/coverage/lcov.info
          flags: unittests
          fail_ci_if_error: false

  # E2E 테스트
  e2e-test:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: check

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Cache dependencies
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
          restore-keys: |
            ${{ runner.os }}-bun-

      - name: Install dependencies
        run: bun install
        working-directory: extensions/ai-company-analyzer/spa

      - name: Install Playwright browsers
        run: bunx playwright install --with-deps chromium
        working-directory: extensions/ai-company-analyzer/spa

      - name: Build SPA
        run: bun run build
        working-directory: extensions/ai-company-analyzer/spa

      - name: Run E2E tests
        run: bun run e2e
        working-directory: extensions/ai-company-analyzer/spa
        env:
          CI: true

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: extensions/ai-company-analyzer/spa/playwright-report/
          retention-days: 7

  # 빌드 테스트
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [unit-test, e2e-test]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Cache dependencies
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
          restore-keys: |
            ${{ runner.os }}-bun-

      - name: Install & Build Extension
        run: |
          bun install
          bun run build
        working-directory: extensions/ai-company-analyzer/extension

      - name: Install & Build SPA
        run: |
          bun install
          bun run build
        working-directory: extensions/ai-company-analyzer/spa

      - name: Upload Extension artifact
        uses: actions/upload-artifact@v4
        with:
          name: extension-dist
          path: extensions/ai-company-analyzer/extension/dist/
          retention-days: 7

      - name: Upload SPA artifact
        uses: actions/upload-artifact@v4
        with:
          name: spa-dist
          path: extensions/ai-company-analyzer/spa/dist/
          retention-days: 7
```

### package.json 스크립트 (Extension)

```json
{
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

### package.json 스크립트 (SPA)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui"
  }
}
```

### .github/workflows/pr-check.yml (PR 전용 빠른 체크)

```yaml
name: PR Check

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  quick-check:
    name: Quick Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install & Check (SPA)
        run: |
          bun install
          bun run typecheck
          bun run lint
          bun run test:run
        working-directory: extensions/ai-company-analyzer/spa

      - name: Install & Check (Extension)
        run: |
          bun install
          bun run typecheck
          bun run lint
          bun run test:run
        working-directory: extensions/ai-company-analyzer/extension
```

### .eslintrc.cjs (공통)

```javascript
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
```

## 완료 기준

- [ ] ci.yml: 전체 CI 파이프라인
- [ ] pr-check.yml: PR 빠른 체크
- [ ] 타입 체크 (tsc --noEmit)
- [ ] ESLint 린트
- [ ] 단위 테스트 (Vitest)
- [ ] E2E 테스트 (Playwright)
- [ ] 빌드 테스트
- [ ] 아티팩트 업로드
- [ ] 커버리지 리포트 (Codecov)

## 참조 문서

- spec/03-spa-structure.md Section 9.1 (CI/CD)
