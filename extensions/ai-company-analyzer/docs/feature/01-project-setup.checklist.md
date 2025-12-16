# 01. 프로젝트 설정 - 체크리스트

## 파일 생성
- [x] `package.json` 생성
- [x] `tsconfig.json` 생성
- [x] `vite.config.ts` 생성
- [x] `manifest.json` 생성

## 디렉토리 구조
- [x] `src/popup/` 디렉토리 생성
- [x] `src/pages/` 디렉토리 생성
- [x] `src/content/` 디렉토리 생성
- [x] `src/background/` 디렉토리 생성
- [x] `src/lib/` 디렉토리 생성
- [x] `src/types/` 디렉토리 생성
- [x] `assets/` 디렉토리 생성

## 기본 파일
- [x] `src/popup/popup.html` 생성
- [x] `src/popup/Popup.tsx` 생성
- [x] `src/popup/popup.css` 생성
- [x] `src/background/index.ts` 생성
- [x] `src/content/index.ts` 생성

## 아이콘
- [x] `assets/icon16.png` 생성
- [x] `assets/icon48.png` 생성
- [x] `assets/icon128.png` 생성

## 루트 설정
- [x] 루트 `package.json`에 빌드 스크립트 추가

## 의존성 설치
- [x] `bun install` 실행

## 빌드 테스트
- [x] `bun run build` 성공
- [x] `dist/` 폴더 생성 확인

## Chrome 테스트
- [ ] `chrome://extensions/`에서 로드 성공
- [ ] 팝업 표시 확인
- [ ] 콘솔 에러 없음 확인
- [ ] Content Script 로드 확인 (지원 사이트에서)

## 완료 조건
- [x] 모든 파일 생성 완료
- [x] 빌드 성공
- [ ] Chrome에서 정상 동작 (사용자 확인 필요)
