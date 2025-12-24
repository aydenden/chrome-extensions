# AI 기업분석 (SPA + Extension)

## 아키텍처

- **Extension**: 데이터 수집/저장 + AI 분석 (IndexedDB, Service Worker)
- **SPA**: UI 표시 + 분석 상태 구독 (GitHub Pages 배포)
- **통신**: Port 양방향 (`analysis-stream`) + External API 단방향

자세한 스펙은 `docs/spa-with-extension/spec/` 참조

## 문서

| 폴더 | 내용 |
|------|------|
| `docs/spa-with-extension/spec/` | 현재 아키텍처 스펙 |
| `docs/spa-with-extension/feature/` | 구현 체크리스트 |
| `docs/extension-only/` | 이전 아키텍처 문서 (참조용) |

## backup 폴더

`backup/extension-only/`에 이전 Extension-only 버전 코드 보관
- **참조용으로만 사용** (git에서 제외됨)
- 새 구현 시 로직 참고 가능
- 주요 파일: src/, e2e/, playwright.config.ts

## 테스트
```bash
cd extension && bun run test:run  # Extension
cd spa && bun run test:run        # SPA
```