# Extension Service Worker 기반 백그라운드 분석

## 개요

### 문제 요약
현재 AI 분석은 SPA 페이지에서 직접 Ollama를 호출하여 진행됩니다. 이로 인해:
1. 페이지 이탈/새로고침 시 분석이 중단되고 진행상황이 유실됨
2. 분석 중 다른 작업을 할 수 없음
3. GitHub Pages 배포 시 CORS 설정(OLLAMA_ORIGINS)이 필요함

### 개선 목표
1. 페이지 이탈해도 분석 계속 진행 (Extension Service Worker에서 실행)
2. 분석 세션 저장/복구 지원 (IndexedDB)
3. 실시간 스트리밍 UI 유지 (chrome.runtime.connect Port 통신)
4. CORS 설정 불필요 (Extension의 host_permissions 활용)

---

## AS-IS (현재 상태)

### 현재 흐름

```
SPA (Analysis 페이지)
  │
  ├─ OllamaContext
  │   └─ fetch → localhost:11434 (직접 호출)
  │
  ├─ useAnalysisSession
  │   └─ orchestrator.ts → 분석 오케스트레이션
  │
  └─ AnalysisProgress
      └─ 스트리밍 UI 표시

페이지 이탈 시 → 모든 상태 유실, 분석 중단
```

### 문제점

| 문제 | 설명 |
|------|------|
| **진행상황 유실** | 10개 중 7개 완료 후 새로고침 → 처음부터 다시 |
| **페이지 종속적** | Analysis 페이지를 떠나면 분석 중단 |
| **CORS 필요** | GitHub Pages 배포 시 OLLAMA_ORIGINS 환경변수 설정 필요 |
| **개별 재시도 불가** | 일부 실패 시 전체 재분석 필요 |

---

## TO-BE (개선 후)

### 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│  Extension Service Worker                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  AnalysisManager (신규)                                    │  │
│  │  ├─ state: { companyId, status, progress, results }       │  │
│  │  ├─ ollamaClient: fetch → localhost:11434 (CORS 우회)     │  │
│  │  ├─ sessionStore: IndexedDB 저장/복구                      │  │
│  │  └─ ports: Map<portId, Port> (연결된 SPA 탭들)            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  기존 External API (유지)                                  │  │
│  │  - GET_COMPANIES, GET_IMAGES, SAVE_ANALYSIS 등            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
              ↑                              ↑
              │ Port (양방향)                │ sendMessage (단방향)
              ↓                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  SPA                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ AnalysisContext │  │ ExtensionContext│  │ OllamaContext   │  │
│  │ (신규)          │  │ (기존 유지)     │  │ (단순화)        │  │
│  │ - Port 관리     │  │ - PING, 데이터  │  │ - 상태만 표시   │  │
│  │ - 스트림 수신   │  │   조회/저장     │  │ - 호출은 Ext로  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 개선된 흐름

```
[분석 시작]
    ↓
SPA: AnalysisContext → Port 연결 → START_ANALYSIS 전송
    ↓
Extension SW: AnalysisManager
    ├─ 세션 생성 (IndexedDB 저장)
    ├─ 이미지별 분석 (Ollama 스트리밍)
    │   └─ STREAM_CHUNK 이벤트 브로드캐스트
    └─ 종합 분석 → COMPLETE
    ↓
[페이지 이탈]
    ↓
Extension SW: 분석 계속 진행 (Port 끊김, 브로드캐스트 대상 없음)
    ↓
[페이지 재진입]
    ↓
SPA: Port 재연결 → STATUS 수신 → 진행 상황 표시
```

---

## 구현 상세

### 1. Port 통신 프로토콜

```typescript
// shared/types/analysis-port.ts

// SPA → Extension (명령)
type AnalysisCommand =
  | { type: 'START_ANALYSIS'; payload: StartAnalysisPayload }
  | { type: 'ABORT_ANALYSIS' }
  | { type: 'GET_STATUS' }
  | { type: 'RETRY_FAILED' };

interface StartAnalysisPayload {
  companyId: string;
  companyName: string;
  imageIds: string[];
  model: string;
  context?: string;
  prompts?: PromptSettings;
}

// Extension → SPA (이벤트)
type AnalysisEvent =
  | { type: 'STATUS'; payload: AnalysisStatus }
  | { type: 'STREAM_CHUNK'; payload: StreamChunkPayload }
  | { type: 'IMAGE_COMPLETE'; payload: ImageCompletePayload }
  | { type: 'SYNTHESIS_START' }
  | { type: 'COMPLETE'; payload: AnalysisResult }
  | { type: 'ERROR'; payload: { message: string; recoverable: boolean } };

interface StreamChunkPayload {
  imageId: string | null;  // null이면 synthesis
  chunk: StreamChunk;      // 기존 타입 재사용
}

interface AnalysisStatus {
  isRunning: boolean;
  companyId: string | null;
  progress: { current: number; total: number; step: string };
  completedIds: string[];
  failedIds: string[];
}
```

### 2. 연결 흐름

```
SPA                              Extension SW
─────────────────────────────────────────────────
1. connect('analysis')  ──────→  onConnect
2.                      ←──────  STATUS (현재 상태)
3. START_ANALYSIS       ──────→  분석 시작
4.                      ←──────  STREAM_CHUNK (반복)
5.                      ←──────  IMAGE_COMPLETE
6.                      ←──────  SYNTHESIS_START
7.                      ←──────  STREAM_CHUNK (반복)
8.                      ←──────  COMPLETE
9. disconnect           ──────→  Port 정리 (분석은 계속)
```

### 3. IndexedDB 스키마 확장

```typescript
// extension/src/db/schema.ts

interface AnalysisSession {
  id: string;                    // companyId (PK, 1개만 분석 가능)
  companyName: string;

  // 진행 상태
  status: 'running' | 'paused' | 'completed' | 'failed';
  startedAt: string;             // ISO
  updatedAt: string;             // ISO

  // 대상 및 진행
  targetImageIds: string[];
  completedImageIds: string[];
  failedImageIds: string[];
  currentImageId: string | null;

  // 설정
  model: string;
  context?: string;
  prompts?: PromptSettings;

  // 중간 결과
  results: Array<{
    imageId: string;
    category: string;
    rawText: string;
    analysis: string;
  }>;

  // 종합 분석
  synthesis: CompanyAnalysis | null;
}

// Dexie 스키마
db.version(X).stores({
  companies: '++id, name, siteType, createdAt',
  images: '++id, companyId, category',
  analysisSessions: 'id, status, updatedAt',  // 신규
  ollamaSettings: 'id',                        // 신규
});
```

### 4. Extension AnalysisManager

```typescript
// extension/src/background/analysis/analysis-manager.ts

class AnalysisManager {
  private session: AnalysisSession | null = null;
  private ports: Map<string, chrome.runtime.Port> = new Map();
  private abortController: AbortController | null = null;

  handleConnect(port: chrome.runtime.Port) {
    this.ports.set(port.name, port);
    port.onDisconnect.addListener(() => this.ports.delete(port.name));
    port.onMessage.addListener((msg) => this.handleCommand(port, msg));
    this.broadcastStatus();
  }

  private async handleCommand(port: Port, cmd: AnalysisCommand) {
    switch (cmd.type) {
      case 'START_ANALYSIS':
        await this.startAnalysis(cmd.payload);
        break;
      case 'ABORT_ANALYSIS':
        this.abortAnalysis();
        break;
      case 'GET_STATUS':
        port.postMessage({ type: 'STATUS', payload: this.getStatus() });
        break;
      case 'RETRY_FAILED':
        await this.retryFailed();
        break;
    }
  }

  private broadcast(event: AnalysisEvent) {
    this.ports.forEach(port => port.postMessage(event));
  }

  private async startAnalysis(payload: StartAnalysisPayload) {
    // 1. 세션 생성 및 IndexedDB 저장
    // 2. 이미지별 순차 분석 (Ollama 스트리밍)
    //    - STREAM_CHUNK 브로드캐스트
    //    - IMAGE_COMPLETE 브로드캐스트
    //    - 세션 업데이트
    // 3. 종합 분석
    // 4. 결과 저장 및 COMPLETE
  }
}

export const analysisManager = new AnalysisManager();
```

### 5. Ollama 설정 동기화

```typescript
// shared/types/messages.ts 추가

type MessageType =
  | ... 기존 ...
  | 'GET_OLLAMA_SETTINGS'
  | 'SET_OLLAMA_SETTINGS';

interface MessagePayload {
  GET_OLLAMA_SETTINGS: void;
  SET_OLLAMA_SETTINGS: {
    endpoint: string;      // "localhost:11434"
    selectedModel: string;
  };
}
```

### 6. SPA 설정 UI (localhost 검증)

```typescript
// spa/src/pages/Settings.tsx

const validateEndpoint = (value: string): boolean => {
  // localhost 또는 127.0.0.1만 허용
  const pattern = /^(localhost|127\.0\.0\.1)(:\d+)?$/;
  return pattern.test(value);
};
```

---

## 코드 정리

### SPA에서 제거되는 코드 (Extension으로 이관)

```
spa/src/lib/ai/
├─ stream-parser.ts      → extension/src/background/analysis/
├─ types.ts (일부)       → shared/types/analysis.ts
└─ 기타 Ollama 호출 로직

spa/src/contexts/OllamaContext.tsx
├─ chatStream()          ❌ 제거
├─ analyzeImageStream()  ❌ 제거
├─ chat()                ❌ 제거
└─ 연결 상태 관리        ✅ 유지 (단순화)

spa/src/lib/analysis/
├─ orchestrator.ts       ❌ 제거
└─ synthesis.ts          → extension/src/background/analysis/

spa/src/hooks/
└─ useAnalysisSession.ts ❌ 제거 (AnalysisContext로 대체)
```

### SPA에 남는 것

```typescript
// spa/src/contexts/OllamaContext.tsx (단순화)
interface OllamaState {
  isConnected: boolean;
  endpoint: string;
  models: OllamaModel[];
  selectedModel: string | null;
}
// 실제 호출은 Extension이 담당

// spa/src/contexts/AnalysisContext.tsx (신규)
interface AnalysisContextValue {
  status: AnalysisStatus;
  streaming: StreamingState;
  synthesisStreaming: SynthesisStreamingState;
  startAnalysis: (payload: StartAnalysisPayload) => void;
  abortAnalysis: () => void;
  retryFailed: () => void;
}
// Port 연결 및 이벤트 수신 담당
```

---

## 수정 대상 파일

### Phase 1: Port 통신 인프라

| 파일 | 작업 |
|------|------|
| `shared/types/analysis-port.ts` | 신규 - Command/Event 타입 정의 |
| `extension/src/background/index.ts` | 수정 - Port 연결 리스너 추가 |
| `extension/manifest.json` | 수정 - host_permissions 추가 |
| `spa/src/lib/extension-client/port-handler.ts` | 신규 - Port 연결 관리 |

### Phase 2: Extension 분석 엔진

| 파일 | 작업 |
|------|------|
| `extension/src/background/analysis/analysis-manager.ts` | 신규 |
| `extension/src/background/analysis/ollama-client.ts` | 신규 (SPA에서 이관) |
| `extension/src/background/analysis/stream-parser.ts` | 신규 (SPA에서 이관) |
| `extension/src/background/analysis/synthesis.ts` | 신규 (SPA에서 이관) |
| `extension/src/db/schema.ts` | 수정 - analysisSessions, ollamaSettings 테이블 |

### Phase 3: SPA 연동

| 파일 | 작업 |
|------|------|
| `spa/src/contexts/AnalysisContext.tsx` | 신규 |
| `spa/src/contexts/OllamaContext.tsx` | 수정 (단순화) |
| `spa/src/hooks/useAnalysisSession.ts` | 삭제 |
| `spa/src/lib/analysis/orchestrator.ts` | 삭제 |
| `spa/src/lib/ai/` | 삭제 |

### Phase 4: 설정 동기화

| 파일 | 작업 |
|------|------|
| `shared/types/messages.ts` | 수정 - GET/SET_OLLAMA_SETTINGS |
| `extension/src/background/settings-handlers.ts` | 수정 |
| `spa/src/pages/Settings.tsx` | 수정 - localhost 유효성 검사 |

### Phase 5: UI 개선

| 파일 | 작업 |
|------|------|
| `spa/src/components/company/CompanyCard.tsx` | 수정 - "분석 중" 라벨 |
| `spa/src/components/layout/Header.tsx` | 수정 - 전역 분석 상태 표시 |
| `spa/src/components/analysis/SessionRecovery.tsx` | 신규 |
| `spa/src/pages/Analysis.tsx` | 수정 - AnalysisContext 사용 |

---

## 구현 체크리스트

### Phase 1: Port 통신 인프라
- [ ] `analysis-port.ts` 타입 정의
- [ ] Extension Port 리스너 구현
- [ ] manifest.json host_permissions 추가
- [ ] SPA port-handler 구현

### Phase 2: Extension 분석 엔진
- [ ] AnalysisManager 클래스 구현
- [ ] ollama-client (스트리밍 fetch) 이관
- [ ] stream-parser 이관
- [ ] synthesis 이관
- [ ] IndexedDB 스키마 확장

### Phase 3: SPA 연동
- [ ] AnalysisContext 구현
- [ ] OllamaContext 단순화
- [ ] 기존 분석 코드 제거
- [ ] Analysis 페이지 AnalysisContext 연결

### Phase 4: 설정 동기화
- [ ] 메시지 타입 추가
- [ ] Extension 설정 핸들러
- [ ] SPA 설정 UI localhost 검증

### Phase 5: UI 개선
- [ ] CompanyCard "분석 중" 라벨
- [ ] Header 전역 상태 표시
- [ ] SessionRecovery 컴포넌트
- [ ] 실패 재시도 UI

---

## 제약 사항

### host_permissions
- `localhost:*` 및 `127.0.0.1:*`만 허용
- 원격 Ollama 서버 지원 안 함 (향후 optional_host_permissions로 확장 가능)

### 동시 분석
- 1개 회사만 분석 가능 (리소스 제약)
- 다른 회사 분석 시작 시 기존 분석 중단 확인 필요

### Service Worker 생명주기
- Chrome이 SW를 5분 후 비활성화할 수 있음
- 장시간 분석 시 주기적 활동 필요 (IndexedDB 저장으로 복구 보장)

---

## 참고: 기존 문서와의 관계

| 문서 | 상태 |
|------|------|
| `09-ollama-flow-improvement.md` | 대체됨 - 이 아키텍처로 자연스럽게 해결 |
| `10-analysis-session-recovery.md` | 통합됨 - 세션 복구 기능 포함 |
