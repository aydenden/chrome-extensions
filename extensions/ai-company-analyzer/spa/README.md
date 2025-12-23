# AI Company Analyzer SPA

기업 정보 시각화 및 AI 분석을 위한 Single Page Application.
Chrome Extension과 연동하여 수집된 데이터를 관리하고 Ollama를 통해 AI 분석을 수행합니다.

## 요구사항

- **Bun** 1.0+ (또는 Node.js 18+)
- **AI Company Analyzer Extension** - Chrome에 설치 필요
- **Ollama** - AI 분석 기능 사용 시 (선택사항)

## 빠른 시작

### 1. 의존성 설치

```bash
# 루트에서 전체 설치
bun install

# 또는 SPA 디렉토리에서 직접 설치
cd extensions/ai-company-analyzer/spa
bun install
```

### 2. Extension 설치

SPA가 정상 동작하려면 Extension이 Chrome에 설치되어 있어야 합니다.

1. Extension 빌드: `bun run build:ai-analyzer` (루트에서)
2. Chrome에서 `chrome://extensions/` 열기
3. 우측 상단 "개발자 모드" 활성화
4. "압축해제된 확장 프로그램을 로드합니다" 클릭
5. `extensions/ai-company-analyzer/extension/dist` 폴더 선택

### 3. 개발 서버 실행

```bash
cd extensions/ai-company-analyzer/spa
bun run dev
```

브라우저에서 `http://localhost:5173/ai-company-analyzer/` 접속

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `bun run dev` | 개발 서버 시작 (HMR) |
| `bun run build` | 프로덕션 빌드 |
| `bun run preview` | 빌드 결과 미리보기 |
| `bun run typecheck` | TypeScript 타입 검사 |
| `bun run test` | Vitest 단위 테스트 (watch) |
| `bun run test:run` | 단위 테스트 1회 실행 |
| `bun run test:coverage` | 커버리지 리포트 |
| `bun run e2e` | Playwright E2E 테스트 |
| `bun run e2e:ui` | Playwright UI 모드 |

## 프로젝트 구조

```
spa/src/
├── pages/              # 페이지 컴포넌트
│   ├── CompanyList.tsx       # 회사 목록 (메인)
│   ├── CompanyDetail.tsx     # 회사 상세
│   ├── Analysis.tsx          # AI 분석
│   └── Settings.tsx          # 설정
├── components/
│   ├── ui/             # 공통 UI (Button, Card, Modal 등)
│   ├── layout/         # 레이아웃
│   ├── company/        # 회사 관련
│   ├── image/          # 이미지 갤러리
│   ├── analysis/       # AI 분석
│   └── settings/       # 설정
├── contexts/           # React Context
│   ├── ExtensionContext.tsx  # Extension 연결 상태
│   └── OllamaContext.tsx     # AI 설정
├── hooks/              # Custom Hooks
├── lib/
│   ├── extension-client/     # Extension 통신
│   ├── analysis/             # AI 분석 로직
│   └── query/                # React Query 설정
└── styles/             # Tailwind CSS
```

## Extension 연동

SPA는 Chrome Extension과 메시지 통신으로 연동됩니다.

**고정 Extension ID**: `opndpciajcchajfpcafiglahllclcgam`
- manifest.json의 `key` 필드로 ID가 고정되어 있음
- 어느 경로에서 로드해도 동일한 ID 보장

```typescript
import { getExtensionClient } from '@/lib/extension-client';

const client = getExtensionClient();
const companies = await client.send('GET_COMPANIES');
```

## AI 분석 (Ollama)

AI 분석 기능을 사용하려면 Ollama가 로컬에서 실행 중이어야 합니다.

```bash
# Ollama 설치 후
ollama serve

# Vision 모델 다운로드
ollama pull llava
# 또는
ollama pull qwen2-vl:7b
```

설정 페이지(`/settings`)에서:
- Ollama 연결 상태 확인
- 사용할 모델 선택
- 분석 프롬프트 커스터마이징

## 관련 문서

- [Extension 문서](../extension/CLAUDE.md)
- [아키텍처 스펙](../docs/spa-with-extension/spec/)
- [AI 통합 가이드](../docs/spa-with-extension/learn/06-ollama-integration.md)
