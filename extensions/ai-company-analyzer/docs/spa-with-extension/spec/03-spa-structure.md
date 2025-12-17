# SPA 구조 스펙

## 1. 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | React | 18.x |
| 언어 | TypeScript | 5.x |
| 빌드 | Vite | 5.x |
| 라우팅 | React Router | 6.x |
| 상태 관리 | TanStack Query | 5.x |
| 스타일 | TailwindCSS | 3.x |
| OCR | Tesseract.js | 6.x |
| LLM | transformers.js | 3.x |

## 2. 디렉토리 구조

```
spa/
├── public/
│   ├── favicon.ico
│   └── robots.txt
│
├── src/
│   ├── main.tsx                    # 진입점
│   ├── App.tsx                     # 루트 컴포넌트, 라우팅
│   ├── vite-env.d.ts
│   │
│   ├── pages/                      # 페이지 컴포넌트
│   │   ├── CompanyList.tsx         # 회사 목록
│   │   ├── CompanyDetail.tsx       # 회사 상세
│   │   ├── Analysis.tsx            # 분석 진행
│   │   ├── Settings.tsx            # 설정
│   │   └── NotFound.tsx            # 404
│   │
│   ├── components/                 # 공통 컴포넌트
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   │
│   │   ├── ui/                     # 기본 UI
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── ProgressBar.tsx
│   │   │
│   │   ├── company/
│   │   │   ├── CompanyCard.tsx
│   │   │   └── CompanyStats.tsx
│   │   │
│   │   ├── image/
│   │   │   ├── ImageCard.tsx
│   │   │   ├── ImageGallery.tsx
│   │   │   └── ImageViewer.tsx
│   │   │
│   │   └── analysis/
│   │       ├── AnalysisProgress.tsx
│   │       ├── AnalysisResult.tsx
│   │       └── CategoryBadge.tsx
│   │
│   ├── contexts/                   # React Context
│   │   ├── ExtensionContext.tsx    # Extension 연결 상태
│   │   └── OCRContext.tsx          # OCR Worker 관리
│   │
│   ├── hooks/                      # Custom Hooks
│   │   ├── useExtensionData.ts     # Extension 데이터 조회
│   │   ├── useOCR.ts               # OCR 실행
│   │   ├── useAnalysis.ts          # LLM 분석
│   │   └── useLocalStorage.ts      # 로컬 설정
│   │
│   ├── lib/                        # 유틸리티
│   │   ├── extension-client.ts     # Extension 통신
│   │   ├── utils.ts                # 공통 유틸
│   │   └── constants.ts            # 상수
│   │
│   ├── ai/                         # AI 모듈
│   │   ├── qwen3-engine.ts         # Qwen3 LLM
│   │   ├── prompts.ts              # 프롬프트 관리
│   │   └── text-processing.ts      # 텍스트 전처리
│   │
│   ├── workers/                    # Web Workers
│   │   └── ocr-worker.ts           # Tesseract.js Worker
│   │
│   ├── types/                      # 타입 정의
│   │   ├── company.ts
│   │   ├── image.ts
│   │   ├── analysis.ts
│   │   └── api.ts
│   │
│   └── styles/                     # 스타일
│       ├── globals.css
│       └── components.css
│
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── .env.example
```

## 3. 라우팅 구조

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const router = [
  { path: '/', element: <CompanyList /> },
  { path: '/company/:companyId', element: <CompanyDetail /> },
  { path: '/analysis/:companyId', element: <Analysis /> },
  { path: '/settings', element: <Settings /> },
  { path: '*', element: <NotFound /> },
];

function App() {
  return (
    <BrowserRouter basename="/ai-company-analyzer">
      <ExtensionProvider>
        <OCRProvider>
          <QueryClientProvider client={queryClient}>
            <Layout>
              <Routes>
                {router.map(route => (
                  <Route key={route.path} {...route} />
                ))}
              </Routes>
            </Layout>
          </QueryClientProvider>
        </OCRProvider>
      </ExtensionProvider>
    </BrowserRouter>
  );
}
```

## 4. 상태 관리

### 4.1 서버 상태 (TanStack Query)

```typescript
// src/hooks/useExtensionData.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import * as api from '@/lib/extension-client';

// 쿼리 키 상수
export const queryKeys = {
  companies: ['companies'] as const,
  company: (id: string) => ['company', id] as const,
  images: (companyId: string) => ['images', companyId] as const,
  imageData: (id: string) => ['imageData', id] as const,
};

// 회사 목록
export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.companies,
    queryFn: api.getCompanies,
    staleTime: 30_000,
  });
}

// 이미지 목록
export function useImages(companyId: string) {
  return useQuery({
    queryKey: queryKeys.images(companyId),
    queryFn: () => api.getImages(companyId),
    enabled: !!companyId,
  });
}

// 분석 저장
export function useSaveAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.saveAnalysis,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.images(variables.companyId),
      });
    },
  });
}
```

### 4.2 클라이언트 상태 (Context)

```typescript
// Extension 연결 상태
interface ExtensionState {
  isConnected: boolean;
  isChecking: boolean;
  error: string | null;
}

// OCR 상태
interface OCRState {
  isReady: boolean;
  isProcessing: boolean;
  progress: number;
  currentImageId: string | null;
}
```

## 5. 주요 컴포넌트

### 5.1 Layout

```typescript
// src/components/layout/Layout.tsx
function Layout({ children }: { children: React.ReactNode }) {
  const { isConnected } = useExtension();

  if (!isConnected) {
    return <ExtensionRequired />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
```

### 5.2 CompanyList

```typescript
// src/pages/CompanyList.tsx
function CompanyList() {
  const { data: companies, isLoading } = useCompanies();

  if (isLoading) return <Spinner />;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {companies?.map(company => (
        <CompanyCard key={company.id} company={company} />
      ))}
    </div>
  );
}
```

### 5.3 Analysis

```typescript
// src/pages/Analysis.tsx
function Analysis() {
  const { companyId } = useParams();
  const { data: images } = useImages(companyId!);
  const { recognize, isReady } = useOCR();
  const { analyze } = useAnalysis();
  const saveAnalysis = useSaveAnalysis();

  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const runAnalysis = async () => {
    const pendingImages = images?.filter(img => !img.hasAnalysis) || [];
    setProgress({ current: 0, total: pendingImages.length });

    for (const [index, img] of pendingImages.entries()) {
      // 1. 이미지 로드
      const imageData = await api.getImageData(img.id);
      const blob = base64ToBlob(imageData.base64, imageData.mimeType);

      // 2. OCR
      const rawText = await recognize(blob);

      // 3. LLM 분석
      const { category, analysis } = await analyze(rawText);

      // 4. 저장
      await saveAnalysis.mutateAsync({
        imageId: img.id,
        companyId: companyId!,
        category,
        rawText,
        analysis,
      });

      setProgress(p => ({ ...p, current: index + 1 }));
    }
  };

  return (
    <div>
      <AnalysisProgress progress={progress} />
      <Button onClick={runAnalysis} disabled={!isReady}>
        분석 시작
      </Button>
    </div>
  );
}
```

## 6. AI 모듈

### 6.1 Qwen3 Engine

```typescript
// src/ai/qwen3-engine.ts
import { pipeline } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/Qwen3-0.6B-ONNX';

let generator: any = null;
let initPromise: Promise<void> | null = null;

export async function initQwen3(
  onProgress?: (p: number) => void
): Promise<void> {
  if (generator) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    generator = await pipeline('text-generation', MODEL_ID, {
      dtype: 'q4f16',
      device: 'webgpu',
      progress_callback: (p: any) => {
        if (p.progress) onProgress?.(p.progress);
      },
    });
  })();

  return initPromise;
}

export async function generate(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 256
): Promise<string> {
  if (!generator) throw new Error('Qwen3 not initialized');

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const output = await generator(messages, {
    max_new_tokens: maxTokens,
    do_sample: false,
  });

  const content = output[0].generated_text.at(-1).content;
  return removeThinkingTags(content);
}

function removeThinkingTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}
```

### 6.2 프롬프트

```typescript
// src/ai/prompts.ts
export const CLASSIFY_SYSTEM = `You are a document classifier.
Classify the text into exactly one category.
Reply with ONLY the category name, nothing else.`;

export const CATEGORIES = [
  'revenue_trend',
  'balance_sheet',
  'income_statement',
  'employee_trend',
  'review_positive',
  'review_negative',
  'company_overview',
  'unknown',
] as const;

export function buildClassifyPrompt(text: string): string {
  return `Text:\n${text}\n\nCategories: ${CATEGORIES.join(', ')}\n\nCategory:`;
}

export const ANALYZE_SYSTEM = `You are a financial analyst.
Summarize the key information in Korean. Be concise.`;

export function buildAnalyzePrompt(text: string, category: string): string {
  return `Category: ${category}\n\nText:\n${text}\n\n요약:`;
}
```

## 7. 환경 변수

```bash
# .env.example
VITE_EXTENSION_ID=abcdefghijklmnopqrstuvwxyz123456
VITE_API_BASE_URL=https://username.github.io/ai-company-analyzer
```

```typescript
// vite.config.ts
export default defineConfig({
  base: '/ai-company-analyzer/',
  envPrefix: 'VITE_',
});
```

## 8. 빌드 설정

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/ai-company-analyzer/',
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
          tesseract: ['tesseract.js'],
          transformers: ['@huggingface/transformers'],
        },
      },
    },
  },
});
```

## 9. TailwindCSS 설정

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          600: '#0284c7',
        },
      },
    },
  },
  plugins: [],
};
```

## 10. TypeScript 설정

```json
// tsconfig.json
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
