# Extension 모듈

## 진입점
- `src/background/index.ts` - Service Worker (메시지 핸들링, 캡처)
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

스키마 변경 시 버전 업그레이드 필요

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
