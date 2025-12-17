# 02. 데이터 저장소

## 개요
Dexie.js (IndexedDB) + chrome.storage.local 기반 데이터 저장소 구현

## 선행 조건
- 01-project-setup 완료

## 기술 스택
| 분류 | 기술 | 용도 |
|------|------|------|
| IndexedDB 래퍼 | Dexie.js ^4.0.10 | 회사 데이터, 이미지 저장 |
| React 훅 | dexie-react-hooks ^1.1.7 | 실시간 데이터 조회 |
| 설정 저장 | chrome.storage.local | 사이트 설정, AI 설정 |

---

## 저장소 분리 전략

| 저장소 | 데이터 | 이유 |
|--------|--------|------|
| **IndexedDB (Dexie.js)** | 회사, 추출 데이터, Blob | 대용량, 관계형 쿼리, 로컬 전용 |
| **chrome.storage.local** | 설정값 | 단순 설정, 5MB 제한 |

> **중요**: chrome.storage.sync는 Google 서버에 동기화되므로 사용하지 않음 (법적 안전성)

---

## 데이터 모델

### 타입 정의 (src/types/storage.ts)

```typescript
// 데이터 타입
export type DataType =
  | 'company_info'      // 원티드: 기업 기본정보
  | 'finance_inno'      // 혁신의숲: 재무/고용
  | 'finance_dart'      // DART: PDF 재무제표
  | 'finance_smes'      // 중기벤처확인: 대차대조표/손익
  | 'review_blind'      // 블라인드: 리뷰
  | 'review_jobplanet'; // 잡플래닛: 리뷰

// 회사
export interface Company {
  id: string;           // UUID
  name: string;
  createdAt: number;    // timestamp
  updatedAt: number;
}

// 추출된 데이터
export interface ExtractedData {
  id: string;           // UUID
  companyId: string;    // FK → Company.id
  type: DataType;
  source: string;       // 추출한 URL
  extractedAt: number;
  textContent?: string; // 텍스트 데이터
}

// 바이너리 데이터 (이미지, PDF)
export interface BinaryData {
  id: string;           // FK → ExtractedData.id
  blob: Blob;
  mimeType: string;     // 'image/png' | 'application/pdf'
}

// AI 분석 결과
export interface AnalysisResult {
  id: string;
  companyId: string;
  analyzedAt: number;
  totalScore: number;   // 1-5점

  runway?: {
    months: number;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  };

  financialRisk?: {
    level: 'high' | 'medium' | 'low';
    factors: string[];
  };

  reviewSummary?: {
    positive: string[];
    negative: string[];
    summary: string;
  };
}
```

---

## Dexie.js 데이터베이스 설정

### src/lib/db.ts

```typescript
import Dexie, { Table } from 'dexie';
import type { Company, ExtractedData, BinaryData, AnalysisResult } from '@/types/storage';

export class AppDatabase extends Dexie {
  companies!: Table<Company>;
  extractedData!: Table<ExtractedData>;
  binaryData!: Table<BinaryData>;
  analysisResults!: Table<AnalysisResult>;

  constructor() {
    super('ai-company-analyzer');

    this.version(1).stores({
      companies: 'id, name, createdAt, updatedAt',
      extractedData: 'id, companyId, type, extractedAt',
      binaryData: 'id',
      analysisResults: 'id, companyId, analyzedAt',
    });
  }
}

export const db = new AppDatabase();
```

---

## 저장소 함수 구현

### src/lib/storage.ts

```typescript
import { db } from './db';
import type { Company, ExtractedData, BinaryData, DataType, AnalysisResult } from '@/types/storage';

// ============ 회사 CRUD ============

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

// 회사 조회
export async function getCompany(id: string): Promise<Company | undefined> {
  return db.companies.get(id);
}

// 회사 목록 조회
export async function getAllCompanies(): Promise<Company[]> {
  return db.companies.orderBy('updatedAt').reverse().toArray();
}

// 회사 이름으로 검색
export async function searchCompanies(query: string): Promise<Company[]> {
  const lowerQuery = query.toLowerCase();
  return db.companies
    .filter(c => c.name.toLowerCase().includes(lowerQuery))
    .toArray();
}

// 회사 수정
export async function updateCompany(id: string, updates: Partial<Company>): Promise<void> {
  await db.companies.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

// 회사 삭제 (cascade)
export async function deleteCompany(companyId: string): Promise<void> {
  await db.transaction('rw', [db.companies, db.extractedData, db.binaryData, db.analysisResults], async () => {
    // 관련 데이터 ID 조회
    const dataIds = await db.extractedData
      .where('companyId')
      .equals(companyId)
      .primaryKeys();

    // 바이너리 데이터 삭제
    await db.binaryData.bulkDelete(dataIds);

    // 추출 데이터 삭제
    await db.extractedData.where('companyId').equals(companyId).delete();

    // 분석 결과 삭제
    await db.analysisResults.where('companyId').equals(companyId).delete();

    // 회사 삭제
    await db.companies.delete(companyId);
  });
}

// ============ 데이터 저장 ============

// 텍스트 데이터 저장
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

  await db.companies.update(companyId, { updatedAt: Date.now() });

  return id;
}

// ============ 데이터 조회 ============

// 회사별 추출 데이터 조회
export async function getCompanyData(companyId: string): Promise<ExtractedData[]> {
  return db.extractedData
    .where('companyId')
    .equals(companyId)
    .toArray();
}

// 타입별 데이터 조회
export async function getDataByType(companyId: string, type: DataType): Promise<ExtractedData[]> {
  return db.extractedData
    .where(['companyId', 'type'])
    .equals([companyId, type])
    .toArray();
}

// 이미지 Blob 조회
export async function getImageBlob(id: string): Promise<Blob | undefined> {
  const data = await db.binaryData.get(id);
  return data?.blob;
}

// 이미지 URL 생성 (ObjectURL)
export async function getImageUrl(id: string): Promise<string | null> {
  const blob = await getImageBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

// ============ 분석 결과 ============

// 분석 결과 저장
export async function saveAnalysisResult(result: Omit<AnalysisResult, 'id'>): Promise<string> {
  const id = crypto.randomUUID();

  await db.analysisResults.add({
    id,
    ...result,
  });

  await db.companies.update(result.companyId, { updatedAt: Date.now() });

  return id;
}

// 분석 결과 조회
export async function getAnalysisResult(companyId: string): Promise<AnalysisResult | undefined> {
  return db.analysisResults
    .where('companyId')
    .equals(companyId)
    .last();
}

// ============ 유틸리티 ============

// 전체 데이터 내보내기
export async function exportAllData(): Promise<object> {
  const companies = await db.companies.toArray();
  const extractedData = await db.extractedData.toArray();
  const analysisResults = await db.analysisResults.toArray();

  // 바이너리 데이터는 base64로 변환
  const binaryData = await db.binaryData.toArray();
  const binaryBase64 = await Promise.all(
    binaryData.map(async (b) => ({
      id: b.id,
      mimeType: b.mimeType,
      data: await blobToBase64(b.blob),
    }))
  );

  return {
    version: 1,
    exportedAt: Date.now(),
    companies,
    extractedData,
    binaryData: binaryBase64,
    analysisResults,
  };
}

// Blob → Base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 전체 데이터 삭제
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.companies, db.extractedData, db.binaryData, db.analysisResults], async () => {
    await db.companies.clear();
    await db.extractedData.clear();
    await db.binaryData.clear();
    await db.analysisResults.clear();
  });
}
```

---

## React 훅 사용

### 회사 목록 실시간 조회

```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

function CompanyList() {
  const companies = useLiveQuery(
    () => db.companies.orderBy('updatedAt').reverse().toArray()
  );

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

### 회사 상세 데이터 조회

```typescript
function CompanyDetail({ companyId }: { companyId: string }) {
  const company = useLiveQuery(
    () => db.companies.get(companyId),
    [companyId]
  );

  const extractedData = useLiveQuery(
    () => db.extractedData.where('companyId').equals(companyId).toArray(),
    [companyId]
  );

  if (!company) return <div>Loading...</div>;

  return (
    <div>
      <h1>{company.name}</h1>
      <p>수집된 데이터: {extractedData?.length || 0}개</p>
    </div>
  );
}
```

---

## Chrome Storage 설정

### src/lib/settings.ts

```typescript
// 설정 타입
export interface SiteConfig {
  id: string;
  name: string;
  urlPattern: string;
  dataTypes: string[];
  extractionGuide: string;
}

export interface AISettings {
  weights: {
    financial: number;  // 0-100
    review: number;     // 0-100
  };
  prompts: {
    companyExtraction: string;
    financialAnalysis: string;
    reviewAnalysis: string;
    totalScore: string;
  };
}

// 설정 저장
export async function saveSettings<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// 설정 조회
export async function getSettings<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key];
}

// 사이트 설정 조회
export async function getSiteConfigs(): Promise<SiteConfig[]> {
  const configs = await getSettings<SiteConfig[]>('siteConfigs');
  return configs || getDefaultSiteConfigs();
}

// AI 설정 조회
export async function getAISettings(): Promise<AISettings> {
  const settings = await getSettings<AISettings>('aiSettings');
  return settings || getDefaultAISettings();
}

// 기본 사이트 설정
function getDefaultSiteConfigs(): SiteConfig[] {
  return [
    {
      id: 'wanted',
      name: '원티드',
      urlPattern: 'https://www.wanted.co.kr/company/*',
      dataTypes: ['company_info'],
      extractionGuide: '회사 정보 페이지에서 추출하세요',
    },
    // ... 다른 사이트 설정
  ];
}

// 기본 AI 설정
function getDefaultAISettings(): AISettings {
  return {
    weights: {
      financial: 60,
      review: 40,
    },
    prompts: {
      companyExtraction: '...',
      financialAnalysis: '...',
      reviewAnalysis: '...',
      totalScore: '...',
    },
  };
}
```

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/types/storage.ts` | 데이터 타입 정의 |
| `src/lib/db.ts` | Dexie.js 데이터베이스 설정 |
| `src/lib/storage.ts` | 저장소 CRUD 함수 |
| `src/lib/settings.ts` | Chrome Storage 설정 관리 |

---

## 참조 문서
- [spec/03-data-storage.md](../spec/03-data-storage.md) - 데이터 저장 구조
- [research/05-data-storage.md](../research/05-data-storage.md) - 저장소 기술 조사
