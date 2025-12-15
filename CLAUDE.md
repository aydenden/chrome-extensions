# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

개인 포트폴리오용 크롬 익스텐션 모노레포. Chrome 웹 스토어에 배포하지 않고 로컬에서만 사용.

## 빌드 명령어

```bash
# 전체 빌드
bun run build

# 개별 익스텐션 빌드
bun run build:wanted       # wanted-helper 빌드
bun run dev:wanted         # wanted-helper watch 모드
```

## 아키텍처

```
chrome-extensions/
├── extensions/           # 각 익스텐션 패키지
│   └── wanted-helper/    # @chrome-ext/wanted-helper
├── package.json          # 루트 - npm workspaces 설정
└── tsconfig.base.json    # 공유 TypeScript 설정
```

**모노레포 구조:**
- Bun + npm workspaces 사용
- 각 익스텐션은 `extensions/` 하위에 독립 패키지로 존재
- 공통 devDependencies는 루트에서 관리 (`@types/chrome`, `typescript`)
- 각 익스텐션의 tsconfig는 루트의 `tsconfig.base.json`을 extends

**새 익스텐션 추가 시:**
1. `extensions/{name}/` 디렉토리 생성
2. `package.json`에 `@chrome-ext/{name}` 네이밍 컨벤션 사용
3. `tsconfig.json`에서 `../../tsconfig.base.json` extends
4. `manifest.json`에 Manifest V3 설정
5. 루트 `package.json`에 빌드 스크립트 추가

## 로컬 테스트 방법

1. 익스텐션 빌드 (`bun run build:{name}`)
2. Chrome → `chrome://extensions/` → 개발자 모드 활성화
3. "압축해제된 확장 프로그램을 로드합니다" → 해당 익스텐션 폴더 선택
4. 코드 수정 후: 빌드 → 확장 프로그램 새로고침 아이콘 클릭 → 대상 페이지 새로고침

## 기술 스택

- TypeScript + Chrome Extension Manifest V3
- Chrome Storage Sync API (데이터 저장)
- Content Scripts (페이지 DOM 조작)
