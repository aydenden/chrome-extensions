# Extension API 스펙

## 1. 개요

Chrome Extension이 SPA에 제공하는 External API 명세.

## 2. 통신 프로토콜

### 2.1 요청 형식

```typescript
interface Request<T = any> {
  type: MessageType;
  payload?: T;
}
```

### 2.2 응답 형식

```typescript
interface Response<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
  };
}
```

### 2.3 에러 코드

```typescript
enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
}
```

## 3. API 엔드포인트

### 3.1 회사 관련

#### GET_COMPANIES

회사 목록 조회.

**요청:**
```typescript
{
  type: 'GET_COMPANIES',
  payload?: {
    siteType?: DataType;  // 필터 (선택)
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
  }
}
```

**응답:**
```typescript
{
  success: true,
  data: CompanyDTO[]
}

interface CompanyDTO {
  id: string;
  name: string;
  url: string;
  siteType: DataType;
  imageCount: number;
  analyzedCount: number;
  createdAt: string;  // ISO 8601
  updatedAt: string;
}
```

**예시:**
```typescript
// 요청
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'GET_COMPANIES',
  payload: { siteType: 'WANTED' }
});

// 응답
{
  success: true,
  data: [
    {
      id: 'company_abc123',
      name: '(주)테크스타트',
      url: 'https://www.wanted.co.kr/company/12345',
      siteType: 'WANTED',
      imageCount: 5,
      analyzedCount: 3,
      createdAt: '2024-01-15T09:30:00.000Z',
      updatedAt: '2024-01-15T10:45:00.000Z'
    }
  ]
}
```

---

#### GET_COMPANY

개별 회사 상세 조회.

**요청:**
```typescript
{
  type: 'GET_COMPANY',
  payload: {
    companyId: string;
  }
}
```

**응답:**
```typescript
{
  success: true,
  data: CompanyDetailDTO
}

interface CompanyDetailDTO extends CompanyDTO {
  metadata?: {
    industry?: string;
    employeeCount?: string;
    foundedYear?: string;
  };
}
```

---

#### DELETE_COMPANY

회사 및 관련 데이터 삭제.

**요청:**
```typescript
{
  type: 'DELETE_COMPANY',
  payload: {
    companyId: string;
  }
}
```

**응답:**
```typescript
{
  success: true,
  data: {
    deletedImages: number;
  }
}
```

---

### 3.2 이미지 관련

#### GET_IMAGES

회사의 이미지 목록 조회 (메타데이터만).

**요청:**
```typescript
{
  type: 'GET_IMAGES',
  payload: {
    companyId: string;
    filter?: {
      category?: ImageSubCategory;
      hasAnalysis?: boolean;
    }
  }
}
```

**응답:**
```typescript
{
  success: true,
  data: ImageMetaDTO[]
}

interface ImageMetaDTO {
  id: string;
  companyId: string;
  mimeType: string;
  size: number;          // bytes
  width?: number;
  height?: number;
  category?: ImageSubCategory;
  hasRawText: boolean;
  hasAnalysis: boolean;
  createdAt: string;
}
```

---

#### GET_IMAGE_DATA

개별 이미지 데이터 조회 (Base64 포함).

**요청:**
```typescript
{
  type: 'GET_IMAGE_DATA',
  payload: {
    imageId: string;
    includeRawText?: boolean;  // 기본 true
    includeAnalysis?: boolean; // 기본 true
  }
}
```

**응답:**
```typescript
{
  success: true,
  data: ImageDataDTO
}

interface ImageDataDTO {
  id: string;
  base64: string;        // Base64 인코딩된 이미지
  mimeType: string;
  rawText?: string;      // OCR 결과
  analysis?: string;     // LLM 분석 결과
  category?: ImageSubCategory;
}
```

**크기 제한:**
- 권장 이미지 크기: 5MB 이하
- Base64 인코딩 후: ~6.5MB

---

#### GET_IMAGE_THUMBNAIL

이미지 썸네일 조회 (목록 표시용).

**요청:**
```typescript
{
  type: 'GET_IMAGE_THUMBNAIL',
  payload: {
    imageId: string;
    maxWidth?: number;   // 기본 200
    maxHeight?: number;  // 기본 200
  }
}
```

**응답:**
```typescript
{
  success: true,
  data: {
    base64: string;
    mimeType: 'image/jpeg';
    width: number;
    height: number;
  }
}
```

---

#### DELETE_IMAGE

이미지 삭제.

**요청:**
```typescript
{
  type: 'DELETE_IMAGE',
  payload: {
    imageId: string;
  }
}
```

**응답:**
```typescript
{
  success: true,
  data: null
}
```

---

### 3.3 분석 관련

#### SAVE_ANALYSIS

분석 결과 저장.

**요청:**
```typescript
{
  type: 'SAVE_ANALYSIS',
  payload: {
    imageId: string;
    category: ImageSubCategory;
    rawText: string;
    analysis: string;
  }
}
```

**응답:**
```typescript
{
  success: true,
  data: {
    updatedAt: string;
  }
}
```

---

#### BATCH_SAVE_ANALYSIS

여러 분석 결과 일괄 저장.

**요청:**
```typescript
{
  type: 'BATCH_SAVE_ANALYSIS',
  payload: {
    results: Array<{
      imageId: string;
      category: ImageSubCategory;
      rawText: string;
      analysis: string;
    }>;
  }
}
```

**응답:**
```typescript
{
  success: true,
  data: {
    savedCount: number;
    failedIds: string[];
  }
}
```

---

### 3.4 시스템 관련

#### PING

연결 상태 확인.

**요청:**
```typescript
{
  type: 'PING'
}
```

**응답:**
```typescript
{
  success: true,
  data: {
    version: string;       // Extension 버전
    timestamp: string;
  }
}
```

---

#### GET_STATS

통계 조회.

**요청:**
```typescript
{
  type: 'GET_STATS'
}
```

**응답:**
```typescript
{
  success: true,
  data: {
    totalCompanies: number;
    totalImages: number;
    analyzedImages: number;
    storageUsed: number;   // bytes
  }
}
```

---

## 4. 카테고리 타입

```typescript
type DataType = 'WANTED' | 'JOBPLANET' | 'SARAMIN' | 'OTHER';

type ImageSubCategory =
  | 'revenue_trend'
  | 'balance_sheet'
  | 'income_statement'
  | 'employee_trend'
  | 'review_positive'
  | 'review_negative'
  | 'company_overview'
  | 'unknown';
```

## 5. 보안 검증

### 5.1 허용 Origin

```typescript
const ALLOWED_ORIGINS = [
  'https://username.github.io',
  'http://localhost:5173',   // 개발용
  'http://127.0.0.1:5173',   // 개발용
];
```

### 5.2 검증 로직

```typescript
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    // Origin 검증
    const senderOrigin = sender.url ? new URL(sender.url).origin : '';
    if (!ALLOWED_ORIGINS.includes(senderOrigin)) {
      sendResponse({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Origin not allowed'
        }
      });
      return;
    }

    // 메시지 타입 검증
    if (!VALID_MESSAGE_TYPES.includes(message.type)) {
      sendResponse({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Unknown message type'
        }
      });
      return;
    }

    // 정상 처리
    handleMessage(message, sender)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      }));

    return true; // 비동기 응답
  }
);
```

## 6. Rate Limiting (선택)

```typescript
const RATE_LIMIT = {
  maxRequests: 100,
  windowMs: 60000, // 1분
};

const requestCounts = new Map<string, number[]>();

function checkRateLimit(origin: string): boolean {
  const now = Date.now();
  const timestamps = requestCounts.get(origin) || [];

  // 윈도우 밖의 요청 제거
  const recent = timestamps.filter(t => now - t < RATE_LIMIT.windowMs);

  if (recent.length >= RATE_LIMIT.maxRequests) {
    return false;
  }

  recent.push(now);
  requestCounts.set(origin, recent);
  return true;
}
```

## 7. 실시간 이벤트 (선택)

Port 기반 양방향 통신으로 실시간 업데이트 지원.

### 7.1 연결

```typescript
// SPA에서
const port = chrome.runtime.connect(EXTENSION_ID, { name: 'realtime' });

// Extension에서
chrome.runtime.onConnectExternal.addListener((port) => {
  if (port.name === 'realtime') {
    handleRealtimeConnection(port);
  }
});
```

### 7.2 이벤트 타입

```typescript
type RealtimeEvent =
  | { type: 'COMPANY_ADDED'; data: CompanyDTO }
  | { type: 'COMPANY_UPDATED'; data: CompanyDTO }
  | { type: 'COMPANY_DELETED'; data: { companyId: string } }
  | { type: 'IMAGE_ADDED'; data: ImageMetaDTO }
  | { type: 'IMAGE_DELETED'; data: { imageId: string } };
```

## 8. 버전 관리

API 버전은 `PING` 응답의 `version` 필드로 확인.

```typescript
// 버전 호환성 체크
const { version } = await sendMessage('PING');
const [major, minor] = version.split('.').map(Number);

if (major < 2) {
  console.warn('Extension 업데이트 필요');
}
```
