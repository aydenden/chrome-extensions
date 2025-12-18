# AIProvider/OCRProvider 누락 이슈

## 개요
Analysis 페이지 접근 시 "Extension 연결 필요" 메시지가 표시되고, 콘솔에 `useAI must be used within AIProvider` 오류가 발생했습니다.

## 증상
- Analysis 페이지(`/analysis/:companyId`) 접근 불가
- 화면에 "Extension 연결 필요" 메시지 표시
- 콘솔 오류:
  ```
  Uncaught Error: useAI must be used within AIProvider
      at useAI (AIContext.tsx:110:23)
      at Analysis (Analysis.tsx:39:64)
  ```

## 원인

**Analysis.tsx에서 사용하는 Context:**
```typescript
const { status: aiStatus, engineName, initialize: initAI } = useAI();  // AIContext
const { isReady: ocrReady } = useOCR();  // OCRContext
```

**App.tsx의 기존 Provider 구조:**
```tsx
<BrowserRouter>
  <ErrorBoundary>
    <QueryClientProvider>
      <ExtensionProvider>
        <ToastProvider>
          <ExtensionErrorBoundary>
            <AppRoutes />  // Analysis 포함
          </ExtensionErrorBoundary>
        </ToastProvider>
      </ExtensionProvider>
    </QueryClientProvider>
  </ErrorBoundary>
</BrowserRouter>
```

**문제**: `AIProvider`와 `OCRProvider`가 Provider 체인에 포함되지 않음

## 수정

**파일**: `spa/src/App.tsx`

1. import 추가:
```typescript
import { AIProvider } from '@/contexts/AIContext';
import { OCRProvider } from '@/contexts/OCRContext';
```

2. Provider 래핑 추가:
```tsx
<ExtensionProvider>
  <ToastProvider>
    <AIProvider>
      <OCRProvider>
        <ExtensionErrorBoundary fallback={<ExtensionRequired />}>
          <AppRoutes />
        </ExtensionErrorBoundary>
      </OCRProvider>
    </AIProvider>
  </ToastProvider>
</ExtensionProvider>
```

## 관련 파일
- `spa/src/App.tsx` - Provider 구조 수정
- `spa/src/contexts/AIContext.tsx` - AI 엔진 관리
- `spa/src/contexts/OCRContext.tsx` - OCR 기능 관리
- `spa/src/pages/Analysis.tsx` - AI 분석 페이지
