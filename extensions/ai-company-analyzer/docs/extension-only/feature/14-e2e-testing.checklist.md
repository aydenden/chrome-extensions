# 14. E2E 테스트 - 체크리스트

## 의존성 설치
- [ ] `@playwright/test` 설치
- [ ] Chromium 브라우저 설치 (`bunx playwright install chromium`)

## 설정 파일
- [ ] `playwright.config.ts` 생성
  - [ ] testDir: './e2e'
  - [ ] timeout: 180000 (3분)
  - [ ] headless: false
  - [ ] chromium 프로젝트 설정

## Fixtures
- [ ] `e2e/fixtures.ts` 생성
  - [ ] Extension 경로 설정 (dist/)
  - [ ] launchPersistentContext 설정
  - [ ] Extension ID 동적 추출
  - [ ] Service Worker 대기 로직

## Popup 테스트 (popup.spec.ts)
- [ ] Popup 페이지 로드 테스트
- [ ] 회사 수 표시 테스트
- [ ] 캡처 버튼 표시 테스트
- [ ] 설정 버튼 클릭 테스트

## 목록 페이지 테스트 (list-page.spec.ts)
- [ ] 페이지 로드 테스트
- [ ] 빈 상태 표시 테스트
- [ ] 회사 카드 렌더링 테스트
- [ ] 검색 필터 테스트
- [ ] 정렬 기능 테스트
- [ ] 삭제 기능 테스트

## AI 파이프라인 테스트 (ai-pipeline.spec.ts)
- [ ] VLM 엔진 초기화 테스트
- [ ] 임베딩 엔진 초기화 테스트
- [ ] 엔진 상태 조회 테스트
- [ ] 이미지 분류 테스트 (샘플 이미지)
- [ ] 임베딩 생성 테스트 (샘플 텍스트)

## package.json
- [ ] `test:e2e` 스크립트 추가

## 테스트 데이터
- [ ] 샘플 이미지 준비 (e2e/fixtures/)
- [ ] DB 초기화 헬퍼 함수

## 완료 조건
- [ ] `bun run test:e2e` 실행 성공
- [ ] 모든 P0 테스트 통과
- [ ] AI 모델 로드 테스트 통과 (3분 이내)
