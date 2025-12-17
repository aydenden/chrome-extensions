# 05. 그래프 캡처 - 체크리스트

## 의존성 설치
- [x] `canvg` 패키지 설치

## SVG 캡처 (canvg)
- [x] `captureSvgElement()` 함수 구현
- [x] SVG 직렬화 (XMLSerializer)
- [x] Canvas 생성
- [x] devicePixelRatio 적용
- [x] canvg 렌더링
- [x] Canvas → Blob 변환

## 영역 선택 UI
- [x] Shadow DOM 생성
- [x] 크로스헤어 커서 오버레이
- [x] 선택 영역 박스
- [x] 안내 메시지
- [x] 스타일 정의

## 이벤트 핸들러
- [x] `handleMouseDown()` 구현 (드래그 시작)
- [x] `handleMouseMove()` 구현 (드래그 중)
- [x] `handleMouseUp()` 구현 (드래그 완료)
- [x] `handleKeyDown()` 구현 (ESC 취소)
- [x] capture 단계 이벤트 등록

## 영역 계산
- [x] 시작점/끝점 좌표 저장
- [x] 선택 영역 크기 계산
- [x] 음수 방향 드래그 처리
- [x] 최소 크기 검증

## Background 캡처 핸들러
- [x] `captureVisibleTab` API 호출
- [x] `cropImage()` 함수 구현
- [x] OffscreenCanvas 사용
- [x] devicePixelRatio 적용
- [x] Blob 변환

## 메시지 통신
- [x] 팝업 → Content Script (ACTIVATE_AREA_CAPTURE)
- [x] Content Script → Background (CAPTURE_AREA)
- [x] Background → Content Script (AREA_CAPTURED)

## 테스트
- [ ] SVG 캡처 테스트 (원티드 그래프)
- [ ] 영역 선택 캡처 테스트
- [ ] devicePixelRatio 처리 테스트
- [ ] 크롭 정확도 테스트
- [ ] ESC 취소 테스트

## 완료 조건
- [x] SVG → PNG 변환 동작
- [x] 영역 선택 UI 동작
- [x] captureVisibleTab 크롭 정확
- [x] Blob 생성 및 저장 동작

## 구현 완료
- [x] `/src/content/graph-capture.ts` 작성
- [x] `/src/background/capture-handler.ts` 작성
- [x] `/src/background/index.ts` 업데이트
- [x] `/src/content/index.ts` 업데이트
