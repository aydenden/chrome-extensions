# Feature 08: External API 분석 결과 저장 엔드포인트

## 개요

분석 결과 저장 관련 External API 엔드포인트를 구현합니다.

## 범위

- SAVE_ANALYSIS
- BATCH_SAVE_ANALYSIS

## 의존성

- Feature 07: Extension External API Image

## 구현 상세

### extension/src/background/handlers/analysis-handlers.ts

```typescript
import { registerHandler } from '../external-api';
import { getImage, updateImageAnalysis } from '@/lib/storage';
import type { ImageSubCategory } from '@shared/constants/categories';

export function registerAnalysisHandlers(): void {
  // SAVE_ANALYSIS
  registerHandler('SAVE_ANALYSIS', async (payload) => {
    const { imageId, category, rawText, analysis } = payload;

    const image = await getImage(imageId);

    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    await updateImageAnalysis(imageId, {
      category,
      rawText,
      analysis,
    });

    return {
      updatedAt: new Date().toISOString(),
    };
  });

  // BATCH_SAVE_ANALYSIS
  registerHandler('BATCH_SAVE_ANALYSIS', async (payload) => {
    const { results } = payload;

    const savedIds: string[] = [];
    const failedIds: string[] = [];

    for (const result of results) {
      try {
        const image = await getImage(result.imageId);

        if (!image) {
          failedIds.push(result.imageId);
          continue;
        }

        await updateImageAnalysis(result.imageId, {
          category: result.category,
          rawText: result.rawText,
          analysis: result.analysis,
        });

        savedIds.push(result.imageId);
      } catch (error) {
        console.error(`Failed to save analysis for ${result.imageId}:`, error);
        failedIds.push(result.imageId);
      }
    }

    return {
      savedCount: savedIds.length,
      failedIds,
    };
  });
}
```

### external-api.ts 업데이트

```typescript
import { registerAnalysisHandlers } from './handlers/analysis-handlers';

function registerBasicHandlers(): void {
  // ... 기존 핸들러

  // Analysis 핸들러 등록
  registerAnalysisHandlers();
}
```

## API 사용 예시

### SAVE_ANALYSIS

```typescript
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'SAVE_ANALYSIS',
  payload: {
    imageId: 'image_xyz',
    category: 'revenue_trend',
    rawText: '매출 현황\n2023년: 50억원\n2022년: 40억원',
    analysis: '해당 기업의 매출은 전년 대비 25% 성장하여...',
  }
}, callback);

// 응답
{
  success: true,
  data: {
    updatedAt: '2024-01-15T10:30:00.000Z'
  }
}
```

### BATCH_SAVE_ANALYSIS

```typescript
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'BATCH_SAVE_ANALYSIS',
  payload: {
    results: [
      {
        imageId: 'image_1',
        category: 'revenue_trend',
        rawText: '매출 데이터...',
        analysis: '분석 결과...',
      },
      {
        imageId: 'image_2',
        category: 'employee_trend',
        rawText: '직원 데이터...',
        analysis: '분석 결과...',
      },
      {
        imageId: 'image_3',
        category: 'review_positive',
        rawText: '리뷰 데이터...',
        analysis: '분석 결과...',
      },
    ]
  }
}, callback);

// 응답
{
  success: true,
  data: {
    savedCount: 3,
    failedIds: []
  }
}

// 일부 실패 시
{
  success: true,
  data: {
    savedCount: 2,
    failedIds: ['image_3']
  }
}
```

## 완료 기준

- [ ] SAVE_ANALYSIS: 단일 분석 결과 저장 성공
- [ ] SAVE_ANALYSIS: 존재하지 않는 이미지 ID에 대해 에러 반환
- [ ] BATCH_SAVE_ANALYSIS: 여러 분석 결과 일괄 저장 성공
- [ ] BATCH_SAVE_ANALYSIS: 일부 실패 시 실패한 ID 목록 반환
- [ ] 저장된 분석 결과가 GET_IMAGE_DATA에 포함됨
- [ ] 통합 테스트 통과

## 참조 문서

- spec/02-extension-api.md Section 3.3 (분석 관련 API)
