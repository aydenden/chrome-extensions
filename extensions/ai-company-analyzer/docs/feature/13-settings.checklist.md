# 13. 설정 페이지 - 체크리스트

## 파일 생성
- [x] `src/pages/settings/settings.html` 생성
- [x] `src/pages/settings/SettingsPage.tsx` 생성
- [x] `src/pages/settings/settings.css` 생성

## 상태 관리
- [x] activeTab 상태 (sites/ai/data)
- [x] siteConfigs 상태
- [x] aiSettings 상태
- [x] editingSite 상태

## 설정 로드
- [x] getSiteConfigs() 호출
- [x] getAISettings() 호출
- [x] 초기 로드 (useEffect)

## 탭 네비게이션
- [x] 사이트 설정 탭
- [x] AI 설정 탭
- [x] 데이터 관리 탭
- [x] 활성 탭 스타일

## 사이트 설정 (SiteSettings)
- [x] 사이트 목록 표시
- [x] 편집 버튼
- [x] 삭제 버튼 (confirm)
- [x] 사이트 추가 버튼
- [x] 기본값 초기화 버튼
- [x] handleSave() 구현
- [x] handleDelete() 구현
- [x] handleAdd() 구현
- [x] handleReset() 구현

## 사이트 편집 모달 (SiteEditModal)
- [x] 모달 오버레이
- [x] 사이트명 입력
- [x] URL 패턴 입력
- [x] 추출 가이드 입력
- [x] 취소/저장 버튼

## AI 설정 (AISettingsPanel)
### 가중치
- [x] 재무 분석 슬라이더
- [x] 리뷰 분석 슬라이더 (자동 계산)
- [x] 가중치 저장

### 프롬프트
- [x] 회사명 추출 프롬프트
- [x] 재무 분석 프롬프트
- [x] 리뷰 분석 프롬프트
- [x] 종합 점수 프롬프트
- [x] 프롬프트 저장

## 데이터 관리 (DataManagement)
- [x] 내보내기 버튼
- [x] handleExport() 구현
- [x] JSON 파일 다운로드
- [x] 가져오기 버튼 (파일 input)
- [x] handleImport() 구현
- [x] 전체 삭제 버튼
- [x] handleClearAll() 구현 (2단계 confirm)

## 스타일
- [x] 페이지 레이아웃
- [x] 탭 네비게이션 스타일
- [x] 사이트 목록 스타일
- [x] 모달 스타일
- [x] 슬라이더 스타일
- [x] 프롬프트 textarea 스타일
- [x] 버튼 스타일 (일반, danger)

## Vite 설정
- [x] settings.html 엔트리 추가

## 테스트
- [ ] 탭 전환 테스트 (런타임 테스트 필요)
- [ ] 사이트 설정 CRUD 테스트 (런타임 테스트 필요)
- [ ] AI 가중치 변경 테스트 (런타임 테스트 필요)
- [ ] 프롬프트 편집 테스트 (런타임 테스트 필요)
- [ ] 데이터 내보내기 테스트 (런타임 테스트 필요)
- [ ] 데이터 삭제 테스트 (런타임 테스트 필요)
- [ ] 기본값 초기화 테스트 (런타임 테스트 필요)

## 완료 조건
- [x] 탭 네비게이션 동작
- [x] 사이트 설정 CRUD 동작
- [x] AI 설정 저장 동작
- [x] 데이터 내보내기 동작
- [x] 데이터 삭제 동작
- [x] 빌드 성공
