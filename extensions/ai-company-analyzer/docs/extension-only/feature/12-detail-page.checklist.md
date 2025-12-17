# 12. 회사 상세 페이지 - 체크리스트

## 파일 생성
- [x] `src/pages/detail/detail.html` 생성
- [x] `src/pages/detail/DetailPage.tsx` 생성
- [x] `src/pages/detail/detail.css` 생성

## 상태 관리
- [x] companyId 상태 (URL 파라미터)
- [x] selectedSource 상태
- [x] isAnalyzing 상태
- [x] modalImage 상태

## 데이터 조회 (useLiveQuery)
- [x] company 조회
- [x] analysisResult 조회
- [x] extractedData 조회
- [x] sourceGroups 그룹핑 (memo)

## UI 컴포넌트
### 페이지 레이아웃
- [x] 헤더 (뒤로가기, 재분석 버튼)
- [x] 회사 정보 섹션
- [x] AI 분석 결과 섹션
- [x] 수집된 데이터 섹션

### AnalysisCard 컴포넌트
- [x] 종합 점수 표시
- [x] Runway 표시
- [x] 재무 리스크 표시
- [x] 리뷰 요약 표시
- [x] 분석 전 상태 표시

### 소스 탭
- [x] 소스별 탭 버튼
- [x] 활성 탭 스타일

### DataList 컴포넌트
- [x] 텍스트 데이터 표시
- [x] 이미지 썸네일 표시
- [x] 이미지 URL 로드 (getImageUrl)
- [x] 이미지 클릭 이벤트

### ImageModal 컴포넌트
- [x] 오버레이
- [x] 확대 이미지
- [x] 닫기 버튼
- [x] 외부 클릭 닫기

## 이벤트 핸들러
- [x] handleBack() - 목록으로 돌아가기
- [x] handleReanalyze() - 재분석 실행
- [x] 이미지 모달 열기/닫기

## 재분석 로직
- [x] 텍스트 데이터 수집
- [x] ANALYZE_FINANCIALS 요청
- [x] ANALYZE_REVIEWS 요청
- [x] CALCULATE_SCORE 요청
- [x] 결과 저장 (saveAnalysisResult)
- [x] 에러 처리

## 스타일
- [x] 페이지 레이아웃
- [x] 헤더 스타일
- [x] 분석 카드 스타일
- [x] 데이터 리스트 스타일
- [x] 탭 스타일
- [x] 이미지 썸네일 스타일
- [x] 모달 스타일

## Vite 설정
- [x] detail.html 엔트리 추가

## 테스트
- [x] 회사 정보 표시 테스트
- [x] 분석 결과 표시 테스트
- [x] 데이터 리스트 표시 테스트
- [x] 소스 탭 전환 테스트
- [x] 이미지 모달 테스트
- [x] 재분석 테스트
- [x] 분석 전 상태 테스트

## 완료 조건
- [x] 회사 정보 정상 표시
- [x] 분석 결과 정상 표시
- [x] 소스별 데이터 표시
- [x] 이미지 모달 동작
- [x] 재분석 동작
