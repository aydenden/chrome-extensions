# Extension ID 고정화 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** manifest.json에 key 필드를 추가하여 어느 환경에서든 동일한 Extension ID 보장

**Architecture:** Chrome Extension의 ID는 manifest.json의 key 필드(공개키)로 결정됨. 공개키를 추가하면 설치 경로와 무관하게 항상 동일한 ID 생성. SPA의 환경변수도 고정된 ID로 업데이트.

**Tech Stack:** Chrome Extension Manifest V3, OpenSSL (키 생성)

---

## Task 1: 키 페어 생성

**Files:**
- Create: `extension/extension.pem` (임시, .gitignore에 추가됨)

**Step 1: OpenSSL로 RSA 키 페어 생성**

```bash
cd extensions/ai-company-analyzer/extension
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out extension.pem
```

**Step 2: 생성 확인**

Run: `ls -la extension.pem`
Expected: 파일이 존재하고 크기가 약 1.7KB

---

## Task 2: 공개키 추출

**Files:**
- Read: `extension/extension.pem`

**Step 1: PEM에서 공개키 추출 및 Base64 인코딩**

```bash
cd extensions/ai-company-analyzer/extension
openssl rsa -in extension.pem -pubout -outform DER | openssl base64 -A
```

**Step 2: 출력된 공개키 복사**

Expected: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...` 형태의 한 줄 문자열

---

## Task 3: manifest.json에 key 필드 추가

**Files:**
- Modify: `extension/manifest.json:1-5`

**Step 1: key 필드 추가**

manifest.json 상단에 key 필드 추가:

```json
{
  "manifest_version": 3,
  "name": "AI Company Analyzer",
  "version": "1.0.0",
  "key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...(Task 2에서 복사한 값)",
  "description": "기업 정보 수집 및 AI 분석",
  ...
}
```

**Step 2: JSON 문법 검증**

Run: `cd extensions/ai-company-analyzer/extension && cat manifest.json | python3 -m json.tool > /dev/null && echo "Valid JSON"`
Expected: "Valid JSON"

---

## Task 4: Extension 재빌드 및 ID 확인

**Files:**
- Read: `extension/dist/manifest.json` (빌드 결과)

**Step 1: Extension 빌드**

Run: `cd extensions/ai-company-analyzer && bun run build:ext`
Expected: 빌드 성공

**Step 2: Chrome에서 Extension 재로드**

1. `chrome://extensions/` 접속
2. "AI Company Analyzer" 찾기
3. 새로고침 아이콘 클릭
4. 표시된 ID 복사 (예: `abcdefghijklmnopqrstuvwxyzabcdef`)

**Step 3: ID가 고정되었는지 확인**

Expected: 32자 소문자 알파벳 ID (재로드해도 동일)

---

## Task 5: SPA 환경변수 업데이트

**Files:**
- Modify: `spa/.env`
- Modify: `spa/.env.example`

**Step 1: .env 파일 업데이트**

```env
VITE_EXTENSION_ID=<Task 4에서 확인한 고정 ID>
```

**Step 2: .env.example 업데이트**

```env
VITE_EXTENSION_ID=<Task 4에서 확인한 고정 ID>
```

**Step 3: 환경변수 확인**

Run: `cat extensions/ai-company-analyzer/spa/.env`
Expected: 새 ID가 설정되어 있음

---

## Task 6: .gitignore에 .pem 추가

**Files:**
- Modify: `extension/.gitignore` (없으면 생성)

**Step 1: .gitignore 확인 또는 생성**

```bash
cd extensions/ai-company-analyzer/extension
echo "*.pem" >> .gitignore
```

**Step 2: .pem 파일이 무시되는지 확인**

Run: `cd extensions/ai-company-analyzer && git status --porcelain extension/extension.pem`
Expected: 출력 없음 (추적되지 않음)

---

## Task 7: 연동 테스트

**Files:**
- None (테스트만)

**Step 1: SPA 개발 서버 시작**

Run: `cd extensions/ai-company-analyzer/spa && bun run dev`
Expected: Vite 서버 시작

**Step 2: Extension 연결 확인**

1. 브라우저에서 `http://localhost:5173` 접속
2. 개발자 도구 콘솔에서 Extension 연결 상태 확인
3. "Extension connected" 또는 PING 응답 확인

Expected: SPA와 Extension 통신 정상

---

## Task 8: 커밋

**Step 1: 변경사항 확인**

Run: `cd extensions/ai-company-analyzer && git status`
Expected: manifest.json, .env, .env.example, .gitignore 변경됨

**Step 2: 커밋**

```bash
cd extensions/ai-company-analyzer
git add extension/manifest.json extension/.gitignore spa/.env spa/.env.example
git commit -m "feat(extension): add stable extension ID via manifest key

- Add public key to manifest.json for consistent ID across environments
- Update SPA .env with fixed extension ID
- Add .pem to .gitignore for security

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 주의사항

1. **extension.pem 파일은 절대 커밋하지 않음** (개인키)
2. **ID 변경 시 chrome.storage 데이터 초기화됨** (새 ID에서 접근 불가)
3. **IndexedDB는 영향 없음** (SPA 도메인 기반)
