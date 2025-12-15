# 크롬 익스텐션 학습 가이드

이 문서는 크롬 익스텐션 개발을 위한 공식 문서 기반 학습 자료입니다. 바이브 코딩으로 만든 프로젝트를 체계적으로 이해하고 개선하기 위해 작성되었습니다.

## 📚 문서 구조

### 기본 개념
1. **[Manifest V3 개요](./01-manifest-v3-overview.md)**
   - Manifest V3의 핵심 특징
   - V2와의 차이점 및 마이그레이션
   - 주요 변경사항과 보안 개선

2. **[Content Scripts](./02-content-scripts.md)**
   - Content Scripts의 작동 원리
   - 격리된 월드(Isolated Worlds) 개념
   - 주입 방법과 실전 예제

3. **[Storage API](./03-storage-api.md)**
   - 4가지 저장소 유형 (local, sync, session, managed)
   - 용량 제한과 사용 사례
   - 실전 활용 패턴

### 통신과 상호작용
4. **[메시지 전달](./04-messaging.md)**
   - 컴포넌트 간 통신 방법
   - 일회성 메시지 vs 장기 연결
   - 실전 통신 패턴

5. **[MutationObserver](./05-mutation-observer.md)**
   - DOM 변경 감지 메커니즘
   - 성능 최적화 방법
   - 실전 활용 예제

### 아키텍처와 개발 실무
6. **[아키텍처 패턴](./06-architecture-patterns.md)**
   - 크롬 익스텐션 컴포넌트 구조
   - 코드 구조화 방법
   - 프로젝트 구조 예시

7. **[디버깅과 테스트](./07-debugging-testing.md)**
   - DevTools 활용법
   - 컴포넌트별 디버깅 기법
   - 에러 추적 및 해결

8. **[보안과 권한](./08-security-permissions.md)**
   - Content Security Policy (CSP)
   - 권한 최소화 원칙
   - 보안 베스트 프랙티스

## 🎯 학습 순서

### 초보자 추천 순서
1. Manifest V3 개요 → 전체 그림 이해
2. Content Scripts → 현재 프로젝트의 핵심 이해
3. Storage API → 데이터 저장 방식 이해
4. MutationObserver → DOM 감지 메커니즘 이해
5. 디버깅과 테스트 → 개발 효율성 향상
6. 나머지 문서 → 심화 학습

### 문제 해결 중심 순서
- 디버깅 문제? → 07-debugging-testing.md
- 데이터 저장 문제? → 03-storage-api.md
- DOM 감지 문제? → 05-mutation-observer.md
- 컴포넌트 통신 문제? → 04-messaging.md
- 보안 경고? → 08-security-permissions.md

## 💡 현재 프로젝트와의 연관성

이 프로젝트(Wanted Helper)는 다음 기술을 사용합니다:

- **Manifest V3** ✅
- **Content Scripts** ✅ (`src/index.ts`)
- **Storage API** ✅ (`chrome.storage.sync`)
- **MutationObserver** ✅ (페이지 변경 감지)

각 문서에서 현재 프로젝트 코드와 연결된 부분을 특별히 표시했습니다.

## 📖 추가 참고 자료

### 공식 문서
- [Chrome for Developers - Extensions](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Chrome Extension API Reference](https://developer.chrome.com/docs/extensions/reference/api)

### 유용한 리소스
- [Chrome Web Store](https://chromewebstore.google.com/)
- [Extension Samples](https://github.com/GoogleChrome/chrome-extensions-samples)
- [Stack Overflow - Chrome Extension Tag](https://stackoverflow.com/questions/tagged/google-chrome-extension)

## 🚀 시작하기

1. 순서대로 문서를 읽으며 개념 이해
2. 각 문서의 예제 코드를 현재 프로젝트와 비교
3. 베스트 프랙티스를 현재 코드에 적용
4. 필요한 부분을 리팩토링

Happy Learning! 🎉
