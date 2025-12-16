# 06. PDF 처리 - 체크리스트

## 의존성 설치
- [x] `pdfjs-dist` 패키지 설치

## Vite 설정
- [x] pdf.worker.min.js 복사 플러그인 추가
- [x] 빌드 후 dist에 worker 파일 존재 확인

## Manifest 설정
- [x] web_accessible_resources에 pdf.worker.min.js 추가

## PDF 처리 로직 (src/lib/pdf-processor.ts)
- [x] Worker 경로 설정
- [x] `processPdf()` 함수 구현
- [x] `renderPageToBlob()` 함수 구현
- [x] `generateThumbnail()` 함수 구현
- [x] `getPdfInfo()` 함수 구현
- [x] 진행률 콜백 구현
- [x] 메모리 정리 (page.cleanup())

## React 컴포넌트 (src/popup/components/PdfUploader.tsx)
- [x] 파일 input 구현 (hidden)
- [x] 파일 선택 버튼 구현
- [x] PDF 타입 검증
- [x] 진행률 상태 표시
- [x] 에러 상태 표시
- [x] onUploadComplete 콜백 (onPagesSelected)

## 렌더링 설정
- [x] 스케일 옵션 (기본 1.5)
- [x] 최대 페이지 수 제한 옵션
- [x] Canvas 크기 설정
- [x] PNG 변환

## 테스트
- [ ] PDF 파일 로드 테스트
- [ ] 페이지 렌더링 테스트
- [ ] Canvas → Blob 변환 테스트
- [ ] 진행률 표시 테스트
- [ ] Worker 로딩 테스트
- [ ] 메모리 누수 테스트 (대용량 PDF)

## 완료 조건
- [x] PDF 파일 선택 동작
- [x] 페이지별 렌더링 동작
- [x] 진행률 표시 동작
- [x] Blob 생성 및 반환 동작
- [x] Worker 정상 로딩
