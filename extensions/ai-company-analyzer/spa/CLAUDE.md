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
- OllamaContext: AI 설정

## Extension 통신
`src/lib/extension-client/client.ts`
- 싱글톤 패턴
- `getExtensionClient().send(type, payload)`

## AI 분석 흐름
`src/lib/analysis/orchestrator.ts`
1. 이미지 로드/최적화 (image-loader.ts)
2. 개별 분석 (image-analyzer.ts)
3. 종합 분석 (synthesis.ts)
4. 저장 (BATCH_SAVE_ANALYSIS)

## 스타일
Tailwind CSS - `src/styles/globals.css`
컴포넌트: clsx + tailwind-merge 패턴

## 환경변수
`VITE_EXTENSION_ID`: 익스텐션 ID (없으면 연결 실패)
