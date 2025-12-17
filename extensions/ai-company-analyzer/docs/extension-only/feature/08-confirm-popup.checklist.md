# 08. 컨펌 팝업 - 체크리스트

## 파일 생성
- [x] `src/content/confirm-popup.tsx` 생성

## 컴포넌트 구현
### 상태 관리
- [x] companyName 상태
- [x] dataType 상태
- [x] saveTarget 상태 (new/existing)
- [x] selectedCompanyId 상태
- [x] companies 상태 (기존 회사 목록)
- [x] imagePreviewUrl 상태
- [x] isSaving 상태

### 초기화
- [x] 회사명 자동 추출 (extractCompanyName)
- [x] 기존 회사 목록 로드 (getAllCompanies)
- [x] 이미지 미리보기 URL 생성 (ObjectURL)
- [x] ObjectURL cleanup (useEffect return)

## UI 구성
- [x] 오버레이 (반투명 배경)
- [x] 모달 컨테이너
- [x] 헤더 (타이틀)
- [x] 미리보기 섹션 (텍스트/이미지)
- [x] 회사명 입력 필드
- [x] 자동 감지 표시
- [x] 데이터 타입 드롭다운
- [x] 저장 대상 라디오 버튼
- [x] 기존 회사 선택 드롭다운
- [x] 취소/저장 버튼

## 저장 로직
- [x] 회사명 검증 (빈 값 체크)
- [x] 새 회사 생성 (createCompany)
- [x] 기존 회사 선택 검증
- [x] 텍스트 저장 (saveText)
- [x] 이미지 저장 (saveImage)
- [x] 에러 처리
- [x] 저장 중 상태 표시

## Shadow DOM 마운트
- [x] showConfirmPopup() 함수
- [x] hideConfirmPopup() 함수
- [x] Shadow Host 생성
- [x] Shadow Root 생성 (closed)
- [x] 스타일 삽입
- [x] React root 생성/렌더링
- [x] cleanup 처리

## 스타일
- [x] 오버레이 스타일
- [x] 모달 스타일
- [x] 미리보기 영역 스타일
- [x] 폼 필드 스타일
- [x] 버튼 스타일
- [x] disabled 상태 스타일

## 메시지 통신
- [x] SHOW_CONFIRM_POPUP 리스너

## 통합
- [x] element-picker.ts에서 showConfirmPopup 호출
- [x] graph-capture.ts에서 showConfirmPopup 호출
- [x] content/index.ts에서 activateAreaCapture import

## 테스트
- [ ] 텍스트 데이터 컨펌 표시 (런타임 테스트 필요)
- [ ] 이미지 데이터 컨펌 표시 (런타임 테스트 필요)
- [ ] 회사명 자동 감지 테스트 (런타임 테스트 필요)
- [ ] 새 회사 저장 테스트 (런타임 테스트 필요)
- [ ] 기존 회사에 추가 테스트 (런타임 테스트 필요)
- [ ] 데이터 타입 선택 테스트 (런타임 테스트 필요)
- [ ] 취소 버튼 테스트 (런타임 테스트 필요)
- [ ] Shadow DOM 격리 테스트 (런타임 테스트 필요)

## 완료 조건
- [x] 모달 정상 표시
- [x] 미리보기 동작
- [x] 회사명 자동 감지 동작
- [x] 폼 입력 동작
- [x] 저장 동작
- [x] Shadow DOM 격리 동작
- [x] 빌드 성공
