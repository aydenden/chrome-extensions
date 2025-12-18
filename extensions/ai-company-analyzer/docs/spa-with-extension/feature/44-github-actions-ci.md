# Feature 44: 로컬 Pre-Push 테스트

## 개요

Git hooks(Husky)를 사용하여 push 전에 로컬에서 테스트를 자동 실행합니다.
GitHub Actions CI 대신 로컬에서 실행하여 빠른 피드백과 CI 시간을 절약합니다.

## 범위

- Husky 설정
- pre-push 훅 스크립트
- 타입 체크 + 단위 테스트 + E2E 테스트 + 빌드 검증

## 의존성

- Feature 37: Vitest 환경 설정
- Feature 41: Playwright E2E 환경

## 구현 상세

### 루트 package.json

```json
{
  "devDependencies": {
    "husky": "^9.1.7"
  }
}
```

### .husky/pre-push

```bash
#!/bin/sh

echo "🔍 Running pre-push checks..."

# ai-company-analyzer 프로젝트 경로
PROJECT_DIR="extensions/ai-company-analyzer"

# 1. 타입 체크 (병렬)
echo "📝 Type checking..."
(cd "$PROJECT_DIR/extension" && bun run typecheck) &
(cd "$PROJECT_DIR/spa" && bun run typecheck) &
wait

if [ $? -ne 0 ]; then
  echo "❌ Type check failed!"
  exit 1
fi

# 2. 단위 테스트 (병렬)
echo "🧪 Running unit tests..."
(cd "$PROJECT_DIR/extension" && bun run test:run) &
(cd "$PROJECT_DIR/spa" && bun run test:run) &
wait

if [ $? -ne 0 ]; then
  echo "❌ Unit tests failed!"
  exit 1
fi

# 3. E2E 테스트 (Chromium만)
echo "🎭 Running E2E tests (Chromium only)..."
(cd "$PROJECT_DIR/spa" && bun run e2e:chromium)

if [ $? -ne 0 ]; then
  echo "❌ E2E tests failed!"
  exit 1
fi

# 4. 빌드 검증
echo "🏗️ Building..."
(cd "$PROJECT_DIR/extension" && bun run build) &
(cd "$PROJECT_DIR/spa" && bun run build) &
wait

if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo "✅ All checks passed!"
```

### Extension package.json 스크립트

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test:run": "vitest run"
  }
}
```

### SPA package.json 스크립트

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test:run": "vitest run",
    "e2e:chromium": "playwright test --project=chromium"
  }
}
```

## 실행 흐름

```
git push
    │
    ▼
.husky/pre-push 실행
    │
    ├─► 타입 체크 (extension) ─┐
    ├─► 타입 체크 (spa) ───────┼─► 병렬 실행
    │                          │
    ├─► 단위 테스트 (extension)─┤
    ├─► 단위 테스트 (spa) ─────┘
    │
    ▼
    E2E 테스트 (Chromium only) ─► 순차 실행
    │
    ├─► 빌드 (extension) ──────┐
    └─► 빌드 (spa) ────────────┼─► 병렬 실행
                               │
                ▼
         모두 성공 시 push 진행
         실패 시 push 중단
```

## 장점

- **빠른 피드백**: push 전 즉시 오류 발견
- **CI 시간 절약**: GitHub Actions free tier 시간 절약
- **팀 공유 가능**: .husky/ 디렉토리가 커밋되어 팀원과 공유

## 완료 기준

- [x] Husky 설치 및 초기화
- [x] .husky/pre-push 스크립트 생성
- [x] typecheck 스크립트 추가 (extension, spa)
- [x] e2e:chromium 스크립트 추가 (spa)

## 참조 문서

- [Husky 공식 문서](https://typicode.github.io/husky/)
- spec/03-spa-structure.md Section 9.1 (CI/CD)
