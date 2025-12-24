# SPA 모듈

## 진입점
- `src/main.tsx` - Extension Client 초기화 + React 마운트
- `src/App.tsx` - Router + Provider 설정

## 라우팅 (`src/lib/routes.ts`)
```
/                     → CompanyList
/company/:companyId   → CompanyDetail
/analysis/:companyId  → Analysis (AI 분석)
/settings             → Settings
```

## 상태 관리
- React Query: 서버 데이터 (회사, 이미지)
- ExtensionContext: 연결 상태
- OllamaContext: Ollama 연결 상태 표시
- AnalysisContext: 분석 상태 관리 (Port 통신)

## Extension 통신
`src/lib/extension-client/client.ts`
- 싱글톤 패턴
- `getExtensionClient().send(type, payload)`

## AI 분석 흐름
분석은 Extension에서 실행 (SPA는 UI만 담당)
- `src/contexts/AnalysisContext.tsx` - Port 연결, 이벤트 구독
- `src/lib/analysis-port/connection.ts` - Port 연결 관리
- 명령: START_ANALYSIS, ABORT_ANALYSIS, GET_STATUS, RETRY_FAILED
- 이벤트: STATUS, STREAM_CHUNK, IMAGE_COMPLETE, COMPLETE, ERROR

## 스타일
Tailwind CSS - `src/styles/globals.css`
컴포넌트: clsx + tailwind-merge 패턴

## 환경변수
`VITE_EXTENSION_ID`: 익스텐션 ID (없으면 연결 실패)

## 테스트
```bash
bun run test:run
```
