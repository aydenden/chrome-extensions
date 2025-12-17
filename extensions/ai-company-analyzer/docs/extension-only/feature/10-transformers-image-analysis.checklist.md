# 10. Transformers.js 이미지 분석 - 체크리스트

## 의존성 설치
- [ ] `@huggingface/transformers` 패키지 설치

## Manifest 설정
- [ ] host_permissions에 huggingface.co 추가
- [ ] CSP에 wasm-unsafe-eval 추가

## 파이프라인 초기화
- [ ] `initImagePipeline()` 함수 구현
- [ ] 모델 ID 설정 (vit-gpt2-image-captioning)
- [ ] 진행률 콜백 처리
- [ ] 에러 처리
- [ ] 중복 초기화 방지

## 상태 관리
- [ ] captionPipeline 인스턴스 관리
- [ ] isLoading 상태
- [ ] loadProgress 상태
- [ ] `getImagePipelineStatus()` 함수

## 캡셔닝 함수
- [ ] `generateCaption()` 함수 구현
- [ ] Blob → Data URL 변환
- [ ] 파이프라인 실행
- [ ] 결과 추출

## 분석 함수
- [ ] `generateCaptions()` 함수 (복수 이미지)
- [ ] `analyzeGraphImage()` 함수
- [ ] `analyzePdfImages()` 함수
- [ ] WebLLM 연동 분석

## WebLLM 연동
- [ ] 캡션 + 컨텍스트로 프롬프트 생성
- [ ] GENERATE_TEXT 메시지 전송
- [ ] 응답 처리

## 메시지 핸들러
- [ ] INIT_IMAGE_PIPELINE 핸들러
- [ ] GENERATE_CAPTION 핸들러
- [ ] ANALYZE_GRAPH 핸들러
- [ ] ANALYZE_PDF_IMAGES 핸들러
- [ ] IMAGE_PIPELINE_PROGRESS 브로드캐스트

## 유틸리티
- [ ] `blobToDataUrl()` 함수

## 테스트
- [ ] 모델 다운로드 테스트
- [ ] 단일 이미지 캡셔닝 테스트
- [ ] 복수 이미지 캡셔닝 테스트
- [ ] 그래프 분석 테스트
- [ ] PDF 이미지 분석 테스트
- [ ] WebLLM 연동 테스트

## 완료 조건
- [ ] 파이프라인 초기화 동작
- [ ] 모델 다운로드 및 로딩 동작
- [ ] 이미지 캡셔닝 동작
- [ ] WebLLM 연동 분석 동작
