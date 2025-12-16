# 11. 회사 리스트 페이지 - 체크리스트

## 파일 생성
- [x] `src/pages/list/list.html` 생성
- [x] `src/pages/list/ListPage.tsx` 생성
- [x] `src/pages/list/list.css` 생성

## 상태 관리
- [x] searchQuery 상태
- [x] sortBy 상태 (recent/name/score)

## 데이터 조회 (useLiveQuery)
- [x] companies 테이블 조회
- [x] analysisResults 테이블 조회
- [x] extractedData 테이블 조회
- [x] companyDataMap 매핑 (memo)

## 필터링 및 정렬
- [x] 검색 필터 (회사명)
- [x] 최근순 정렬
- [x] 이름순 정렬
- [x] 점수순 정렬

## UI 컴포넌트
### 페이지 레이아웃
- [x] 헤더 (타이틀, 서브타이틀)
- [x] 검색창
- [x] 정렬 드롭다운
- [x] 회사 리스트 영역
- [x] 빈 상태 표시

### CompanyCard 컴포넌트
- [x] 회사명 표시
- [x] 점수 표시 (분석 전 상태 포함)
- [x] 소스 배지들 표시
- [x] 수집일 표시
- [x] 삭제 버튼
- [x] 클릭 이벤트 (상세 페이지)

## 이벤트 핸들러
- [x] handleDelete() - 삭제 (confirm 포함)
- [x] handleOpenDetail() - 상세 페이지 열기

## 유틸리티
- [x] SOURCE_LABELS - 데이터 타입 → 소스 레이블
- [x] SOURCE_COLORS - 데이터 타입 → 배지 색상

## 스타일
- [x] 페이지 레이아웃
- [x] 검색/정렬 컨트롤
- [x] 회사 카드 스타일
- [x] 배지 스타일
- [x] 호버 효과
- [x] 빈 상태 스타일
- [x] 다크 모드 지원
- [x] 반응형 디자인

## Vite 설정
- [x] list.html 엔트리 추가 (이미 설정되어 있음)

## 테스트
- [ ] 회사 목록 표시 테스트
- [ ] 검색 필터 테스트
- [ ] 정렬 테스트 (3가지)
- [ ] 삭제 테스트
- [ ] 상세 페이지 이동 테스트
- [ ] 실시간 업데이트 테스트
- [ ] 빈 상태 표시 테스트

## 완료 조건
- [ ] 회사 목록 정상 표시
- [ ] 검색/정렬 동작
- [ ] 카드 클릭 → 상세 페이지
- [ ] 삭제 동작
- [ ] 실시간 데이터 업데이트
