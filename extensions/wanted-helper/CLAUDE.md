# CLAUDE.md

## 프로젝트 개요
Wanted Helper - 원티드 사이트(wanted.co.kr)에서 관심 없는 회사/채용 공고를 관리하는 Chrome 확장 프로그램

## 빌드 및 테스트
```bash
npm run build    # TypeScript 컴파일 → dist/
npm run dev      # Watch 모드
```

**테스트 방법:**
1. `npm run build` 실행
2. `chrome://extensions/` → 개발자 모드 → 압축해제된 확장 프로그램 로드
3. 원티드 사이트에서 테스트
4. 코드 변경 시: 빌드 → 확장 프로그램 새로고침 → 페이지 새로고침

## 파일 구조
- `src/index.ts` - 단일 Content Script (모든 로직 포함)
- `manifest.json` - 확장 프로그램 설정
- `dist/index.js` - 빌드 결과물

## 개발 시 주의사항
- 원티드 사이트의 DOM 구조에 의존 → 사이트 업데이트 시 선택자 수정 필요할 수 있음
- MutationObserver로 Next.js 클라이언트 라우팅 감지 → debounce(100ms) 적용됨
- Chrome Storage Sync API 사용 (키: `companyIds`, `positionIds`)
