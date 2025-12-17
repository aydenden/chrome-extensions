# 02. 데이터 저장소 - 체크리스트

## 타입 정의
- [x] `src/types/storage.ts` 생성
- [x] `DataType` 타입 정의
- [x] `Company` 인터페이스 정의
- [x] `ExtractedData` 인터페이스 정의
- [x] `BinaryData` 인터페이스 정의
- [x] `AnalysisResult` 인터페이스 정의

## Dexie.js 설정
- [x] `dexie` 패키지 설치 (package.json에 포함)
- [x] `dexie-react-hooks` 패키지 설치 (package.json에 포함)
- [x] `src/lib/db.ts` 생성
- [x] `AppDatabase` 클래스 정의
- [x] 스키마 버전 1 정의
- [x] 인덱스 설정

## 저장소 함수 (src/lib/storage.ts)
### 회사 CRUD
- [x] `createCompany()` 함수 구현
- [x] `getCompany()` 함수 구현
- [x] `getAllCompanies()` 함수 구현
- [x] `searchCompanies()` 함수 구현
- [x] `updateCompany()` 함수 구현
- [x] `deleteCompany()` 함수 구현 (cascade 삭제)

### 데이터 저장
- [x] `saveText()` 함수 구현
- [x] `saveImage()` 함수 구현 (트랜잭션)

### 데이터 조회
- [x] `getCompanyData()` 함수 구현
- [x] `getDataByType()` 함수 구현
- [x] `getImageBlob()` 함수 구현
- [x] `getImageUrl()` 함수 구현

### 분석 결과
- [x] `saveAnalysisResult()` 함수 구현
- [x] `getAnalysisResult()` 함수 구현

### 유틸리티
- [x] `exportAllData()` 함수 구현
- [x] `clearAllData()` 함수 구현

## Chrome Storage 설정 (src/lib/settings.ts)
- [x] `SiteConfig` 인터페이스 정의
- [x] `AISettings` 인터페이스 정의
- [x] `saveSettings()` 함수 구현
- [x] `getSettings()` 함수 구현
- [x] `getSiteConfigs()` 함수 구현
- [x] `getAISettings()` 함수 구현
- [x] 기본 사이트 설정 정의
- [x] 기본 AI 설정 정의

## 테스트
- [ ] 회사 생성/조회 테스트 (런타임 테스트 필요)
- [ ] 회사 삭제 (cascade) 테스트 (런타임 테스트 필요)
- [ ] 이미지 저장/조회 테스트 (런타임 테스트 필요)
- [ ] React 훅 (`useLiveQuery`) 테스트 (런타임 테스트 필요)
- [ ] Chrome Storage 설정 저장/조회 테스트 (런타임 테스트 필요)

## 완료 조건
- [x] 모든 CRUD 함수 구현 완료
- [x] 트랜잭션 처리 구현 완료
- [x] Chrome Storage 설정 관리 구현 완료
- [x] 빌드 성공
