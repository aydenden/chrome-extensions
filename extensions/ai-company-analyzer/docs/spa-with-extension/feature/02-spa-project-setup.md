# Feature 02: SPA 프로젝트 초기 설정

## 개요

React 기반 SPA 프로젝트의 기본 구조를 설정합니다.

## 범위

- `spa/` 디렉토리 구조 생성
- package.json (React 18, TanStack Query, TailwindCSS)
- vite.config.ts (GitHub Pages base path)
- 빈 App.tsx, main.tsx

## 의존성

없음 (독립적으로 시작 가능)

## 구현 상세

### 디렉토리 구조

```
spa/
├── public/
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── vite-env.d.ts
│   ├── pages/           # 추후 추가
│   ├── components/      # 추후 추가
│   ├── contexts/        # 추후 추가
│   ├── hooks/           # 추후 추가
│   ├── lib/             # 추후 추가
│   ├── ai/              # 추후 추가
│   └── styles/
│       └── globals.css
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── .env.example
```

### package.json

```json
{
  "name": "@chrome-ext/ai-company-analyzer-spa",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test:unit": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.50.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.24.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/ai-company-analyzer/',  // GitHub Pages base path
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['tesseract.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
```

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### postcss.config.js

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### index.html

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Company Analyzer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### src/main.tsx

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### src/App.tsx

```typescript
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold p-4">AI Company Analyzer</h1>
      <p className="p-4">SPA 초기 설정 완료</p>
    </div>
  );
}

export default App;
```

### src/styles/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### .env.example

```bash
VITE_EXTENSION_ID=your-extension-id-here
```

## 완료 기준

- [ ] `bun install` 성공
- [ ] `bun run dev` 실행 시 localhost:5173에서 페이지 표시
- [ ] TailwindCSS 스타일 적용됨
- [ ] `bun run build` 성공

## 참조 문서

- spec/01-architecture.md Section 5 (디렉토리 구조)
- spec/03-spa-structure.md Section 1-2 (기술 스택, 디렉토리)
