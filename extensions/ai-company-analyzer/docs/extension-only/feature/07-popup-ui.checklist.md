# 07. 팝업 UI - 체크리스트

## 파일 생성
- [x] `src/popup/popup.html` 생성
- [x] `src/popup/Popup.tsx` 생성
- [x] `src/popup/popup.css` 생성

## 상태 관리
- [x] currentSite 상태
- [x] isSupported 상태
- [x] currentUrl 상태
- [x] companyCount (useLiveQuery)
- [x] showPdfUpload 상태

## 사이트 감지
- [x] chrome.tabs.query로 현재 탭 URL 조회
- [x] detectCurrentSite()로 사이트 감지
- [x] URL 패턴 매칭
- [x] 지원/미지원 상태 설정

## UI 컴포넌트
- [x] 헤더 (타이틀)
- [x] 사이트 정보 섹션
- [x] 지원 사이트 표시 (녹색)
- [x] 미지원 사이트 표시 (빨간색)
- [x] 액션 버튼 3개
- [x] 푸터 (회사 수, 목록 링크, 설정 링크)

## 액션 버튼
- [x] 텍스트 추출 버튼
- [x] 그래프 캡처 버튼
- [x] PDF 업로드 버튼
- [x] disabled 상태 처리 (미지원 사이트)

## 이벤트 핸들러
- [x] handleTextExtract() 구현
- [x] handleGraphCapture() 구현
- [x] handlePdfUpload() 구현
- [x] handleOpenList() 구현
- [x] handleOpenSettings() 구현

## 메시지 통신
- [x] ACTIVATE_PICKER 메시지 전송
- [x] ACTIVATE_CAPTURE 메시지 전송
- [x] 팝업 닫기 (window.close())

## 스타일
- [x] 팝업 너비 설정 (320px)
- [x] 헤더 스타일
- [x] 사이트 정보 박스 스타일
- [x] 버튼 스타일
- [x] 푸터 스타일
- [x] 호버/disabled 효과
- [x] 다크 모드 지원 추가

## 테스트
- [ ] 지원 사이트에서 팝업 표시
- [ ] 미지원 사이트에서 팝업 표시
- [ ] 버튼 disabled 동작
- [ ] 텍스트 추출 모드 활성화
- [ ] 그래프 캡처 모드 활성화
- [ ] PDF 업로드 토글 동작
- [ ] 회사 목록 페이지 열기
- [ ] 설정 페이지 열기
- [ ] 회사 수 실시간 업데이트

## 완료 조건
- [x] 팝업 정상 표시
- [x] 사이트 감지 동작
- [x] 모든 버튼 동작
- [x] 회사 수 표시 동작
- [x] 빌드 테스트 통과
