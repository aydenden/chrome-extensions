# 03. 회사명 추출 - 체크리스트

## 의존성 설치
- [ ] `lindera-wasm-ko-dic` 패키지 설치 (TODO: 나중에 추가)

## Vite 설정
- [ ] `optimizeDeps.exclude`에 lindera 추가 (TODO: 나중에 추가)
- [ ] `build.target`을 `esnext`로 설정 (TODO: 나중에 추가)

## 구현 (src/lib/company-extractor.ts)
### 패턴 매칭
- [x] 사이트별 Title 패턴 정의 (6개 사이트)
  - [x] wanted.co.kr: `/^(.+?)\s*-\s*회사\s*소개/`
  - [x] innoforest.co.kr: `/^(.+?)\s*-\s*혁신의숲/`
  - [x] dart.fss.or.kr: `/^(.+?)\s*-\s*DART/`
  - [x] teamblind.com: `/^(.+?)\s+기업정보/`
  - [x] jobplanet.co.kr: `/^(.+?)\s+기업리뷰/`
  - [x] sminfo.mss.go.kr: HTML 직접 추출 방식
- [x] `extractFromTitle()` 함수 구현
- [ ] 원티드 패턴 테스트 (실제 페이지에서 확인 필요)
- [ ] 혁신의숲 패턴 테스트 (실제 페이지에서 확인 필요)
- [ ] DART 패턴 테스트 (실제 페이지에서 확인 필요)
- [ ] 블라인드 패턴 테스트 (실제 페이지에서 확인 필요)
- [ ] 잡플래닛 패턴 테스트 (실제 페이지에서 확인 필요)
- [x] 중기부확인 HTML 추출 로직 구현

### 형태소 분석
- [ ] lindera WASM 로딩 구현 (TODO: 나중에 추가)
- [x] `extractFromMorpheme()` 함수 스텁 구현 (TODO 주석으로 남김)
- [ ] 고유명사(NNP) 추출 로직 (TODO: 나중에 추가)
- [ ] 일반명사(NNG) 조합 로직 (TODO: 나중에 추가)
- [ ] 500자 제한 처리 (TODO: 나중에 추가)

### 유틸리티
- [x] `cleanCompanyName()` 함수 구현
- [x] 법인 표기 제거 ((주), ㈜, (유), 주식회사, 유한회사)
- [x] 공백 정리 (trim, 연속 공백 처리)

### 메인 함수
- [x] `extractCompanyName()` 함수 구현
- [x] `extractFromCurrentPage()` 함수 구현
- [x] 우선순위 처리 (Title → HTML → 형태소 → null)

## 테스트
- [ ] Title 패턴 매칭 테스트 (실제 사이트에서 확인 필요)
- [ ] HTML 추출 테스트 (중기부확인 사이트)
- [ ] 형태소 분석 테스트 (TODO: 나중에 추가)
- [ ] 폴백 처리 테스트
- [ ] WASM 로딩 성능 테스트 (TODO: 나중에 추가)

## 완료 조건
- [x] 모든 지원 사이트에서 Title 패턴 정의 완료
- [x] 회사명 정리 함수 구현 완료
- [x] 메인 추출 함수 구현 완료
- [ ] 실제 사이트에서 추출 동작 확인
- [ ] 형태소 분석 폴백 동작 (TODO: 나중에 추가)
- [ ] WASM 로딩 에러 처리 (TODO: 나중에 추가)
