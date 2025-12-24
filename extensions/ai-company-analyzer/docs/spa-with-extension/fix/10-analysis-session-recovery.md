# 분석 중단/재시도 기능

## 개요

### 문제 요약
현재 분석 세션 상태가 메모리에만 저장되어 페이지 새로고침이나 이탈 시 진행상황이 유실됩니다. 또한 실패한 이미지만 선택하여 재분석하는 기능이 없어, 일부 실패 시 전체를 다시 분석해야 합니다.

### 개선 목표
1. 분석 상태를 localStorage에 저장하여 세션 복구 지원
2. 실패한 이미지만 선택하여 재분석하는 버튼 추가
3. 백그라운드 분석 옵션 제공 (페이지 닫아도 계속)

---

## AS-IS (현재 상태)

### 현재 흐름

```
[분석 시작]
    ↓
[이미지 1 분석 중...]
    ↓
[페이지 새로고침 또는 이탈]
    ↓
[모든 진행상황 유실] ← 문제!
    ↓
[처음부터 다시 시작해야 함]
```

### 문제점

1. **진행상황 유실**
   - 10개 이미지 중 7개 완료 후 새로고침 → 처음부터 다시
   - 실수로 탭 닫으면 모든 진행상황 손실

2. **개별 재시도 불가**
   - 일부 이미지 분석 실패 시 실패한 것만 재분석 불가
   - 전체 분석을 다시 시작해야 함

3. **페이지 종속적**
   - Analysis 페이지를 떠나면 분석 중단
   - 다른 작업을 할 수 없음

### 관련 코드

#### 메모리 기반 초기 상태
**파일**: `spa/src/hooks/useAnalysisSession.ts:50-74`
```typescript
const INITIAL_STATE: AnalysisSessionState = {
  isRunning: false,
  progress: { step: 'idle', current: 0, total: 0, message: '분석 대기 중...' },
  results: [],
  completedImageIds: new Set(),
  failedImageIds: new Set(),  // 실패 이미지 추적은 하지만 재시도 불가
  synthesis: null,
  error: null,
  streaming: { ... },
  synthesisStreaming: { ... },
};
```

#### 분석 시작 시 상태 초기화
**파일**: `spa/src/hooks/useAnalysisSession.ts:278-297`
```typescript
// 분석 시작할 때마다 완전 초기화
setState({
  isRunning: true,
  progress: { step: 'idle', current: 0, total: 0, message: '분석 시작...' },
  results: [],
  completedImageIds: new Set(),
  failedImageIds: new Set(),
  synthesis: null,
  error: null,
  ...
});
```

#### 실패 이미지 추적 (재시도 없음)
**파일**: `spa/src/lib/analysis/orchestrator.ts:172`
```typescript
// 실패 이미지 ID는 추적하지만, 재시도 로직 없음
if (!result.success) {
  failedIds.add(imageId);
}
```

#### 중단 시 결과 저장
**파일**: `spa/src/hooks/useAnalysisSession.ts:175-184`
```typescript
if (abortSignal?.aborted) {
  const saveResult = await this.saveResults(results);
  return {
    results,
    synthesis: null,
    savedCount: saveResult.savedCount,
    failedCount: saveResult.failedCount,
  };
}
// 중단 시 현재까지 결과는 DB에 저장되지만, 세션 상태는 유실됨
```

---

## TO-BE (개선 후)

### 개선된 흐름

#### 세션 복구 흐름
```
[분석 시작] → [진행상황 localStorage에 저장]
    ↓
[페이지 새로고침]
    ↓
[복구 확인 다이얼로그]
    ├─ "이어서 분석" → 남은 이미지부터 계속
    └─ "처음부터" → 전체 재분석
```

#### 실패 재시도 흐름
```
[분석 완료: 8/10 성공, 2/10 실패]
    ↓
["실패한 이미지만 재분석" 버튼 클릭]
    ↓
[실패한 2개만 재분석]
```

### 구현 상세

#### 1. 세션 저장소 구조
```typescript
// spa/src/lib/analysis/session-storage.ts

interface StoredAnalysisSession {
  companyId: string;
  companyName: string;
  startedAt: string;  // ISO 날짜
  updatedAt: string;

  // 대상 이미지
  targetImageIds: string[];

  // 진행 상태
  completedImageIds: string[];
  failedImageIds: string[];

  // 결과 (분석 완료된 것만)
  results: Array<{
    imageId: string;
    success: boolean;
    analysis?: string;
    category?: string;
    rawText?: string;
  }>;

  // 종합 분석 (완료된 경우)
  synthesis: CompanyAnalysis | null;

  // 설정
  analysisContext?: string;
  selectedModel: string;
}

const SESSION_STORAGE_KEY = 'aca_analysis_session';

export function saveSession(session: StoredAnalysisSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function loadSession(): StoredAnalysisSession | null {
  const data = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!data) return null;
  return JSON.parse(data);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function hasActiveSession(companyId: string): boolean {
  const session = loadSession();
  return session?.companyId === companyId &&
         session.completedImageIds.length < session.targetImageIds.length;
}
```

#### 2. 세션 복구 컴포넌트
```typescript
// spa/src/components/analysis/SessionRecovery.tsx

interface SessionRecoveryProps {
  session: StoredAnalysisSession;
  onResume: () => void;
  onRestart: () => void;
  onDiscard: () => void;
}

export function SessionRecovery({
  session,
  onResume,
  onRestart,
  onDiscard,
}: SessionRecoveryProps) {
  const completed = session.completedImageIds.length;
  const total = session.targetImageIds.length;
  const failed = session.failedImageIds.length;

  return (
    <div className="p-6 border-2 border-blue-500 bg-blue-50 rounded-lg">
      <h3 className="text-lg font-medium text-blue-800">
        이전 분석 세션이 있습니다
      </h3>

      <div className="mt-4 space-y-2 text-sm text-blue-700">
        <p>회사: {session.companyName}</p>
        <p>진행: {completed}/{total} 완료 {failed > 0 && `(${failed}개 실패)`}</p>
        <p>시작: {new Date(session.startedAt).toLocaleString()}</p>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onResume}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          이어서 분석 ({total - completed}개 남음)
        </button>
        <button
          onClick={onRestart}
          className="px-4 py-2 border border-blue-500 text-blue-700 rounded hover:bg-blue-100"
        >
          처음부터
        </button>
        <button
          onClick={onDiscard}
          className="px-4 py-2 text-gray-500 hover:text-gray-700"
        >
          세션 삭제
        </button>
      </div>
    </div>
  );
}
```

#### 3. useAnalysisSession 확장
```typescript
// spa/src/hooks/useAnalysisSession.ts

export function useAnalysisSession() {
  // 기존 상태...
  const [recoverySession, setRecoverySession] = useState<StoredAnalysisSession | null>(null);

  // 페이지 로드 시 세션 복구 확인
  useEffect(() => {
    const session = loadSession();
    if (session && hasActiveSession(companyId)) {
      setRecoverySession(session);
    }
  }, [companyId]);

  // 분석 진행 시 세션 저장 (debounced)
  const saveSessionDebounced = useMemo(
    () => debounce((state: AnalysisSessionState) => {
      saveSession({
        companyId,
        companyName,
        startedAt: sessionStartTime,
        updatedAt: new Date().toISOString(),
        targetImageIds: state.targetImageIds,
        completedImageIds: Array.from(state.completedImageIds),
        failedImageIds: Array.from(state.failedImageIds),
        results: state.results,
        synthesis: state.synthesis,
        analysisContext,
        selectedModel,
      });
    }, 1000),
    [companyId, companyName, analysisContext, selectedModel]
  );

  // 상태 변경 시 세션 저장
  useEffect(() => {
    if (state.isRunning) {
      saveSessionDebounced(state);
    }
  }, [state, saveSessionDebounced]);

  // 세션에서 재개
  const resumeFromSession = useCallback(async () => {
    if (!recoverySession) return;

    const remainingImageIds = recoverySession.targetImageIds.filter(
      id => !recoverySession.completedImageIds.includes(id)
    );

    // 남은 이미지만 분석 시작
    await startAnalysis({
      companyId,
      companyName,
      imageIds: remainingImageIds,
      context: recoverySession.analysisContext,
    });

    setRecoverySession(null);
  }, [recoverySession, companyId, companyName]);

  // 실패한 이미지만 재분석
  const retryFailed = useCallback(async () => {
    const failedIds = Array.from(state.failedImageIds);
    if (failedIds.length === 0) return;

    await startAnalysis({
      companyId,
      companyName,
      imageIds: failedIds,
      context: analysisContext,
    });
  }, [state.failedImageIds, companyId, companyName, analysisContext]);

  // 분석 완료 시 세션 삭제
  const onAnalysisComplete = useCallback(() => {
    clearSession();
  }, []);

  return {
    ...state,
    recoverySession,
    resumeFromSession,
    retryFailed,
    clearRecoverySession: () => {
      clearSession();
      setRecoverySession(null);
    },
  };
}
```

#### 4. 실패 이미지 재분석 UI
```typescript
// spa/src/components/analysis/AnalysisProgress.tsx

function AnalysisProgress({ state, onRetryFailed }: AnalysisProgressProps) {
  const failedCount = state.failedImageIds.size;
  const isComplete = !state.isRunning && state.completedImageIds.size > 0;

  return (
    <div>
      {/* 기존 프로그래스 바... */}

      {/* 분석 완료 후 실패 이미지 재시도 */}
      {isComplete && failedCount > 0 && (
        <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-lg">
          <p className="text-red-700">
            {failedCount}개 이미지 분석 실패
          </p>
          <button
            onClick={onRetryFailed}
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            실패한 이미지만 재분석
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 5. 백그라운드 분석 (Service Worker 활용)
```typescript
// extension/src/background/analysis-worker.ts

interface BackgroundAnalysisRequest {
  companyId: string;
  imageIds: string[];
  model: string;
  context?: string;
}

// SPA에서 Extension으로 백그라운드 분석 요청
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_BACKGROUND_ANALYSIS') {
    startBackgroundAnalysis(message.payload as BackgroundAnalysisRequest);
    sendResponse({ success: true, message: '백그라운드 분석 시작' });
  }

  if (message.type === 'GET_BACKGROUND_ANALYSIS_STATUS') {
    sendResponse({
      success: true,
      status: getBackgroundAnalysisStatus(message.payload.companyId),
    });
  }
});

async function startBackgroundAnalysis(request: BackgroundAnalysisRequest) {
  // Extension의 Service Worker에서 Ollama API 호출
  // 진행상황은 IndexedDB에 저장
  // 완료 시 chrome.notifications로 알림
}
```

### UI/UX 변경사항

#### 세션 복구 다이얼로그
```
┌─────────────────────────────────────────┐
│ 📋 이전 분석 세션이 있습니다            │
├─────────────────────────────────────────┤
│ 회사: Naver                             │
│ 진행: 7/10 완료 (1개 실패)              │
│ 시작: 2024-01-15 14:30                  │
├─────────────────────────────────────────┤
│ [이어서 분석 (3개 남음)]  [처음부터]    │
│                          [세션 삭제]    │
└─────────────────────────────────────────┘
```

#### 실패 재시도 UI
```
┌─────────────────────────────────────────┐
│ 분석 완료                               │
├─────────────────────────────────────────┤
│ ✓ 성공: 8/10                            │
│ ✗ 실패: 2/10                            │
├─────────────────────────────────────────┤
│ ⚠️ 2개 이미지 분석 실패                 │
│                                         │
│ [실패한 이미지만 재분석]                │
└─────────────────────────────────────────┘
```

#### 백그라운드 분석 옵션
```
분석 설정:
┌─────────────────────────────────────────┐
│ □ 백그라운드에서 분석                   │
│   (페이지를 닫아도 분석이 계속됩니다)   │
└─────────────────────────────────────────┘
```

---

## 수정 대상 파일

| 파일 경로 | 변경 내용 |
|-----------|----------|
| `spa/src/lib/analysis/session-storage.ts` | (신규) 세션 저장/로드/삭제 함수 |
| `spa/src/hooks/useAnalysisSession.ts` | 세션 저장, 복구, 재시도 로직 추가 |
| `spa/src/pages/Analysis.tsx` | 세션 복구 UI 통합, 재시도 버튼 |
| `spa/src/components/analysis/SessionRecovery.tsx` | (신규) 세션 복구 컴포넌트 |
| `spa/src/components/analysis/AnalysisProgress.tsx` | 실패 재시도 버튼 추가 |
| `extension/src/background/analysis-worker.ts` | (신규, 선택) 백그라운드 분석 워커 |
| `shared/types/messages.ts` | 백그라운드 분석 메시지 타입 (선택) |

---

## 구현 체크리스트

### Phase 1: 세션 저장 기반
- [ ] `session-storage.ts` 파일 생성
- [ ] `StoredAnalysisSession` 타입 정의
- [ ] `saveSession`, `loadSession`, `clearSession` 함수 구현
- [ ] `hasActiveSession` 헬퍼 함수 구현

### Phase 2: 세션 복구 UI
- [ ] `SessionRecovery.tsx` 컴포넌트 생성
- [ ] Analysis 페이지 로드 시 세션 확인
- [ ] "이어서 분석" / "처음부터" / "삭제" 액션 구현
- [ ] 남은 이미지만 분석하는 로직

### Phase 3: 실패 재시도
- [ ] `useAnalysisSession`에 `retryFailed` 함수 추가
- [ ] `AnalysisProgress`에 재시도 버튼 추가
- [ ] 실패 이미지 ID 목록 관리

### Phase 4: 분석 중 세션 저장
- [ ] 진행상황 변경 시 debounce로 세션 저장
- [ ] 분석 완료 시 세션 삭제
- [ ] 중단 시 세션 유지

### Phase 5: 백그라운드 분석 (선택)
- [ ] Extension Service Worker에 분석 워커 추가
- [ ] SPA에서 백그라운드 분석 요청 메시지
- [ ] 진행상황 IndexedDB 저장
- [ ] 완료 시 알림

### Phase 6: 테스트
- [ ] 분석 중 새로고침 → 세션 복구 확인
- [ ] "이어서 분석" 클릭 → 남은 이미지만 분석 확인
- [ ] 실패 재시도 → 실패 이미지만 재분석 확인
- [ ] 분석 완료 → 세션 삭제 확인

---

## 참고사항

### localStorage 제한
- 최대 5MB (브라우저별 상이)
- 이미지 데이터는 저장하지 않음 (ID만 저장)
- 분석 결과 텍스트만 저장

### 백그라운드 분석 제약
- Service Worker는 5분 후 비활성화될 수 있음
- 장시간 분석은 주기적으로 깨우기 필요
- Ollama API 호출은 Extension 컨텍스트에서만 가능 (CORS)

### 데이터 일관성
- 세션 저장과 DB 저장은 별개
- 세션: 진행상황 추적용 (임시)
- DB: 최종 결과 저장용 (영구)
