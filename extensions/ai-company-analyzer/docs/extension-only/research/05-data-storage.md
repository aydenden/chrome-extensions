# 데이터 저장 조사

> 조사일: 2025-12-15
> 관련 스펙: [02-data-extraction.md](../spec/02-data-extraction.md)

## 결정사항

- **IndexedDB 래퍼**: Dexie.js
- **저장소 분리**: 메타데이터(chrome.storage.local) + 바이너리(IndexedDB)
- **동기화**: 사용하지 않음 (로컬 전용, 법적 안전성 확보)
- **Dexie Cloud**: 사용하지 않음 (데이터 외부 전송 방지)
- **이유**: 스키마 관리, React 훅 지원, TypeScript 타입 안전

## 조사 대상

### 저장소 옵션

| 저장소 | 용도 | 크기 제한 | 동기화 |
|--------|------|----------|--------|
| chrome.storage.sync | 설정, 메타데이터 | ~100KB | ✅ 기기 간 |
| chrome.storage.local | 로컬 데이터 | ~5MB (무제한 가능) | ❌ |
| IndexedDB | 대용량 바이너리 | 디스크 60%까지 | ❌ |
| localStorage | 간단한 문자열 | ~5MB | ❌ |

### IndexedDB 래퍼 라이브러리

| 라이브러리 | 크기 | 특징 | 채택 |
|-----------|------|------|------|
| [Dexie.js](https://dexie.org/) | ~30KB | 스키마 관리, React 훅, 고급 쿼리 | ⭐ 채택 |
| [idb](https://www.npmjs.com/package/idb) | ~1.2KB | 경량, 네이티브에 가까움 | ❌ |
| [localForage](https://localforage.github.io/localForage/) | ~8KB | 간단한 key-value | ❌ |

## 상세 분석

### Dexie.js

**장점:**
- 스키마 버전 관리 내장 (마이그레이션 용이)
- React 훅 지원 (`useLiveQuery`)
- TypeScript 타입 안전
- 트랜잭션 지원
- 고급 쿼리 (where, filter, orderBy)

**단점:**
- 번들 크기 ~30KB (idb 대비 큼)

**스키마 정의:**
```typescript
import Dexie, { Table } from 'dexie';

interface Company {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface ExtractedData {
  id: string;
  companyId: string;
  type: DataType;
  source: string;
  extractedAt: number;
  textContent?: string;  // 텍스트 데이터
}

interface BinaryData {
  id: string;  // ExtractedData.id와 동일
  blob: Blob;
  mimeType: string;
}

class AppDatabase extends Dexie {
  companies!: Table<Company>;
  extractedData!: Table<ExtractedData>;
  binaryData!: Table<BinaryData>;

  constructor() {
    super('ai-company-analyzer');

    this.version(1).stores({
      companies: 'id, name, createdAt',
      extractedData: 'id, companyId, type, extractedAt',
      binaryData: 'id',
    });
  }
}

export const db = new AppDatabase();
```

**React 훅 사용:**
```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

function CompanyList() {
  const companies = useLiveQuery(() => db.companies.toArray());

  if (!companies) return <div>Loading...</div>;

  return (
    <ul>
      {companies.map((c) => (
        <li key={c.id}>{c.name}</li>
      ))}
    </ul>
  );
}
```

### idb

**장점:**
- 매우 경량 (~1.2KB)
- Promise 기반 API
- 네이티브 IndexedDB에 가까움

**단점:**
- 스키마 마이그레이션 수동
- 고급 쿼리 미지원

**API 예시:**
```typescript
import { openDB } from 'idb';

const db = await openDB('my-db', 1, {
  upgrade(db) {
    db.createObjectStore('companies', { keyPath: 'id' });
  },
});

await db.put('companies', { id: '1', name: 'Test' });
const company = await db.get('companies', '1');
```

### Chrome IndexedDB 최적화 (2024+)

- **Snappy 압축**: Chrome 129+에서 큰 값 자동 압축
- **성능 향상**: 1MB 데이터 로드 속도 4배 향상
- **Blob 지원**: Chrome 43+에서 완전 지원

## 저장소 분리 전략

### 역할 분담

| 저장소 | 데이터 | 이유 |
|--------|--------|------|
| **chrome.storage.local** | 설정, 캐시 데이터 | 단순 설정값 저장 |
| **IndexedDB (Dexie.js)** | 회사, 추출 데이터, Blob | 대용량, 관계형 쿼리, 로컬 전용 |

> **참고**: chrome.storage.sync는 Google 서버에 데이터가 저장되므로 "개인 사용" 전제가 깨질 수 있어 사용하지 않음

## 데이터 모델

### 타입 정의

```typescript
// types/storage.ts
type DataType =
  | 'company_info'     // 원티드: 기업 기본정보
  | 'finance_inno'     // 혁신의숲: 재무/고용
  | 'finance_dart'     // DART: PDF 재무제표
  | 'finance_smes'     // 중기벤처확인: 대차대조표/손익
  | 'review_blind'     // 블라인드: 리뷰
  | 'review_jobplanet';// 잡플래닛: 리뷰

interface Company {
  id: string;           // UUID
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface ExtractedData {
  id: string;           // UUID
  companyId: string;    // FK → Company.id
  type: DataType;
  source: string;       // 추출한 URL
  extractedAt: number;
  textContent?: string; // 텍스트 데이터 (있는 경우)
}

interface BinaryData {
  id: string;           // FK → ExtractedData.id
  blob: Blob;
  mimeType: string;     // 'image/png' | 'application/pdf'
}
```

## 주요 함수 구현

```typescript
// lib/storage.ts
import { db } from './db';

// 회사 생성
export async function createCompany(name: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.companies.add({
    id,
    name,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

// 이미지 저장 (트랜잭션)
export async function saveImage(
  companyId: string,
  blob: Blob,
  type: DataType,
  source: string
): Promise<string> {
  const id = crypto.randomUUID();

  await db.transaction('rw', [db.extractedData, db.binaryData], async () => {
    await db.extractedData.add({
      id,
      companyId,
      type,
      source,
      extractedAt: Date.now(),
    });

    await db.binaryData.add({
      id,
      blob,
      mimeType: blob.type,
    });
  });

  // 회사 updatedAt 갱신
  await db.companies.update(companyId, { updatedAt: Date.now() });

  return id;
}

// 텍스트 저장
export async function saveText(
  companyId: string,
  text: string,
  type: DataType,
  source: string
): Promise<string> {
  const id = crypto.randomUUID();

  await db.extractedData.add({
    id,
    companyId,
    type,
    source,
    extractedAt: Date.now(),
    textContent: text,
  });

  await db.companies.update(companyId, { updatedAt: Date.now() });

  return id;
}

// 이미지 URL 생성
export async function getImageUrl(id: string): Promise<string | null> {
  const data = await db.binaryData.get(id);
  if (!data) return null;
  return URL.createObjectURL(data.blob);
}

// 회사별 데이터 조회
export async function getCompanyData(companyId: string) {
  const extractedData = await db.extractedData
    .where('companyId')
    .equals(companyId)
    .toArray();

  return extractedData;
}

// 회사 삭제 (cascade)
export async function deleteCompany(companyId: string) {
  await db.transaction('rw', [db.companies, db.extractedData, db.binaryData], async () => {
    const dataIds = await db.extractedData
      .where('companyId')
      .equals(companyId)
      .primaryKeys();

    await db.binaryData.bulkDelete(dataIds);
    await db.extractedData.where('companyId').equals(companyId).delete();
    await db.companies.delete(companyId);
  });
}
```

## 법적 안전성

### 로컬 전용 저장소 선택 이유

| 항목 | 사용 여부 | 이유 |
|------|----------|------|
| chrome.storage.sync | ❌ 미사용 | Google 서버에 데이터 저장 → "개인 사용" 전제 위반 가능 |
| Dexie Cloud | ❌ 미사용 | 외부 서버 동기화 → 데이터 유출 리스크 |
| IndexedDB | ✅ 사용 | 100% 로컬 저장, 데이터 외부 전송 없음 |
| chrome.storage.local | ✅ 사용 | 로컬 전용, 설정값 저장용 |

### Dexie.js vs Dexie Cloud

- **Dexie.js**: 순수 IndexedDB 래퍼, **로컬 전용** (이 프로젝트에서 사용)
- **Dexie Cloud**: 별도 유료 애드온, 명시적 설정 필요 (사용하지 않음)

> Dexie.js만 사용하면 데이터가 브라우저 로컬에만 저장되므로 법적 안전

## 미채택 사유

| 옵션 | 사유 |
|------|------|
| idb | 스키마 마이그레이션 수동, React 훅 미지원 |
| localForage | 단순 key-value만, 관계형 쿼리 불가 |
| chrome.storage.sync | Google 서버 동기화로 "개인 사용" 전제 위반 가능 |
| Dexie Cloud | 외부 서버 동기화로 데이터 유출 리스크 |

## 참고 자료

- [Dexie.js](https://dexie.org/)
- [Dexie React Hooks](https://dexie.org/docs/Tutorial/React)
- [idb - npm](https://www.npmjs.com/package/idb)
- [IndexedDB storage improvements](https://developer.chrome.com/docs/chromium/indexeddb-storage-improvements)
- [Blob support for IndexedDB](https://developer.chrome.com/blog/blob-support-for-Indexeddb-landed-on-chrome-dev)
- [Programming Chrome Apps - Storage](https://www.oreilly.com/library/view/programming-chrome-apps/9781491905272/ch03.html)
