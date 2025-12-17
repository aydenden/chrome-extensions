# 데이터 동기화 패턴 기술 조사

## 개요

Chrome Extension(IndexedDB) ↔ SPA 간 데이터 동기화 패턴 조사.

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────┐
│              SPA (GitHub Pages)          │
│                                          │
│  ┌─────────────┐    ┌────────────────┐  │
│  │ React State │ ←→ │ Extension Client│  │
│  └─────────────┘    └────────────────┘  │
│                            │              │
└────────────────────────────┼──────────────┘
                             │ externally_connectable
                             ▼
┌─────────────────────────────────────────┐
│          Chrome Extension                │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │         IndexedDB (Dexie)         │   │
│  │  - companies                      │   │
│  │  - images                         │   │
│  │  - analysisResults               │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 2. 데이터 모델

### 2.1 Extension 측 (IndexedDB)

```typescript
// src/lib/db.ts (기존)
import Dexie from 'dexie';

interface Company {
  id: string;
  name: string;
  url: string;
  siteType: DataType;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredImage {
  id: string;
  companyId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  category?: ImageSubCategory;
  rawText?: string;
  analysis?: string;
  createdAt: Date;
}

class AppDatabase extends Dexie {
  companies!: Dexie.Table<Company, string>;
  images!: Dexie.Table<StoredImage, string>;

  constructor() {
    super('AICompanyAnalyzer');
    this.version(1).stores({
      companies: 'id, name, siteType, createdAt',
      images: 'id, companyId, category, createdAt',
    });
  }
}
```

### 2.2 SPA 측 (React State)

```typescript
// SPA에서 사용하는 타입 (Blob 제외)
interface CompanyDTO {
  id: string;
  name: string;
  url: string;
  siteType: DataType;
  imageCount: number;
  analyzedCount: number;
  createdAt: string; // ISO string
}

interface ImageMetaDTO {
  id: string;
  companyId: string;
  mimeType: string;
  size: number;
  category?: ImageSubCategory;
  hasAnalysis: boolean;
  createdAt: string;
}

interface ImageDataDTO {
  id: string;
  base64: string;
  mimeType: string;
  rawText?: string;
  analysis?: string;
}
```

## 3. API 설계

### 3.1 Extension External API

```typescript
// extension/src/background/external-api.ts
type MessageType =
  | 'GET_COMPANIES'
  | 'GET_COMPANY'
  | 'GET_IMAGES'
  | 'GET_IMAGE_DATA'
  | 'SAVE_ANALYSIS'
  | 'DELETE_IMAGE'
  | 'DELETE_COMPANY';

interface Message<T = any> {
  type: MessageType;
  payload?: T;
}

interface Response<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### 3.2 API 구현 (Extension)

```typescript
// extension/src/background/external-api.ts
import { db } from '@/lib/db';

const ALLOWED_ORIGINS = [
  'https://username.github.io',
  'http://localhost:5173',
];

chrome.runtime.onMessageExternal.addListener(
  async (message: Message, sender, sendResponse) => {
    // 보안 검증
    const senderOrigin = sender.url ? new URL(sender.url).origin : '';
    if (!ALLOWED_ORIGINS.includes(senderOrigin)) {
      sendResponse({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const result = await handleMessage(message);
      sendResponse({ success: true, data: result });
    } catch (error) {
      sendResponse({ success: false, error: (error as Error).message });
    }

    return true;
  }
);

async function handleMessage(message: Message): Promise<any> {
  switch (message.type) {
    case 'GET_COMPANIES':
      return getCompanies();

    case 'GET_COMPANY':
      return getCompany(message.payload.companyId);

    case 'GET_IMAGES':
      return getImages(message.payload.companyId);

    case 'GET_IMAGE_DATA':
      return getImageData(message.payload.imageId);

    case 'SAVE_ANALYSIS':
      return saveAnalysis(message.payload);

    case 'DELETE_IMAGE':
      return deleteImage(message.payload.imageId);

    case 'DELETE_COMPANY':
      return deleteCompany(message.payload.companyId);

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// 회사 목록 조회
async function getCompanies(): Promise<CompanyDTO[]> {
  const companies = await db.companies.toArray();

  return Promise.all(
    companies.map(async (company) => {
      const images = await db.images
        .where('companyId')
        .equals(company.id)
        .toArray();

      return {
        id: company.id,
        name: company.name,
        url: company.url,
        siteType: company.siteType,
        imageCount: images.length,
        analyzedCount: images.filter(i => i.analysis).length,
        createdAt: company.createdAt.toISOString(),
      };
    })
  );
}

// 이미지 메타데이터 조회 (Blob 제외)
async function getImages(companyId: string): Promise<ImageMetaDTO[]> {
  const images = await db.images
    .where('companyId')
    .equals(companyId)
    .toArray();

  return images.map(img => ({
    id: img.id,
    companyId: img.companyId,
    mimeType: img.mimeType,
    size: img.size,
    category: img.category,
    hasAnalysis: !!img.analysis,
    createdAt: img.createdAt.toISOString(),
  }));
}

// 개별 이미지 데이터 조회 (Base64 포함)
async function getImageData(imageId: string): Promise<ImageDataDTO> {
  const image = await db.images.get(imageId);
  if (!image) throw new Error('Image not found');

  const base64 = await blobToBase64(image.blob);

  return {
    id: image.id,
    base64,
    mimeType: image.mimeType,
    rawText: image.rawText,
    analysis: image.analysis,
  };
}

// 분석 결과 저장
async function saveAnalysis(data: {
  imageId: string;
  category: ImageSubCategory;
  rawText: string;
  analysis: string;
}): Promise<void> {
  await db.images.update(data.imageId, {
    category: data.category,
    rawText: data.rawText,
    analysis: data.analysis,
  });
}

// Blob → Base64 변환
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

### 3.3 SPA Client

```typescript
// spa/src/lib/extension-client.ts
const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID;

interface ExtensionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function sendMessage<T>(type: string, payload?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      reject(new Error('Extension not available'));
      return;
    }

    chrome.runtime.sendMessage(
      EXTENSION_ID,
      { type, payload },
      (response: ExtensionResponse<T>) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response.success) {
          reject(new Error(response.error || 'Unknown error'));
          return;
        }

        resolve(response.data as T);
      }
    );
  });
}

// API 함수들
export async function getCompanies(): Promise<CompanyDTO[]> {
  return sendMessage('GET_COMPANIES');
}

export async function getCompany(companyId: string): Promise<CompanyDTO> {
  return sendMessage('GET_COMPANY', { companyId });
}

export async function getImages(companyId: string): Promise<ImageMetaDTO[]> {
  return sendMessage('GET_IMAGES', { companyId });
}

export async function getImageData(imageId: string): Promise<ImageDataDTO> {
  return sendMessage('GET_IMAGE_DATA', { imageId });
}

export async function saveAnalysis(data: {
  imageId: string;
  category: string;
  rawText: string;
  analysis: string;
}): Promise<void> {
  return sendMessage('SAVE_ANALYSIS', data);
}

// Extension 설치 확인
export async function checkExtension(): Promise<boolean> {
  try {
    await sendMessage('GET_COMPANIES');
    return true;
  } catch {
    return false;
  }
}

// Base64 → Blob 변환 유틸
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
```

## 4. React 통합

### 4.1 TanStack Query 사용

```typescript
// spa/src/hooks/useExtensionData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as extensionClient from '@/lib/extension-client';

// 회사 목록
export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: extensionClient.getCompanies,
    staleTime: 30000, // 30초
  });
}

// 이미지 목록
export function useImages(companyId: string) {
  return useQuery({
    queryKey: ['images', companyId],
    queryFn: () => extensionClient.getImages(companyId),
    enabled: !!companyId,
  });
}

// 개별 이미지 (필요할 때만 로드)
export function useImageData(imageId: string | null) {
  return useQuery({
    queryKey: ['imageData', imageId],
    queryFn: () => extensionClient.getImageData(imageId!),
    enabled: !!imageId,
    staleTime: Infinity, // 캐시 영구 보관
  });
}

// 분석 결과 저장
export function useSaveAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: extensionClient.saveAnalysis,
    onSuccess: (_, variables) => {
      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: ['images', variables.companyId],
      });
      queryClient.invalidateQueries({
        queryKey: ['imageData', variables.imageId],
      });
    },
  });
}
```

### 4.2 Extension 연결 상태 관리

```typescript
// spa/src/contexts/ExtensionContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { checkExtension } from '@/lib/extension-client';

interface ExtensionState {
  isConnected: boolean;
  isChecking: boolean;
  error: string | null;
  retry: () => void;
}

const ExtensionContext = createContext<ExtensionState | null>(null);

export function ExtensionProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setIsChecking(true);
    setError(null);

    try {
      const connected = await checkExtension();
      setIsConnected(connected);
      if (!connected) {
        setError('Extension이 설치되지 않았습니다');
      }
    } catch (e) {
      setIsConnected(false);
      setError((e as Error).message);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  return (
    <ExtensionContext.Provider
      value={{ isConnected, isChecking, error, retry: check }}
    >
      {children}
    </ExtensionContext.Provider>
  );
}

export function useExtension() {
  const context = useContext(ExtensionContext);
  if (!context) {
    throw new Error('useExtension must be used within ExtensionProvider');
  }
  return context;
}
```

## 5. 실시간 동기화 (선택)

### 5.1 Port 기반 실시간 업데이트

```typescript
// Extension에서
chrome.runtime.onConnectExternal.addListener((port) => {
  console.log('SPA 연결됨');

  // 데이터 변경 시 알림
  const listener = (changes: any) => {
    port.postMessage({ type: 'DATA_CHANGED', changes });
  };

  db.on('changes', listener);

  port.onDisconnect.addListener(() => {
    db.removeListener('changes', listener);
  });
});

// SPA에서
export function subscribeToChanges(
  callback: (changes: any) => void
): () => void {
  const port = chrome.runtime.connect(EXTENSION_ID, { name: 'sync' });

  port.onMessage.addListener((msg) => {
    if (msg.type === 'DATA_CHANGED') {
      callback(msg.changes);
    }
  });

  return () => port.disconnect();
}
```

### 5.2 React Query와 연동

```typescript
// spa/src/hooks/useRealtimeSync.ts
export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscribeToChanges((changes) => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['images'] });
    });

    return unsubscribe;
  }, [queryClient]);
}
```

## 6. 오프라인 지원 (선택)

### 6.1 SPA 측 캐싱

```typescript
// Service Worker로 정적 자산 캐싱
// SPA 자체는 오프라인 동작 가능

// 하지만 Extension 데이터는 Extension이 있어야 접근 가능
// → 완전한 오프라인 지원은 어려움
```

### 6.2 권장 접근법

1. **온라인 필수**: Extension 통신은 온라인 상태 필요
2. **로컬 캐시**: React Query로 마지막 데이터 캐싱
3. **우아한 실패**: 연결 끊김 시 캐시 데이터 표시 + 재연결 버튼

## 7. 에러 처리

### 7.1 공통 에러 타입

```typescript
// shared/types/errors.ts
export enum ExtensionErrorCode {
  NOT_INSTALLED = 'NOT_INSTALLED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class ExtensionError extends Error {
  constructor(
    public code: ExtensionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}
```

### 7.2 에러 UI

```tsx
// spa/src/components/ExtensionRequired.tsx
export function ExtensionRequired({ children }: { children: React.ReactNode }) {
  const { isConnected, isChecking, error, retry } = useExtension();

  if (isChecking) {
    return <LoadingSpinner message="Extension 연결 확인 중..." />;
  }

  if (!isConnected) {
    return (
      <div className="error-container">
        <h2>Extension 연결 필요</h2>
        <p>{error || 'AI Company Analyzer Extension을 설치해주세요.'}</p>
        <button onClick={retry}>다시 시도</button>
        <a href="https://..." target="_blank">Extension 설치</a>
      </div>
    );
  }

  return <>{children}</>;
}
```

## 8. 결론

### 권장 패턴

1. **ID 기반 조회**: 메타데이터 먼저, 상세 데이터는 필요시
2. **React Query**: 캐싱, 재시도, 상태 관리 자동화
3. **Extension Context**: 연결 상태 중앙 관리
4. **실시간 동기화**: 선택적 (복잡도 증가)

### 데이터 흐름

```
[SPA 시작]
    │
    ▼
[Extension 연결 확인]
    │
    ├─ 실패 → 설치 유도
    │
    ▼
[회사 목록 조회] (메타데이터)
    │
    ▼
[이미지 목록 조회] (메타데이터)
    │
    ▼
[개별 이미지 조회] (필요시, Base64)
    │
    ▼
[OCR + 분석]
    │
    ▼
[결과 저장] → Extension IndexedDB
```
