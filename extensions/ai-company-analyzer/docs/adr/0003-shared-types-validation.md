# ADR-0003: Shared Types + Runtime Validation

## 상태

승인됨

## 날짜

2024-01

## 컨텍스트

SPA와 Extension 간 메시지 통신에서 타입 안전성 확보 필요:

1. **컴파일 타임**: TypeScript 타입 체크
2. **런타임**: 외부 데이터 검증 (Extension 응답)

문제점:
- TypeScript는 컴파일 타임만 검증
- Extension 응답이 예상과 다를 때 런타임 에러
- 타입 정의 중복 (SPA, Extension 각각)

```typescript
// 기존 방식 - 런타임 검증 없음
const response = await chrome.runtime.sendMessage(...);
const company = response.data as CompanyDTO; // 위험!
console.log(company.name); // 런타임에 undefined 가능
```

## 결정

**Discriminated Union + Zod 조합**

### 1. Discriminated Union 메시지 타입

컴파일 타임 타입 안전성을 위해 Union 타입 사용.

```typescript
// shared/types/messages.ts

type ExtensionMessage =
  | { type: 'GET_COMPANIES'; payload?: GetCompaniesPayload }
  | { type: 'GET_COMPANY'; payload: { companyId: string } }
  | { type: 'DELETE_COMPANY'; payload: { companyId: string } }
  | { type: 'GET_IMAGES'; payload: { companyId: string } }
  | { type: 'SAVE_ANALYSIS'; payload: SaveAnalysisPayload }
  | { type: 'PING' }
  | { type: 'GET_STATS' };

// 타입 추론 유틸
type MessagePayload<T extends ExtensionMessage['type']> =
  Extract<ExtensionMessage, { type: T }> extends { payload: infer P } ? P : undefined;

type MessageResponse<T extends ExtensionMessage['type']> = /* 응답 타입 매핑 */;
```

### 2. Zod 런타임 검증

외부 데이터 검증을 위해 Zod 스키마 사용.

```typescript
// shared/types/validation.ts
import { z } from 'zod';

export const DataTypeSchema = z.enum([
  'WANTED', 'JOBPLANET', 'SARAMIN',
  'INNOFOREST', 'DART', 'SMES', 'BLIND', 'OTHER'
]);

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  url: z.string().url(),
  siteType: DataTypeSchema,
  dataSources: z.array(DataTypeSchema).optional(),
  imageCount: z.number().int().min(0),
  analyzedCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// 타입 추론
export type CompanyDTO = z.infer<typeof CompanySchema>;
```

### 3. 검증 적용

```typescript
// src/lib/extension-client/client.ts
import { CompanySchema } from 'shared/types/validation';

async function getCompanies(): Promise<CompanyDTO[]> {
  const response = await handler.send('GET_COMPANIES');

  // 런타임 검증
  const validated = z.array(CompanySchema).parse(response);
  return validated;
}
```

### 4. 타입 공유 구조

```
shared/
├── types/
│   ├── messages.ts          # Discriminated Union
│   ├── models.ts            # 데이터 모델 인터페이스
│   ├── validation.ts        # Zod 스키마
│   └── errors.ts            # 에러 타입
└── constants/
    └── categories.ts        # 상수
```

## 결과

### 긍정적

- **타입 안전성 +80%**: 컴파일 + 런타임 이중 검증
- **타입 추론**: Zod 스키마에서 TypeScript 타입 자동 생성
- **에러 메시지**: 검증 실패 시 상세 에러 정보
- **중복 제거**: 타입 정의 한 곳에서 관리

### 부정적

- **번들 크기**: Zod 라이브러리 (~11KB gzipped)
- **성능**: 런타임 검증 오버헤드 (미미함)
- **학습 곡선**: Zod 문법 익혀야 함

### 리스크

- **스키마 불일치**: SPA와 Extension 스키마 버전 차이
  - 완화: 버전 필드 추가, 하위 호환성 유지

## 대안

### 1. TypeScript만 사용 (현재)

```typescript
const company = response.data as CompanyDTO;
```

- 단점: 런타임 검증 없음, 타입 불일치 시 에러

### 2. io-ts

```typescript
const Company = t.type({ id: t.string, name: t.string });
```

- 단점: 함수형 스타일, 가독성 낮음

### 3. class-validator (클래스 기반)

```typescript
class CompanyDTO {
  @IsString() id: string;
  @IsString() @MinLength(1) name: string;
}
```

- 단점: 데코레이터 문법, 클래스 필수

### 4. ajv (JSON Schema)

```typescript
const schema = { type: 'object', properties: { ... } };
```

- 단점: JSON Schema 별도 정의 필요, 타입 추론 약함

## Zod 선택 이유

| 기준 | Zod | io-ts | class-validator |
|------|-----|-------|-----------------|
| 타입 추론 | 우수 | 보통 | 보통 |
| 가독성 | 우수 | 낮음 | 보통 |
| 번들 크기 | 11KB | 8KB | 20KB |
| 에러 메시지 | 우수 | 보통 | 우수 |
| 학습 곡선 | 낮음 | 높음 | 보통 |

## 관련 문서

- [01-architecture.md](/docs/spa-with-extension/spec/01-architecture.md) - Section 10
- [02-extension-api.md](/docs/spa-with-extension/spec/02-extension-api.md) - 메시지 타입
