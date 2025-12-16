# 01. 프로젝트 설정

## 개요
Vite + React + TypeScript 기반 Chrome Extension 프로젝트 초기 설정

## 선행 조건
- 없음 (첫 번째 Feature)

## 기술 스택
| 분류 | 기술 | 버전 |
|------|------|------|
| 빌드 도구 | Vite | ^5.0.0 |
| UI 프레임워크 | React | ^18.3.0 |
| 언어 | TypeScript | ^5.6.0 |
| 런타임 | Bun | ^1.0.0 |

---

## 디렉토리 구조

```
extensions/ai-company-analyzer/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── manifest.json
├── src/
│   ├── popup/              # 팝업 UI (React)
│   │   ├── Popup.tsx
│   │   ├── popup.html
│   │   └── popup.css
│   ├── pages/              # 전체 페이지 (React)
│   │   ├── list/
│   │   ├── detail/
│   │   └── settings/
│   ├── content/            # 콘텐츠 스크립트
│   │   ├── element-picker.ts
│   │   └── graph-capture.ts
│   ├── background/         # 서비스 워커
│   │   ├── index.ts
│   │   ├── webllm-engine.ts
│   │   └── transformers-engine.ts
│   ├── lib/                # 공통 유틸리티
│   │   ├── db.ts           # Dexie.js 설정
│   │   ├── storage.ts      # 저장소 함수
│   │   ├── company-extractor.ts
│   │   └── sites.ts
│   └── types/              # 타입 정의
│       ├── company.ts
│       └── storage.ts
├── assets/                 # 아이콘
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    ├── spec/
    ├── research/
    └── feature/
```

---

## 구현 단계

### Step 1: package.json 생성

```json
{
  "name": "@chrome-ext/ai-company-analyzer",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite build --watch --mode development",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "dexie": "^4.0.10",
    "dexie-react-hooks": "^1.1.7"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.287",
    "@types/react": "^18.3.16",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^5.4.11"
  }
}
```

### Step 2: tsconfig.json 생성

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["chrome"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 3: vite.config.ts 생성

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyDirFirst: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        list: resolve(__dirname, 'src/pages/list/list.html'),
        detail: resolve(__dirname, 'src/pages/detail/detail.html'),
        settings: resolve(__dirname, 'src/pages/settings/settings.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
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
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

### Step 4: manifest.json 생성 (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "AI 기업분석",
  "version": "0.0.1",
  "description": "기업 정보 수집 및 AI 분석 도구",

  "permissions": [
    "storage",
    "tabs",
    "activeTab"
  ],

  "host_permissions": [
    "https://www.wanted.co.kr/*",
    "https://www.innoforest.co.kr/*",
    "https://dart.fss.or.kr/*",
    "https://sminfo.mss.go.kr/*",
    "https://www.teamblind.com/*",
    "https://www.jobplanet.co.kr/*",
    "https://huggingface.co/*"
  ],

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "assets/icon16.png",
      "48": "assets/icon48.png",
      "128": "assets/icon128.png"
    }
  },

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": [
        "https://www.wanted.co.kr/*",
        "https://www.innoforest.co.kr/*",
        "https://dart.fss.or.kr/*",
        "https://sminfo.mss.go.kr/*",
        "https://www.teamblind.com/*",
        "https://www.jobplanet.co.kr/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],

  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },

  "web_accessible_resources": [
    {
      "resources": ["pdf.worker.min.js"],
      "matches": ["<all_urls>"]
    }
  ],

  "icons": {
    "16": "assets/icon16.png",
    "48": "assets/icon48.png",
    "128": "assets/icon128.png"
  }
}
```

### Step 5: 기본 파일 생성

#### src/popup/popup.html
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 기업분석</title>
  <link rel="stylesheet" href="./popup.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./Popup.tsx"></script>
</body>
</html>
```

#### src/popup/Popup.tsx
```typescript
import React from 'react';
import { createRoot } from 'react-dom/client';

function Popup() {
  return (
    <div className="popup-container">
      <h1>AI 기업분석</h1>
      <p>준비 중...</p>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
```

#### src/background/index.ts
```typescript
// Service Worker 진입점
console.log('AI 기업분석 - Background Service Worker 시작');

// Service Worker 유지용 heartbeat
const HEARTBEAT_INTERVAL = 20000;
setInterval(() => {
  chrome.runtime.getPlatformInfo(() => {});
}, HEARTBEAT_INTERVAL);

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  return true; // 비동기 응답 허용
});
```

#### src/content/index.ts
```typescript
// Content Script 진입점
console.log('AI 기업분석 - Content Script 로드됨');

// 현재 URL 확인
const currentUrl = window.location.href;
console.log('현재 URL:', currentUrl);
```

### Step 6: 루트 package.json 스크립트 추가

루트 `/Users/nyh/dev/workSpace/chrome-extensions/package.json`에 추가:

```json
{
  "scripts": {
    "build:ai-analyzer": "bun run --cwd extensions/ai-company-analyzer build",
    "dev:ai-analyzer": "bun run --cwd extensions/ai-company-analyzer dev"
  }
}
```

---

## 빌드 및 테스트

### 빌드 명령어
```bash
# 전체 빌드
bun run build:ai-analyzer

# Watch 모드 (개발)
bun run dev:ai-analyzer
```

### Chrome에서 테스트
1. `chrome://extensions/` 접속
2. "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `extensions/ai-company-analyzer/dist` 폴더 선택

---

## 산출물

| 파일 | 설명 |
|------|------|
| `package.json` | 프로젝트 의존성 |
| `tsconfig.json` | TypeScript 설정 |
| `vite.config.ts` | Vite 빌드 설정 |
| `manifest.json` | Chrome Extension 설정 |
| `src/popup/` | 팝업 기본 구조 |
| `src/background/` | Service Worker 기본 구조 |
| `src/content/` | Content Script 기본 구조 |

---

## 참조 문서
- [spec/01-overview.md](../spec/01-overview.md) - 프로젝트 개요
- [research/00-decisions.md](../research/00-decisions.md) - 기술 결정 요약
