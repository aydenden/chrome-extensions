# Fix 03: AI 분석 페이지 안정화

## 개요

AI 분석 페이지에서 발생한 여러 이슈들을 수정한 기록입니다.

---

## 이슈 1: Vite 504 오류 (Outdated Optimize Dep)

### 증상
```
GET .../node_modules/.vite/deps/@huggingface_transformers.js 504 (Outdated Optimize Dep)
qwen3 initialization failed: TypeError: Failed to fetch dynamically imported module
```

### 원인
- `vite.config.ts`의 `optimizeDeps.include`에 `@huggingface/transformers`가 누락
- Vite가 해당 의존성을 pre-bundle하지 않아 캐시 만료 시 504 발생

### 수정
**파일**: `spa/vite.config.ts`

```typescript
// Before
optimizeDeps: {
  include: ['tesseract.js'],
}

// After
optimizeDeps: {
  include: ['tesseract.js', '@huggingface/transformers'],
}
```

---

## 이슈 2: ONNX 모델 404

### 증상
```
GET https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/resolve/main/onnx/model.onnx 404 (Not Found)
qwen3 initialization failed: Error: Could not locate file
```

### 원인
- `Qwen/Qwen2.5-0.5B-Instruct`는 PyTorch/Safetensors 형식
- transformers.js는 ONNX 형식만 지원

### 수정
**파일**: `spa/src/lib/ai/engines/qwen3.ts`

```typescript
// Before
const MODEL_ID = 'Qwen/Qwen2.5-0.5B-Instruct';

// After
const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
```

추가로 `dtype: 'q4'` 옵션 추가하여 메모리 최적화.

---

## 이슈 3: 분석 중 상태 초기화

### 증상
1. AI 엔진 초기화 완료 → 분석 시작 버튼 활성화
2. 분석 시작 → 이미지 1개 분석 완료
3. **30초 후**: AI 엔진 초기화 버튼 재등장, 분석 결과 초기화, 버튼 비활성화

### 디버깅 로그
```
16:17:17  isRunning: true,  completedCount: 1  ← 정상
    ↓ (15초)
16:17:32  isRunning: false, completedCount: 0  ← 초기화!
```

**핵심**: `[Analysis] finally block` 로그 없이 상태 초기화됨
→ 컴포넌트가 **언마운트 → 재마운트**되어 초기값으로 돌아감

### 원인
**파일**: `spa/src/App.tsx`

```typescript
function AppRoutes() {
  const { isConnected, isChecking } = useExtension();

  if (isChecking) return <LoadingPage />;       // Analysis 언마운트!
  if (!isConnected) return <ExtensionRequired />; // Analysis 언마운트!

  return <Layout>...</Layout>;  // Analysis 마운트
}
```

- ExtensionContext가 30초마다 `checkConnection()` 호출
- `isChecking: true`가 되면 `<LoadingPage />` 렌더링
- Analysis 컴포넌트 언마운트 → 상태 초기화 → 다시 마운트

### 수정
**파일**: `spa/src/App.tsx`

```typescript
// Before - 체크 중이면 무조건 LoadingPage 표시
if (isChecking) return <LoadingPage />;

// After - 최초 연결 확인 시에만 LoadingPage 표시
if (isChecking && !isConnected) return <LoadingPage />;
```

---

## 수정된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `spa/vite.config.ts` | `@huggingface/transformers` 의존성 추가 |
| `spa/src/lib/ai/engines/qwen3.ts` | ONNX 모델 경로 수정, q4 양자화 |
| `spa/src/App.tsx` | AppRoutes 조건부 렌더링 수정 |

---

## 추가 변경 (효과 없음)

staleTime 증가 시도:
- `spa/src/hooks/useImages.ts`: 30초 → 5분
- `spa/src/lib/query/client.ts`: 전역 staleTime 5분

→ 실제 원인은 React Query가 아니라 AppRoutes의 조건부 렌더링이었음
