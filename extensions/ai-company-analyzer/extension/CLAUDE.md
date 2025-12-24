# Extension 모듈

## 진입점
- `src/background/index.ts` - Service Worker (메시지 핸들링, 캡처)
- `src/background/analysis-manager.ts` - AI 분석 세션 관리
- `src/background/analysis-port.ts` - SPA와 Port 통신
- `src/content/index.ts` - Content Script (페이지 스크래핑, 영역 선택)
- `src/popup/index.tsx` - Popup UI

## 빌드
두 개의 설정으로 빌드:
```bash
vite build                              # background + popup
vite build -c vite.content.config.ts    # content script
```

## DB 스키마
`src/lib/db.ts` - Dexie IndexedDB
- Company: 회사 정보
- StoredImage: 캡처 이미지
- AnalysisSession: 분석 세션 (진행상황, 중간결과)
- OllamaSettings: Ollama 설정

스키마 변경 시 버전 업그레이드 필요

## AI 분석 엔진
- `src/background/analysis-manager.ts` - 분석 세션 생성/복구, Ollama 호출, 스트리밍
- `src/background/analysis-port.ts` - Port 통신 (`analysis-stream`)
- `src/lib/ai/` - Ollama 클라이언트, 스트림 파서

## SPA 통신
`src/background/external-api.ts`
- onMessageExternal 리스너
- 허용 출처: github.io, localhost:5173
- 핸들러: company-handlers, image-handlers, analysis-handlers

## MV3 제약
- Service Worker는 상태 유지 불가 (IndexedDB 사용)
- Background에서 DOM 접근 불가 (Content Script로 위임)

## 타입
shared 모듈에서 import:
```typescript
import type { MessageType } from '@shared/types';
```
