# AI 기업분석 - 개요

## 프로젝트 정보

- **이름**: AI 기업분석
- **영문**: ai-company-analyzer
- **패키지**: @chrome-ext/ai-company-analyzer
- **플랫폼**: Chrome Extension (Manifest V3)

## 목적

취업 준비자가 여러 사이트에 흩어진 기업 정보를 한 곳에서 수집하고, Chrome 빌트인 AI를 활용해 자동으로 분석할 수 있는 도구.

## 핵심 기능

1. **데이터 수집**: 요소 선택 방식으로 텍스트/그래프/PDF 추출
2. **AI 분석**: Runway 예측, 재무 리스크, 리뷰 분석, 종합 점수
3. **회사 관리**: 리스트/상세 페이지에서 수집된 데이터 및 분석 결과 확인

## 기술 스택

| 분류 | 기술 |
|------|------|
| 언어 | TypeScript |
| 플랫폼 | Chrome Extension Manifest V3 |
| 저장소 | Chrome Storage (메타데이터) + IndexedDB (이미지/PDF) |
| AI | Chrome 빌트인 AI (Prompt API, Translator API, Language Detector API) |
| 라이브러리 | canvg (SVG→이미지), pdf.js (PDF 렌더링) |

## 지원 사이트

| 사이트 | 데이터 타입 | 추출 방식 |
|--------|-------------|-----------|
| 원티드 | 기업 정보 | 텍스트, 그래프 |
| 혁신의숲 | 재무 정보 | 텍스트, 그래프 |
| DART | 재무 정보 | PDF |
| 중기벤처확인 | 재무 정보 | 텍스트 |
| 블라인드 | 리뷰 | 텍스트 |
| 잡플래닛 | 리뷰 | 텍스트 |

## 제약사항

- Chrome 138+ 필요
- GPU 4GB+ VRAM 권장 (CPU 모드는 느림)
- AI 모델 다운로드 1.5~2.4GB 필요

## 법적 검토

**수동 추출 방식 = 법적으로 안전**
- 자동 크롤링이 아닌 사용자 수동 버튼 클릭
- 복사/붙여넣기 자동화와 동일한 성격
- robots.txt, 이용약관 위반 해당 없음

## 디렉토리 구조

```
extensions/ai-company-analyzer/
├── manifest.json
├── package.json
├── tsconfig.json
├── src/
│   ├── popup/              # 팝업 UI
│   ├── pages/              # 리스트/상세 페이지
│   ├── content/            # 콘텐츠 스크립트 (요소 선택)
│   ├── background/         # 서비스 워커
│   ├── lib/                # 공통 유틸
│   │   ├── storage.ts      # Chrome Storage + IndexedDB
│   │   ├── ai.ts           # Chrome AI API 래퍼
│   │   └── sites.ts        # 사이트 설정
│   └── types/              # 타입 정의
├── assets/                 # 아이콘 등
└── docs/
    └── spec/               # 기능 명세 문서
```
