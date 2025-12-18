# Feature 07: External API 이미지 관련 엔드포인트

## 개요

이미지 관련 External API 엔드포인트를 구현합니다.

## 범위

- GET_IMAGES
- GET_IMAGE_DATA (Blob → Base64 변환)
- GET_IMAGE_THUMBNAIL
- DELETE_IMAGE

## 의존성

- Feature 06: Extension External API Company

## 구현 상세

### extension/src/background/handlers/image-handlers.ts

```typescript
import { registerHandler } from '../external-api';
import type { ImageMetaDTO, ImageDataDTO } from '@shared/types';
import {
  getImagesByCompany,
  getImage,
  deleteImage,
} from '@/lib/storage';

/** Blob → Base64 변환 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:image/png;base64,... 에서 base64 부분만 추출
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** 썸네일 생성 */
async function createThumbnail(
  blob: Blob,
  maxWidth: number,
  maxHeight: number
): Promise<{ base64: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);

  // 비율 계산
  let width = bitmap.width;
  let height = bitmap.height;

  if (width > maxWidth) {
    height = (maxWidth / width) * height;
    width = maxWidth;
  }
  if (height > maxHeight) {
    width = (maxHeight / height) * width;
    height = maxHeight;
  }

  width = Math.round(width);
  height = Math.round(height);

  // OffscreenCanvas로 리사이즈
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const thumbnailBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  const base64 = await blobToBase64(thumbnailBlob);

  bitmap.close();

  return { base64, width, height };
}

/** StoredImage → ImageMetaDTO 변환 */
function toImageMetaDTO(image: any): ImageMetaDTO {
  return {
    id: image.id,
    companyId: image.companyId,
    mimeType: image.mimeType,
    size: image.size,
    width: image.width,
    height: image.height,
    category: image.category,
    hasRawText: !!image.rawText,
    hasAnalysis: !!image.analysis,
    createdAt: image.createdAt.toISOString(),
  };
}

export function registerImageHandlers(): void {
  // GET_IMAGES
  registerHandler('GET_IMAGES', async (payload) => {
    const { companyId, filter } = payload;

    let images = await getImagesByCompany(companyId);

    // 필터 적용
    if (filter?.category) {
      images = images.filter(img => img.category === filter.category);
    }
    if (filter?.hasAnalysis !== undefined) {
      images = images.filter(img => !!img.analysis === filter.hasAnalysis);
    }

    return images.map(toImageMetaDTO);
  });

  // GET_IMAGE_DATA
  registerHandler('GET_IMAGE_DATA', async (payload) => {
    const { imageId, includeRawText = true, includeAnalysis = true } = payload;

    const image = await getImage(imageId);

    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    const base64 = await blobToBase64(image.blob);

    const result: ImageDataDTO = {
      id: image.id,
      base64,
      mimeType: image.mimeType,
      category: image.category,
    };

    if (includeRawText && image.rawText) {
      result.rawText = image.rawText;
    }
    if (includeAnalysis && image.analysis) {
      result.analysis = image.analysis;
    }

    return result;
  });

  // GET_IMAGE_THUMBNAIL
  registerHandler('GET_IMAGE_THUMBNAIL', async (payload) => {
    const { imageId, maxWidth = 200, maxHeight = 200 } = payload;

    const image = await getImage(imageId);

    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    const thumbnail = await createThumbnail(image.blob, maxWidth, maxHeight);

    return {
      base64: thumbnail.base64,
      mimeType: 'image/jpeg' as const,
      width: thumbnail.width,
      height: thumbnail.height,
    };
  });

  // DELETE_IMAGE
  registerHandler('DELETE_IMAGE', async (payload) => {
    const { imageId } = payload;

    const image = await getImage(imageId);

    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    await deleteImage(imageId);

    return null;
  });
}
```

### external-api.ts 업데이트

```typescript
import { registerImageHandlers } from './handlers/image-handlers';

function registerBasicHandlers(): void {
  // ... 기존 핸들러

  // Image 핸들러 등록
  registerImageHandlers();
}
```

## API 사용 예시

### GET_IMAGES

```typescript
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'GET_IMAGES',
  payload: {
    companyId: 'company_abc123',
    filter: {
      category: 'revenue_trend',
      hasAnalysis: true,
    }
  }
}, callback);

// 응답
{
  success: true,
  data: [
    {
      id: 'image_xyz',
      companyId: 'company_abc123',
      mimeType: 'image/png',
      size: 245000,
      width: 1200,
      height: 800,
      category: 'revenue_trend',
      hasRawText: true,
      hasAnalysis: true,
      createdAt: '2024-01-15T09:30:00.000Z',
    }
  ]
}
```

### GET_IMAGE_DATA

```typescript
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'GET_IMAGE_DATA',
  payload: {
    imageId: 'image_xyz',
    includeRawText: true,
    includeAnalysis: true,
  }
}, callback);

// 응답
{
  success: true,
  data: {
    id: 'image_xyz',
    base64: 'iVBORw0KGgo...',  // Base64 인코딩된 이미지
    mimeType: 'image/png',
    category: 'revenue_trend',
    rawText: '매출 현황\n2023년: 50억...',
    analysis: '해당 기업의 매출은...',
  }
}
```

## 완료 기준

- [ ] GET_IMAGES: 회사별 이미지 목록 조회 성공
- [ ] GET_IMAGES: category, hasAnalysis 필터 동작
- [ ] GET_IMAGE_DATA: Base64 인코딩된 이미지 데이터 반환
- [ ] GET_IMAGE_DATA: 5MB 이하 이미지 전송 성공
- [ ] GET_IMAGE_THUMBNAIL: 리사이즈된 썸네일 반환
- [ ] DELETE_IMAGE: 이미지 삭제 성공
- [ ] 통합 테스트 통과

## 참조 문서

- spec/02-extension-api.md Section 3.2 (이미지 관련 API)
