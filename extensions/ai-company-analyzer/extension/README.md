# AI Company Analyzer - Chrome Extension

Chrome Extension 프로젝트 (데이터 수집 및 저장)

## 개발

```bash
# 의존성 설치
bun install

# 개발 모드 (watch)
bun run dev

# 프로덕션 빌드
bun run build
```

## Chrome에서 테스트

1. `bun run build` 실행
2. Chrome에서 `chrome://extensions/` 열기
3. 개발자 모드 활성화
4. "압축해제된 확장 프로그램을 로드합니다" 클릭
5. `dist/` 폴더 선택

## 빌드 결과물

빌드 후 `dist/` 폴더에 다음 파일들이 생성됩니다:

- `manifest.json` - Extension 설정
- `background.js` - Service Worker
- `content.js` - Content Script
- `popup.html` - Popup UI HTML
- `popup.js` - Popup UI 번들
- `icons/` - Extension 아이콘들

## 프로젝트 구조

```
extension/
├── src/
│   ├── background/    # Service Worker
│   ├── content/       # Content Scripts
│   └── popup/         # Popup UI (React)
├── icons/             # Extension 아이콘
├── manifest.json      # Manifest V3 설정
└── vite.config.ts     # Vite 빌드 설정
```

---
*Last updated: 2024-12-24*
