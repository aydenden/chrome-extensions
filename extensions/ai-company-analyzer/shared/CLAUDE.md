# Shared 모듈

## 용도
Extension과 SPA가 공유하는 타입/상수

## 타입 정의 (`types/`)
- messages.ts: MessageType, MessagePayload, MessageResponse
- models.ts: CompanyDTO, ImageMetaDTO 등
- errors.ts: ErrorCode
- validation.ts: Zod 스키마

## 메시지 타입 추가 시
1. messages.ts의 MessageType에 추가
2. MessagePayload에 요청 타입 추가
3. MessageResponse에 응답 타입 추가
4. Extension의 핸들러 구현
5. SPA의 클라이언트에서 호출

## 상수 (`constants/`)
- categories.ts: DATA_TYPES, IMAGE_SUB_CATEGORIES
- 새 카테고리 추가 시 라벨/컬러도 함께

## Import 방식
```typescript
import type { CompanyDTO } from '@shared/types';
import { DATA_TYPES } from '@shared/constants/categories';
```
