# Feature 43: GitHub Pages 자동 배포

## 개요

SPA를 GitHub Pages에 자동 배포하는 GitHub Actions 워크플로우를 설정합니다.

## 범위

- GitHub Actions 워크플로우
- Vite 빌드 설정
- 배포 경로 설정
- 캐싱 최적화

## 의존성

- Feature 02: SPA 프로젝트 초기 설정

## 구현 상세

### .github/workflows/deploy-spa.yml

```yaml
name: Deploy SPA to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'extensions/ai-company-analyzer/spa/**'
      - 'extensions/ai-company-analyzer/shared/**'
      - '.github/workflows/deploy-spa.yml'

  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  build:
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

      - name: Install dependencies
        run: bun install
        working-directory: extensions/ai-company-analyzer/spa

      - name: Build
        run: bun run build
        working-directory: extensions/ai-company-analyzer/spa
        env:
          VITE_EXTENSION_ID: ${{ vars.EXTENSION_ID }}

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: extensions/ai-company-analyzer/spa/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### spa/vite.config.ts (배포 설정 추가)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/ai-company-analyzer/', // GitHub Pages 경로
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          ai: ['@huggingface/transformers'],
          ocr: ['tesseract.js'],
        },
      },
    },
  },
  define: {
    'import.meta.env.VITE_EXTENSION_ID': JSON.stringify(
      process.env.VITE_EXTENSION_ID ?? ''
    ),
  },
});
```

### spa/public/_headers (Netlify/Vercel 호환)

```
/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

### spa/public/404.html (SPA 라우팅 지원)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AI Company Analyzer</title>
  <script type="text/javascript">
    // GitHub Pages SPA 라우팅 핵
    var pathSegmentsToKeep = 1;
    var l = window.location;
    l.replace(
      l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
      l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
      l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
      (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
      l.hash
    );
  </script>
</head>
<body>
</body>
</html>
```

### spa/src/main.tsx (라우팅 복원 스크립트)

```tsx
// SPA 라우팅 복원 (GitHub Pages 404 핵)
(function() {
  const redirect = sessionStorage.redirect;
  delete sessionStorage.redirect;
  if (redirect && redirect !== location.href) {
    history.replaceState(null, '', redirect);
  }
})();

// ... 나머지 코드
```

### spa/index.html (라우팅 복원 추가)

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/ai-company-analyzer/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Company Analyzer</title>

    <!-- GitHub Pages SPA 라우팅 복원 -->
    <script type="text/javascript">
      (function(l) {
        if (l.search[1] === '/' ) {
          var decoded = l.search.slice(1).split('&').map(function(s) {
            return s.replace(/~and~/g, '&')
          }).join('?');
          window.history.replaceState(null, null,
            l.pathname.slice(0, -1) + decoded + l.hash
          );
        }
      }(window.location))
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Repository 설정

```markdown
## GitHub Pages 설정

1. Repository Settings → Pages
2. Source: GitHub Actions 선택
3. Custom domain (선택): 원하는 도메인

## 환경 변수 설정

Repository Settings → Secrets and variables → Actions → Variables

- `EXTENSION_ID`: Chrome Extension ID (선택사항)

## 배포 URL

https://{username}.github.io/ai-company-analyzer/
```

## 완료 기준

- [ ] deploy-spa.yml 워크플로우
- [ ] main 브랜치 push 시 자동 배포
- [ ] 수동 배포 (workflow_dispatch)
- [ ] Bun 캐싱
- [ ] vite.config.ts base 경로 설정
- [ ] 404.html SPA 라우팅 핵
- [ ] 청크 분리 (vendor, query, ai, ocr)

## 참조 문서

- spec/03-spa-structure.md Section 9 (배포)
