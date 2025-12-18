# 화면 캡처 기능 이슈 수정

## 개요
익스텐션 팝업에서 "화면 캡처" 버튼 클릭 시 발생한 여러 오류들을 수정하고, 전체 화면 캡처에서 영역 선택 캡처로 기능을 변경했습니다.

## 수정된 이슈 목록

### 이슈 1: URL 패턴 불일치
**증상**: "Could not establish connection. Receiving end does not exist." 오류

**원인**: `sites.ts`의 URL 패턴이 `www.` 서브도메인을 포함하지 않음

**수정**:
```typescript
// Before
urlPattern: /wanted\.co\.kr\/company\/\d+/,

// After
urlPattern: /(www\.)?wanted\.co\.kr\/company\/\d+/,
```

**파일**: `extension/src/lib/sites.ts`

---

### 이슈 2: Content Script ES 모듈 import 오류
**증상**: Content Script가 로드되지 않음

**원인**:
- Content Script가 ES 모듈로 빌드됨
- `import{...}from"./chunks/sites-xxx.js"` 형태로 상대 경로 사용
- 브라우저가 이를 현재 페이지 URL 기준으로 resolve → `https://wanted.co.kr/chunks/...` 404

**수정**:
- `vite.content.config.ts` 생성하여 Content Script를 IIFE 형식으로 별도 빌드
- `manifest.json`에서 `"type": "module"` 제거

**파일**:
- `extension/vite.content.config.ts` (신규)
- `extension/manifest.json`
- `extension/package.json` (build 스크립트 수정)

---

### 이슈 3: process is not defined
**증상**: `Uncaught ReferenceError: process is not defined`

**원인**: React 라이브러리가 `process.env.NODE_ENV`를 참조하지만, 브라우저에는 `process` 전역 변수가 없음

**수정**:
```typescript
// vite.content.config.ts
export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  // ...
});
```

**파일**: `extension/vite.content.config.ts`

---

### 이슈 4: DB 스키마 url 인덱스 누락
**증상**: `SchemaError: KeyPath url on object store companies is not indexed`

**원인**: `capture-service.ts`에서 `db.companies.where('url').equals(...)`를 사용하지만 `url`이 인덱스로 정의되지 않음

**수정**:
```typescript
// Before
this.version(1).stores({
  companies: 'id, name, siteType, createdAt, updatedAt',
  // ...
});

// After
this.version(2).stores({
  companies: 'id, name, url, siteType, createdAt, updatedAt',
  // ...
});
```

**파일**: `extension/src/lib/db.ts`

---

### 이슈 5: captureVisibleTab windowId 미전달
**증상**: 캡처 버튼 클릭 후 아무 동작 없음

**원인**: `captureVisibleTab(undefined, ...)` 호출로 인해 캡처 실패

**수정**:
- `sender.tab?.windowId`를 함께 전달
- `captureFullScreen(windowId)` 형태로 변경

**파일**:
- `extension/src/background/index.ts`
- `extension/src/background/capture-service.ts`

---

### 이슈 6: 전체 화면 캡처 → 영역 선택 캡처
**증상**: 화면 전체가 캡처되어 불필요한 영역 포함

**변경 내용**:
기존 백업 코드(`graph-capture.ts`)를 참고하여 영역 선택 캡처 기능 구현

**새로운 흐름**:
```
Popup → TRIGGER_CAPTURE → Content Script → 영역 선택 UI 표시
                                    ↓
                            사용자가 드래그로 영역 선택
                                    ↓
                            CAPTURE_AREA (좌표 포함) → Background
                                    ↓
                            전체 화면 캡처 → 좌표로 crop → AREA_CAPTURED
                                    ↓
                            Content Script → Confirm Popup 표시 → 저장
```

**구현 내용**:
- Shadow DOM 오버레이 (crosshair 커서)
- 선택 박스 (dashed border)
- 안내 메시지
- `devicePixelRatio` 적용
- ESC 키로 취소

**파일**:
- `extension/src/content/area-capture.ts` (신규)
- `extension/src/content/index.ts` (수정)
- `extension/src/background/index.ts` (CAPTURE_AREA 핸들러 추가)

---

## 메시지 타입

| 메시지 | 발신 | 수신 | 설명 |
|--------|------|------|------|
| `TRIGGER_CAPTURE` | Popup | Content | 캡처 시작 요청 |
| `CAPTURE_AREA` | Content | Background | 선택 영역 좌표 전송 |
| `AREA_CAPTURED` | Background | Content | crop된 이미지 전송 |
| `CAPTURE_REGION` | Content | Background | 이미지 저장 요청 |

## 수정된 파일 요약

| 파일 | 작업 |
|------|------|
| `extension/src/lib/sites.ts` | URL 패턴에 `(www\.)?` 추가 |
| `extension/vite.content.config.ts` | Content Script IIFE 빌드 설정 |
| `extension/manifest.json` | `"type": "module"` 제거 |
| `extension/package.json` | build 스크립트 수정 |
| `extension/src/lib/db.ts` | `url` 인덱스 추가, 버전 2로 업그레이드 |
| `extension/src/background/capture-service.ts` | `windowId` 파라미터 추가 |
| `extension/src/background/index.ts` | `windowId` 전달, `CAPTURE_AREA` 핸들러 |
| `extension/src/content/area-capture.ts` | 영역 선택 UI (신규) |
| `extension/src/content/index.ts` | 메시지 핸들러 변경 |
| `extension/src/content/scraper.ts` | `siteType` 타입 수정 |
