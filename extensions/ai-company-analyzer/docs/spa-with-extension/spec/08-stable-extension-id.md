# 08. Extension ID 고정화

## 배경

### 문제
Chrome Extension의 ID는 기본적으로 **설치 경로 기반**으로 생성된다.
- 다른 PC, 다른 경로에서 설치 시 ID가 변경됨
- SPA와 Extension 통신 시 `.env`에서 ID를 수동 관리해야 함

### 목표
`manifest.json`에 `key` 필드(공개키)를 추가하여 **어느 환경에서든 동일한 ID 보장**

---

## 설계

### ID 생성 원리

```
manifest.json에 key 필드 있음 → 공개키의 SHA256 해시로 ID 생성 (고정)
manifest.json에 key 필드 없음 → 파일 경로 기반으로 ID 생성 (가변)
```

### 공개키 vs 개인키

| 구분 | 파일/필드 | Git 커밋 | 용도 |
|------|----------|---------|------|
| 공개키 | `manifest.json`의 `key` | O | ID 생성 |
| 개인키 | `.pem` 파일 | X | `.crx` 서명 |

### 사용 시나리오별 필요 파일

| 시나리오 | key 필드 | .pem 파일 | .crx 파일 |
|---------|---------|----------|----------|
| Unpacked 로드 (현재 방식) | 필요 | 불필요 | 불필요 |
| .crx 패키징 배포 | 필요 | 필요 | 생성됨 |
| 웹 스토어 배포 | 무시됨 | 불필요 | 불필요 |

**현재 프로젝트**: Unpacked 로드만 사용 → `key` 필드만 추가하면 됨

---

## 구현

### 1. 공개키 생성

**방법 A: Chrome Developer Dashboard**
1. Extension을 `.zip`으로 압축
2. [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) 업로드 (게시 불필요)
3. Package 탭 → "View public key"
4. 줄바꿈 제거하여 한 줄로 복사

**방법 B: 로컬 생성**
1. `chrome://extensions` → "Pack extension"
2. 생성된 `.pem`에서 공개키 추출
3. 또는 [CRX Keys Generator](https://nickclaeb.github.io/crx-key-generator/) 사용

### 2. manifest.json 수정

```json
{
  "manifest_version": 3,
  "name": "AI Company Analyzer",
  "version": "1.0.0",
  "key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
  ...
}
```

### 3. 환경 변수 업데이트

Extension 재로드 후 새 ID 확인 → `.env` 및 `.env.example` 업데이트

---

## 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `extension/manifest.json` | `key` 필드 추가 |
| `spa/.env` | 고정된 ID로 업데이트 |
| `spa/.env.example` | 고정된 ID로 업데이트 |

---

## 주의사항

1. **ID 변경 시 영향**
   - `chrome.storage` 데이터: 새 ID에서 접근 불가 (초기화됨)
   - IndexedDB: 영향 없음 (SPA 도메인 기반)

2. **보안**
   - `key` 필드(공개키): 커밋 가능
   - `.pem` 파일(개인키): 커밋 금지 (`.gitignore`에 추가)

3. **dist 폴더**
   - 빌드 결과물, 커밋 불필요
   - `.crx`는 별도 패키징 작업 시에만 생성됨
