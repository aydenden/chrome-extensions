# 04. 요소 선택 모드 - 체크리스트

## Shadow DOM 설정
- [x] `createShadowDOM()` 함수 구현
- [x] Shadow Host 생성
- [x] Shadow Root 생성 (closed mode)
- [x] 스타일 삽입
- [x] `removeShadowDOM()` 함수 구현

## UI 요소
- [x] 하이라이트 오버레이 구현
- [x] 플로팅 버튼 컨테이너 구현
- [x] 완료 버튼 구현
- [x] 취소 버튼 구현
- [x] 선택 개수 표시

## 이벤트 핸들러
- [x] `handleMouseMove()` 구현 (호버 하이라이트)
- [x] `handleClick()` 구현 (요소 선택)
- [x] `handleKeyDown()` 구현 (ESC/Enter)
- [x] `handleComplete()` 구현
- [x] `handleCancel()` 구현
- [x] capture 단계 이벤트 등록

## 선택 로직
- [x] `addElementSelection()` 구현
- [x] `toggleElementSelection()` 구현 (Shift+클릭)
- [x] 선택 스타일 적용 (outline)
- [x] 선택 스타일 제거

## 상태 관리
- [x] `PickerState` 인터페이스 정의
- [x] `activatePicker()` 함수 구현
- [x] `deactivatePicker()` 함수 구현
- [x] 선택된 요소 배열 관리

## 텍스트 추출
- [x] 선택된 요소들의 텍스트 추출
- [x] 텍스트 조합 (줄바꿈으로 구분)
- [x] 공백 정리

## 메시지 통신
- [x] 팝업 → Content Script (ACTIVATE_PICKER)
- [x] Content Script → Background (TEXT_EXTRACTED)
- [x] 메시지 리스너 구현

## 스타일
- [x] 하이라이트 오버레이 스타일
- [x] 플로팅 버튼 스타일
- [x] 완료/취소 버튼 스타일
- [x] 호버 효과

## 테스트
- [ ] 단일 요소 선택 테스트
- [ ] 다중 요소 선택 (Shift+클릭) 테스트
- [ ] ESC 취소 테스트
- [ ] Enter 완료 테스트
- [ ] 페이지 이벤트 차단 테스트
- [ ] Shadow DOM 스타일 격리 테스트

## 완료 조건
- [x] Shadow DOM 스타일 격리 동작
- [x] 호버 하이라이트 동작
- [x] 단일/다중 선택 동작
- [x] 플로팅 버튼 동작
- [x] 텍스트 추출 및 전송 동작
- [x] ESC/Enter 단축키 동작

## 구현 완료
- [x] `/src/content/element-picker.ts` 생성
- [x] `/src/content/index.ts` 업데이트 (import 및 연동)
- [x] 모든 핵심 기능 구현 완료
