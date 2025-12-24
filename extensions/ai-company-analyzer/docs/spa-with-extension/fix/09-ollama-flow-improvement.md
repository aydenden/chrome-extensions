# Ollama 미설치 시 분석 플로우 개선

## 개요

### 문제 요약
현재 AI 분석을 시작하려면 회사 카드 클릭 → 상세 페이지 → 분석 버튼 클릭의 과정을 거쳐야 하며, Ollama가 연결되지 않은 경우 별도의 안내 페이지로 이동합니다. 이 과정에서 불필요한 클릭과 페이지 전환이 발생합니다.

### 개선 목표
1. 회사 카드에서 바로 분석 시작 가능하도록 "빠른 분석" 버튼 추가
2. Ollama 미연결 시 별도 페이지 대신 인라인 안내 표시
3. 분석 버튼의 연결 상태를 시각적으로 명확히 구분

---

## AS-IS (현재 상태)

### 현재 흐름

```
[1단계] 회사 목록 페이지 (CompanyList.tsx)
    ↓ (회사 카드 클릭)
[2단계] 회사 상세 페이지 (CompanyDetail.tsx)
    ↓ ("AI 분석 시작" 버튼 클릭)
[3단계] Ollama 연결 확인
    ├─ 연결됨 → Analysis 페이지로 이동
    └─ 미연결 → OllamaRequired 페이지로 이동
```

### 문제점

1. **클릭 수 과다**
   - 분석 시작까지 최소 3번 클릭 필요
   - 회사 카드에서 바로 분석 불가

2. **페이지 전환 비효율**
   - Ollama 미연결 시 별도 페이지로 이동
   - 다시 돌아오려면 뒤로가기 필요

3. **연결 상태 파악 어려움**
   - 분석 버튼 클릭 전까지 Ollama 상태 모름
   - 헤더에 상태 표시되지만 눈에 잘 안 띔

### 관련 코드

#### CompanyCard - 분석 버튼 없음
**파일**: `spa/src/components/company/CompanyCard.tsx:20-87`
```typescript
export function CompanyCard({ company, onDelete }: CompanyCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      onClick={() => navigate(ROUTES.COMPANY_DETAIL(company.id))}  // 상세페이지로만 이동
      className="cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* 삭제 버튼만 존재 */}
      <button onClick={(e) => { e.stopPropagation(); onDelete(company.id); }}>
        삭제
      </button>
    </Card>
  );
}
```

#### CompanyDetail - 분석 버튼 및 Ollama 분기
**파일**: `spa/src/pages/CompanyDetail.tsx:24-35`
```typescript
const handleStartAnalysis = () => {
  if (!companyId) return;

  if (ollamaConnected) {
    navigate(ROUTES.ANALYSIS(companyId));  // 연결됨 → Analysis
  } else {
    navigate(ROUTES.OLLAMA_REQUIRED(companyId));  // 미연결 → 안내 페이지
  }
};
```

**파일**: `spa/src/pages/CompanyDetail.tsx:87-89`
```typescript
<Button variant="primary" onClick={handleStartAnalysis}>
  AI 분석 시작
</Button>
```

#### OllamaContext - 연결 상태 관리
**파일**: `spa/src/contexts/OllamaContext.tsx:19-27`
```typescript
interface OllamaState {
  isConnected: boolean;      // 연결 여부
  isChecking: boolean;       // 연결 확인 중
  error?: string;            // 에러 메시지
  endpoint: string;          // Ollama 서버 URL
  models: OllamaModel[];     // 사용 가능한 Vision 모델
  selectedModel: string | null;  // 선택된 모델
  isLoadingModels: boolean;  // 모델 로딩 중
}
```

#### 연결 확인 로직
**파일**: `spa/src/contexts/OllamaContext.tsx:75-102`
```typescript
const checkConnection = useCallback(async () => {
  setState(s => ({ ...s, isChecking: true }));
  try {
    const response = await fetch(state.endpoint);
    const text = await response.text();
    if (text.includes('Ollama is running')) {
      setState(s => ({ ...s, isConnected: true, isChecking: false }));
    }
  } catch {
    setState(s => ({ ...s, isConnected: false, error: '연결 실패' }));
  }
}, [state.endpoint]);
```

---

## TO-BE (개선 후)

### 개선된 흐름

#### 옵션 1: 회사 카드에서 빠른 분석
```
[1단계] 회사 목록 페이지
    ↓ (회사 카드의 "분석" 버튼 클릭)
[2단계] Ollama 연결됨 → Analysis 페이지로 바로 이동
```

#### 옵션 2: Ollama 미연결 시 인라인 안내
```
[1단계] 회사 상세 페이지
    ↓ ("AI 분석 시작" 버튼 클릭)
[2단계] 버튼 아래에 인라인 경고 + 재연결 버튼 표시
        (별도 페이지 이동 없음)
```

### 구현 상세

#### 1. CompanyCard에 분석 버튼 추가
```typescript
// spa/src/components/company/CompanyCard.tsx
export function CompanyCard({ company, onDelete }: CompanyCardProps) {
  const navigate = useNavigate();
  const { isConnected, isChecking } = useOllama();

  const handleAnalyze = (e: React.MouseEvent) => {
    e.stopPropagation();  // 카드 클릭 이벤트 전파 방지
    if (isConnected) {
      navigate(ROUTES.ANALYSIS(company.id));
    }
  };

  return (
    <Card onClick={() => navigate(ROUTES.COMPANY_DETAIL(company.id))}>
      {/* ... 기존 내용 ... */}

      <div className="flex gap-2">
        {/* 빠른 분석 버튼 */}
        <button
          onClick={handleAnalyze}
          disabled={!isConnected || isChecking}
          className={cn(
            "px-3 py-1 rounded text-sm",
            isConnected
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
          title={!isConnected ? "Ollama 연결 필요" : "AI 분석 시작"}
        >
          {isChecking ? "확인중..." : "분석"}
        </button>

        {/* 삭제 버튼 */}
        <button onClick={...}>삭제</button>
      </div>
    </Card>
  );
}
```

#### 2. 분석 버튼 상태 시각화
```typescript
// 버튼 상태별 스타일
const analysisButtonStyles = {
  connected: "bg-blue-500 text-white hover:bg-blue-600",
  disconnected: "bg-gray-200 text-gray-400 cursor-not-allowed",
  checking: "bg-gray-300 text-gray-500 animate-pulse",
};

// 상태별 아이콘
const StatusIcon = ({ status }: { status: 'connected' | 'disconnected' | 'checking' }) => {
  switch (status) {
    case 'connected':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'disconnected':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'checking':
      return <Loader className="w-4 h-4 text-gray-400 animate-spin" />;
  }
};
```

#### 3. 인라인 Ollama 안내 컴포넌트
```typescript
// spa/src/components/analysis/OllamaInlineWarning.tsx
interface OllamaInlineWarningProps {
  onRetry: () => void;
  isRetrying: boolean;
}

export function OllamaInlineWarning({ onRetry, isRetrying }: OllamaInlineWarningProps) {
  return (
    <div className="mt-4 p-4 border-2 border-amber-400 bg-amber-50 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-amber-800">Ollama 연결 필요</h4>
          <p className="text-sm text-amber-700 mt-1">
            AI 분석을 위해 Ollama가 실행 중이어야 합니다.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="px-3 py-1.5 bg-amber-500 text-white rounded text-sm hover:bg-amber-600"
            >
              {isRetrying ? "확인 중..." : "재연결 시도"}
            </button>
            <a
              href="https://ollama.ai/download"
              target="_blank"
              rel="noopener"
              className="px-3 py-1.5 border border-amber-500 text-amber-700 rounded text-sm hover:bg-amber-100"
            >
              Ollama 설치 안내
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 4. CompanyDetail에서 인라인 안내 사용
```typescript
// spa/src/pages/CompanyDetail.tsx
export function CompanyDetail() {
  const { isConnected, isChecking, checkConnection } = useOllama();
  const [showWarning, setShowWarning] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleStartAnalysis = () => {
    if (isConnected) {
      navigate(ROUTES.ANALYSIS(companyId));
    } else {
      setShowWarning(true);  // 페이지 이동 대신 인라인 경고 표시
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkConnection();
    setIsRetrying(false);

    if (isConnected) {
      setShowWarning(false);
      navigate(ROUTES.ANALYSIS(companyId));
    }
  };

  return (
    <div>
      {/* 분석 버튼 */}
      <Button
        onClick={handleStartAnalysis}
        disabled={isChecking}
        className={isConnected ? "" : "opacity-70"}
      >
        {isChecking ? "연결 확인 중..." : "AI 분석 시작"}
        {!isConnected && !isChecking && (
          <span className="ml-2 text-xs">(Ollama 필요)</span>
        )}
      </Button>

      {/* 인라인 경고 */}
      {showWarning && !isConnected && (
        <OllamaInlineWarning onRetry={handleRetry} isRetrying={isRetrying} />
      )}
    </div>
  );
}
```

### UI/UX 변경사항

#### 회사 카드 변경
```
기존:
┌─────────────────────────────┐
│ Naver                       │
│ ◯ Wanted  ◯ 이미지 5개     │
│                    [삭제]   │
└─────────────────────────────┘

개선 후:
┌─────────────────────────────┐
│ Naver                       │
│ ◯ Wanted  ◯ 이미지 5개     │
│           [분석] [삭제]     │  ← 분석 버튼 추가
└─────────────────────────────┘

분석 버튼 상태:
- 연결됨: 파란색 활성화
- 미연결: 회색 비활성화 + 툴팁 "Ollama 연결 필요"
- 확인중: 회색 + "확인중..." 텍스트
```

#### 상세 페이지 인라인 경고
```
┌─────────────────────────────────────────┐
│ Naver 회사 상세                          │
├─────────────────────────────────────────┤
│ [AI 분석 시작]                          │
│                                          │
│ ┌─ ⚠️ Ollama 연결 필요 ───────────────┐ │
│ │ AI 분석을 위해 Ollama가 실행 중이어야│ │
│ │ 합니다.                              │ │
│ │                                      │ │
│ │ [재연결 시도]  [Ollama 설치 안내]    │ │
│ └──────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 수정 대상 파일

| 파일 경로 | 변경 내용 |
|-----------|----------|
| `spa/src/components/company/CompanyCard.tsx` | "분석" 버튼 추가, Ollama 상태에 따른 활성화/비활성화 |
| `spa/src/pages/CompanyDetail.tsx` | 인라인 경고 표시 로직, 페이지 이동 대신 인라인 안내 |
| `spa/src/components/analysis/OllamaInlineWarning.tsx` | (신규) 인라인 Ollama 안내 컴포넌트 |
| `spa/src/contexts/OllamaContext.tsx` | checkConnection 함수 export (이미 되어 있음, 확인만) |

---

## 구현 체크리스트

### Phase 1: CompanyCard 분석 버튼
- [ ] CompanyCard에 "분석" 버튼 추가
- [ ] useOllama 훅으로 연결 상태 가져오기
- [ ] 연결 상태별 버튼 스타일 적용
- [ ] 비활성화 상태일 때 툴팁 표시

### Phase 2: 인라인 경고 컴포넌트
- [ ] `OllamaInlineWarning.tsx` 컴포넌트 생성
- [ ] 재연결 시도 버튼 구현
- [ ] Ollama 설치 안내 링크 추가

### Phase 3: CompanyDetail 통합
- [ ] 기존 페이지 이동 로직을 인라인 경고로 변경
- [ ] 재연결 성공 시 자동으로 Analysis 페이지 이동
- [ ] showWarning 상태 관리

### Phase 4: 테스트
- [ ] Ollama 연결 상태에서 카드 분석 버튼 클릭
- [ ] Ollama 미연결 상태에서 카드 분석 버튼 비활성화 확인
- [ ] 상세 페이지에서 인라인 경고 표시 확인
- [ ] 재연결 시도 후 자동 이동 확인

---

## 참고사항

### 기존 OllamaRequired 페이지
- 삭제하지 않음 (직접 URL 접근 시 사용)
- 점진적으로 인라인 경고로 대체

### 접근성
- 비활성화 버튼에 `title` 속성으로 이유 표시
- 색상만이 아닌 텍스트로도 상태 구분
