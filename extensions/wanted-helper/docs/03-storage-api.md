# Chrome Storage API

## 목차
- [Storage API란?](#storage-api란)
- [4가지 저장소 유형](#4가지-저장소-유형)
- [기본 사용법](#기본-사용법)
- [현재 프로젝트 예시](#현재-프로젝트-예시)
- [고급 패턴](#고급-패턴)
- [베스트 프랙티스](#베스트-프랙티스)
- [일반적인 문제와 해결책](#일반적인-문제와-해결책)

## Storage API란?

`chrome.storage` API는 확장 프로그램 전용 데이터 저장소를 제공합니다. 웹의 `localStorage`와 유사하지만, 확장 프로그램의 요구사항에 특화되어 있습니다.

### localStorage vs chrome.storage

| 특징 | localStorage | chrome.storage |
|------|--------------|----------------|
| **비동기** | ❌ 동기 (블로킹) | ✅ 비동기 |
| **동기화** | ❌ 불가능 | ✅ 가능 (sync) |
| **용량** | ~5MB | 10MB+ |
| **Content Script 접근** | ❌ 불가능 | ✅ 가능 |
| **API 스타일** | 동기 | Promise/Callback |
| **데이터 타입** | 문자열만 | 객체 직접 저장 |

### 주요 장점
1. **비동기 처리**: 페이지 성능에 영향 없음
2. **용량 확대 가능**: `unlimitedStorage` 권한으로 확장
3. **동기화 지원**: 여러 기기 간 설정 공유
4. **확장 프로그램 전체에서 접근 가능**: Service worker, Content script, Popup 모두 접근 가능

## 4가지 저장소 유형

### 1. storage.local

**로컬 기기에만 저장되는 데이터**

```javascript
// 저장
await chrome.storage.local.set({
  theme: 'dark',
  lastVisit: Date.now()
});

// 읽기
const result = await chrome.storage.local.get(['theme', 'lastVisit']);
console.log(result.theme); // 'dark'
```

#### 특징
- **용량**: 기본 10MB (Chrome 113+), 이전 버전 5MB
- **확장**: `"unlimitedStorage"` 권한으로 무제한
- **동기화**: 안 됨 (기기별로 독립적)
- **용도**: 큰 데이터, 캐시, 기기별 설정

#### 사용 사례
```javascript
// 대용량 캐시 저장
await chrome.storage.local.set({
  cachedData: largeDataSet,
  cacheTimestamp: Date.now()
});

// 기기별 상태 저장
await chrome.storage.local.set({
  deviceId: generateDeviceId(),
  lastActiveTab: tabId
});
```

### 2. storage.sync

**Chrome 동기화를 통해 모든 로그인 기기에 동기화**

```javascript
// 저장
await chrome.storage.sync.set({
  blockedSites: ['example.com'],
  fontSize: 16
});

// 읽기
const result = await chrome.storage.sync.get(['blockedSites', 'fontSize']);
```

#### 특징
- **용량**: 약 100KB 총량
- **항목 제한**: 최대 512개 항목
- **항목당 용량**: 8KB
- **쓰기 제한**:
  - 분당 최대 120회
  - 시간당 최대 1,800회
- **용도**: 사용자 설정, 작은 데이터

#### 제한 사항
```javascript
// ❌ 제한 초과
await chrome.storage.sync.set({
  largeData: 'x'.repeat(10000) // 8KB 초과
});

// ✅ 올바른 사용
await chrome.storage.sync.set({
  userPreferences: {
    theme: 'dark',
    language: 'ko',
    notifications: true
  }
});
```

#### 오프라인 동기화
- 오프라인 상태에서도 로컬에 저장됨
- 온라인 복귀 시 자동 동기화
- 충돌 시 최신 데이터 우선 (last-write-wins)

### 3. storage.session

**세션 동안만 유지되는 메모리 기반 저장소**

```javascript
// 저장
await chrome.storage.session.set({
  tempToken: 'abc123',
  currentStep: 2
});

// 읽기
const result = await chrome.storage.session.get(['tempToken']);
```

#### 특징
- **용량**: 10MB (Chrome 111+), 이전 버전 1MB
- **수명**: 확장 프로그램 세션 동안만 유지
- **삭제 시점**:
  - 확장 프로그램 비활성화
  - 확장 프로그램 업데이트
  - 확장 프로그램 재로드
  - Service worker 종료는 삭제 안 됨
- **용도**: 민감한 임시 데이터, 세션 상태

#### 사용 사례
```javascript
// 인증 토큰 (세션 동안만)
await chrome.storage.session.set({
  accessToken: token,
  tokenExpiry: Date.now() + 3600000
});

// 작업 진행 상태
await chrome.storage.session.set({
  uploadProgress: 45,
  processingQueue: [item1, item2]
});
```

### 4. storage.managed

**관리자가 설정한 읽기 전용 저장소 (엔터프라이즈용)**

```javascript
// 읽기만 가능
const result = await chrome.storage.managed.get(['companyPolicy']);
console.log(result.companyPolicy);

// ❌ 쓰기 불가능 (에러 발생)
await chrome.storage.managed.set({ policy: 'new' });
```

#### 특징
- **읽기 전용**: 확장 프로그램에서 수정 불가
- **관리**: Windows 그룹 정책 또는 macOS 구성 프로필
- **용도**: 기업 정책, 조직 설정
- **대부분의 개인 개발자는 사용 안 함**

## 기본 사용법

### 권한 설정

```json
{
  "permissions": ["storage"]
}
```

### 저장 (set)

```javascript
// Promise 방식 (권장)
await chrome.storage.local.set({ key: 'value' });

// Callback 방식
chrome.storage.local.set({ key: 'value' }, () => {
  console.log('Saved');
});

// 여러 항목 한 번에
await chrome.storage.sync.set({
  username: 'john',
  email: 'john@example.com',
  settings: {
    theme: 'dark',
    notifications: true
  }
});
```

### 읽기 (get)

```javascript
// 특정 키 읽기
const result = await chrome.storage.local.get(['key1', 'key2']);
console.log(result.key1, result.key2);

// 기본값 지정
const result = await chrome.storage.local.get({
  theme: 'light',  // 기본값
  fontSize: 14
});

// 모든 데이터 읽기
const allData = await chrome.storage.local.get(null);

// 단일 키 (문자열로)
const result = await chrome.storage.local.get('username');
console.log(result.username);
```

### 삭제 (remove)

```javascript
// 특정 키 삭제
await chrome.storage.local.remove('key1');

// 여러 키 삭제
await chrome.storage.local.remove(['key1', 'key2']);

// 모든 데이터 삭제
await chrome.storage.local.clear();
```

### 변경 감지 (onChanged)

```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('Storage area:', areaName); // 'local', 'sync', 'session'

  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(`${key}: ${oldValue} → ${newValue}`);
  }
});

// 특정 storage area만 감지
chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.theme) {
    applyTheme(changes.theme.newValue);
  }
});
```

## 현재 프로젝트 예시

### Manifest 설정

```json
{
  "permissions": ["storage"]
}
```

### 실제 사용 코드 (`src/index.ts`)

```typescript
// 1. 데이터 읽기
chrome.storage.sync.get(['companyIds', 'positionIds'], (result) => {
  const companyIds = result.companyIds || [];
  const positionIds = result.positionIds || [];

  updateCardStyles(companyIds, positionIds);
});

// 2. 데이터 저장
function addCompanyToBlacklist(companyId: string) {
  chrome.storage.sync.get(['companyIds'], (result) => {
    const companyIds = result.companyIds || [];

    if (!companyIds.includes(companyId)) {
      companyIds.push(companyId);
      chrome.storage.sync.set({ companyIds }, () => {
        console.log('Company added to blacklist');
      });
    }
  });
}

// 3. 데이터 제거
function removeCompanyFromBlacklist(companyId: string) {
  chrome.storage.sync.get(['companyIds'], (result) => {
    const companyIds = result.companyIds || [];
    const index = companyIds.indexOf(companyId);

    if (index > -1) {
      companyIds.splice(index, 1);
      chrome.storage.sync.set({ companyIds }, () => {
        console.log('Company removed from blacklist');
      });
    }
  });
}
```

### 개선된 버전 (Promise + async/await)

```typescript
// 유틸리티 함수
async function getBlockedIds() {
  const result = await chrome.storage.sync.get(['companyIds', 'positionIds']);
  return {
    companyIds: result.companyIds || [],
    positionIds: result.positionIds || []
  };
}

async function addCompanyToBlacklist(companyId: string) {
  const { companyIds } = await getBlockedIds();

  if (!companyIds.includes(companyId)) {
    companyIds.push(companyId);
    await chrome.storage.sync.set({ companyIds });
    console.log('Company added');
  }
}

async function removeCompanyFromBlacklist(companyId: string) {
  const { companyIds } = await getBlockedIds();
  const filtered = companyIds.filter(id => id !== companyId);

  await chrome.storage.sync.set({ companyIds: filtered });
  console.log('Company removed');
}

// 사용
(async () => {
  const { companyIds, positionIds } = await getBlockedIds();
  updateCardStyles(companyIds, positionIds);
})();
```

### 변경 감지 추가

```typescript
// 다른 탭이나 컴포넌트에서 변경 시 자동 업데이트
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes.companyIds || changes.positionIds) {
      // 변경된 데이터로 UI 업데이트
      const companyIds = changes.companyIds?.newValue || [];
      const positionIds = changes.positionIds?.newValue || [];
      updateCardStyles(companyIds, positionIds);
    }
  }
});
```

## 고급 패턴

### 1. 배치 쓰기

```javascript
// ❌ 비효율: 여러 번 호출
await chrome.storage.local.set({ key1: 'value1' });
await chrome.storage.local.set({ key2: 'value2' });
await chrome.storage.local.set({ key3: 'value3' });

// ✅ 효율적: 한 번에 저장
await chrome.storage.local.set({
  key1: 'value1',
  key2: 'value2',
  key3: 'value3'
});
```

### 2. 트랜잭션 패턴

```javascript
async function addToArray(key, value) {
  // 1. 읽기
  const result = await chrome.storage.local.get([key]);
  const array = result[key] || [];

  // 2. 수정
  array.push(value);

  // 3. 쓰기
  await chrome.storage.local.set({ [key]: array });
}

// 동시성 문제 가능 - 개선 버전
async function safeAddToArray(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      const array = result[key] || [];
      array.push(value);
      chrome.storage.local.set({ [key]: array }, resolve);
    });
  });
}
```

### 3. 캐시 패턴

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in ms
}

async function setCache<T>(key: string, data: T, ttl: number = 3600000) {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl
  };
  await chrome.storage.local.set({ [key]: entry });
}

async function getCache<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get([key]);
  const entry: CacheEntry<T> = result[key];

  if (!entry) return null;

  // TTL 체크
  if (Date.now() - entry.timestamp > entry.ttl) {
    // 만료됨
    await chrome.storage.local.remove(key);
    return null;
  }

  return entry.data;
}

// 사용
await setCache('userData', { name: 'John' }, 3600000); // 1시간
const userData = await getCache('userData');
```

### 4. 마이그레이션 패턴

```typescript
const STORAGE_VERSION = 2;

async function migrateStorage() {
  const result = await chrome.storage.local.get(['storageVersion']);
  const currentVersion = result.storageVersion || 1;

  if (currentVersion < STORAGE_VERSION) {
    if (currentVersion === 1) {
      await migrateV1ToV2();
    }

    await chrome.storage.local.set({ storageVersion: STORAGE_VERSION });
  }
}

async function migrateV1ToV2() {
  // V1: 배열로 저장
  // V2: 객체로 저장 (더 많은 정보 포함)
  const result = await chrome.storage.local.get(['blockedCompanies']);
  const oldData = result.blockedCompanies || [];

  const newData = oldData.map(id => ({
    id,
    addedAt: Date.now(),
    reason: 'migrated'
  }));

  await chrome.storage.local.set({ blockedCompanies: newData });
}

// 확장 프로그램 시작 시 실행
migrateStorage();
```

## 베스트 프랙티스

### 1. 적절한 Storage 선택

```javascript
// ✅ 사용자 설정 → sync
await chrome.storage.sync.set({ theme: 'dark' });

// ✅ 큰 캐시 데이터 → local
await chrome.storage.local.set({ cachedImages: largeData });

// ✅ 임시 토큰 → session
await chrome.storage.session.set({ accessToken: token });
```

### 2. 에러 처리

```javascript
try {
  await chrome.storage.sync.set({ data: value });
} catch (error) {
  if (error.message.includes('QUOTA_BYTES')) {
    console.error('Storage quota exceeded');
    // Fallback 로직
  }
}

// Callback 방식 에러 처리
chrome.storage.sync.set({ data: value }, () => {
  if (chrome.runtime.lastError) {
    console.error('Error:', chrome.runtime.lastError.message);
  }
});
```

### 3. 기본값 제공

```javascript
// ❌ 나쁨: undefined 체크
const result = await chrome.storage.local.get(['key']);
const value = result.key !== undefined ? result.key : 'default';

// ✅ 좋음: 기본값 객체 사용
const result = await chrome.storage.local.get({
  key: 'default',
  anotherKey: 0
});
console.log(result.key); // 항상 값이 있음
```

### 4. 구조화된 데이터

```javascript
// ✅ 좋음: 구조화
await chrome.storage.sync.set({
  settings: {
    theme: 'dark',
    language: 'ko',
    notifications: {
      enabled: true,
      sound: false
    }
  }
});

// 읽기
const result = await chrome.storage.sync.get(['settings']);
const theme = result.settings?.theme || 'light';
```

### 5. 용량 관리

```javascript
// 현재 사용량 확인
const bytes = await chrome.storage.sync.getBytesInUse(null);
console.log(`Using ${bytes} bytes`);

// 특정 키의 사용량
const keyBytes = await chrome.storage.sync.getBytesInUse(['key1', 'key2']);

// Quota 정보
chrome.storage.sync.QUOTA_BYTES // 102400 (100KB)
chrome.storage.sync.QUOTA_BYTES_PER_ITEM // 8192 (8KB)
chrome.storage.sync.MAX_ITEMS // 512
```

## 일반적인 문제와 해결책

### 문제 1: QUOTA_BYTES 초과

```javascript
// 해결: 데이터 압축 또는 local 사용
async function saveData(key, data) {
  try {
    await chrome.storage.sync.set({ [key]: data });
  } catch (error) {
    if (error.message.includes('QUOTA_BYTES')) {
      // Fallback: local storage 사용
      await chrome.storage.local.set({ [key]: data });
      console.warn('Using local storage due to quota');
    }
  }
}
```

### 문제 2: 동시 쓰기 충돌

```javascript
// 문제 상황: 두 곳에서 동시에 배열 업데이트
// A: array = [1, 2], push(3) → [1, 2, 3]
// B: array = [1, 2], push(4) → [1, 2, 4]
// 결과: 마지막 쓰기만 남음 (데이터 손실)

// 해결: Set 사용 또는 타임스탬프 기반 병합
async function addToSet(key, value) {
  const result = await chrome.storage.local.get([key]);
  const set = new Set(result[key] || []);
  set.add(value);
  await chrome.storage.local.set({ [key]: Array.from(set) });
}
```

### 문제 3: 객체 참조 문제

```javascript
// ❌ 문제: 참조가 저장됨
const settings = { theme: 'dark' };
await chrome.storage.local.set({ settings });
settings.theme = 'light'; // 원본 변경
const result = await chrome.storage.local.get(['settings']);
// result.settings.theme은 여전히 'dark' (복사본이 저장됨)

// ✅ 올바른 이해: Storage는 항상 복사본 저장
```

## 참고 자료

- [Chrome for Developers - Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Storage API Samples](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples/storage)

## 다음 단계

Storage API를 이해했다면, 다음을 학습하세요:
- **[메시지 전달](./04-messaging.md)** - 컴포넌트 간 데이터 공유
- **[MutationObserver](./05-mutation-observer.md)** - 동적 페이지 감지
