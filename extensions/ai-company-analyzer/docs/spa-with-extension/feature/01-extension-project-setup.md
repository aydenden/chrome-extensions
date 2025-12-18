# Feature 01: Extension 프로젝트 초기 설정

## 개요

Chrome Extension 프로젝트의 기본 구조를 설정합니다.

## 범위

- `extension/` 디렉토리 구조 생성
- package.json, tsconfig.json, vite.config.ts
- manifest.json (Manifest V3 + externally_connectable)
- 빈 Service Worker 진입점

## 의존성

없음 (독립적으로 시작 가능)

## 구현 상세

### 디렉토리 구조

```
extension/
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── background/
    │   └── index.ts           # Service Worker 진입점
    ├── content/
    │   └── index.ts           # Content Script 진입점
    ├── popup/
    │   ├── index.html
    │   ├── index.tsx
    │   └── MiniPopup.tsx
    └── lib/
        └── (추후 추가)
```

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "AI Company Analyzer",
  "version": "1.0.0",
  "description": "기업 정보 수집 및 AI 분석",
  "permissions": [
    "storage",
    "tabs",
    "activeTab"
  ],
  "host_permissions": [
    "*://*.wanted.co.kr/*",
    "*://*.jobplanet.co.kr/*",
    "*://*.innoforest.co.kr/*",
    "*://dart.fss.or.kr/*",
    "*://*.teamblind.com/*",
    "*://*.saramin.co.kr/*"
  ],
  "externally_connectable": {
    "matches": [
      "https://*.github.io/*",
      "http://localhost:*/*",
      "http://127.0.0.1:*/*"
    ]
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.wanted.co.kr/*",
        "*://*.jobplanet.co.kr/*",
        "*://*.innoforest.co.kr/*",
        "*://dart.fss.or.kr/*",
        "*://*.teamblind.com/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "AI Company Analyzer"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

### package.json

```json
{
  "name": "@chrome-ext/ai-company-analyzer-extension",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build"
  },
  "dependencies": {
    "dexie": "^4.0.10",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.270",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

### tsconfig.json

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["chrome"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### src/background/index.ts (빈 진입점)

```typescript
// Service Worker 진입점
console.log('AI Company Analyzer Extension loaded');

// External API, Data Manager 등은 추후 추가
export {};
```

## 완료 기준

- [ ] `bun install` 성공
- [ ] `bun run build` 성공 (dist 폴더 생성)
- [ ] Chrome `chrome://extensions/` → "압축해제된 확장 프로그램 로드" → dist 폴더 선택
- [ ] Extension 아이콘이 Chrome 툴바에 표시됨
- [ ] 팝업 클릭 시 빈 팝업 페이지 표시

## 참조 문서

- spec/01-architecture.md Section 5 (디렉토리 구조)
