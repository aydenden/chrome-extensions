# 09. WebLLM 텍스트 분석 - 체크리스트

## 의존성 설치
- [x] `@mlc-ai/web-llm` 패키지 설치

## Manifest 설정
- [x] Service Worker type: module 설정
- [x] CSP에 wasm-unsafe-eval 추가

## 엔진 초기화
- [x] `initEngine()` 함수 구현
- [x] 모델 ID 설정 (Qwen2-1.5B)
- [x] 진행률 콜백 처리
- [x] 에러 처리
- [x] 중복 초기화 방지

## 상태 관리
- [x] engine 인스턴스 관리
- [x] isLoading 상태
- [x] loadProgress 상태
- [x] `getEngineStatus()` 함수

## 텍스트 생성
- [x] `generateText()` 함수 구현
- [x] 스트리밍 생성 처리
- [x] maxTokens 옵션
- [x] temperature 옵션
- [x] onToken 콜백

## 분석 함수
- [x] `analyzeFinancials()` 함수 구현
- [x] `analyzeReviews()` 함수 구현
- [x] `calculateTotalScore()` 함수 구현
- [x] JSON 응답 파싱
- [x] 파싱 에러 처리

## 프롬프트
- [x] 재무 분석 프롬프트
- [x] 리뷰 분석 프롬프트
- [x] 종합 점수 프롬프트
- [x] JSON 출력 형식 지정

## Service Worker 유지
- [x] heartbeat 인터벌 설정 (20초)
- [x] chrome.runtime.getPlatformInfo 호출

## 메시지 핸들러
- [x] INIT_WEBLLM 핸들러
- [x] GET_ENGINE_STATUS 핸들러
- [x] ANALYZE_FINANCIALS 핸들러
- [x] ANALYZE_REVIEWS 핸들러
- [x] WEBLLM_PROGRESS 브로드캐스트

## 테스트
- [ ] 모델 다운로드 테스트
- [ ] 진행률 표시 테스트
- [ ] 텍스트 생성 테스트
- [ ] 재무 분석 테스트
- [ ] 리뷰 분석 테스트
- [ ] JSON 파싱 테스트
- [ ] Service Worker 유지 테스트
- [ ] WebGPU 미지원 환경 테스트

## 완료 조건
- [ ] 엔진 초기화 동작
- [ ] 모델 다운로드 및 로딩 동작
- [ ] 텍스트 생성 동작
- [ ] 분석 함수들 동작
- [ ] 스트리밍 응답 동작
- [ ] Service Worker 유지 동작
