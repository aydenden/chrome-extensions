# 10. Transformers.js 이미지 분석

## 개요
Transformers.js 기반 이미지 캡셔닝 및 분석 구현

## 선행 조건
- 05-graph-capture 완료
- 06-pdf-processing 완료
- 09-webllm-text-analysis 완료

## 기술 스택
| 분류 | 기술 | 버전 |
|------|------|------|
| 라이브러리 | @huggingface/transformers | 최신 |
| 모델 | Xenova/vit-gpt2-image-captioning | ~300MB |
| 용도 | 이미지 → 텍스트 캡셔닝 |

---

## WebLLM 멀티모달 미지원 보완

WebLLM은 텍스트만 처리 가능하므로, Transformers.js로 이미지 캡셔닝 후 WebLLM에서 상세 분석

```
[이미지] → [Transformers.js 캡셔닝] → [영어 캡션] → [WebLLM 분석] → [분석 결과]
```

---

## 구현

### src/background/transformers-engine.ts

```typescript
import { pipeline, env } from '@huggingface/transformers';

// 모델 캐시 경로 설정
env.cacheDir = './.cache';
env.allowLocalModels = false;

// 파이프라인 인스턴스
let captionPipeline: any = null;
let isLoading = false;
let loadProgress = 0;

/**
 * 이미지 캡셔닝 파이프라인 초기화
 */
export async function initImagePipeline(
  onProgress?: (progress: number, status: string) => void
): Promise<void> {
  if (captionPipeline) return;
  if (isLoading) return;

  isLoading = true;

  try {
    captionPipeline = await pipeline(
      'image-to-text',
      'Xenova/vit-gpt2-image-captioning',
      {
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            loadProgress = progress.progress / 100;
            onProgress?.(loadProgress, progress.file);
          }
        },
      }
    );

    console.log('Transformers.js 이미지 파이프라인 초기화 완료');
  } catch (error) {
    console.error('이미지 파이프라인 초기화 실패:', error);
    throw error;
  } finally {
    isLoading = false;
  }
}

/**
 * 이미지 캡셔닝 파이프라인 상태
 */
export function getImagePipelineStatus(): {
  isReady: boolean;
  isLoading: boolean;
  progress: number;
} {
  return {
    isReady: captionPipeline !== null,
    isLoading,
    progress: loadProgress,
  };
}

/**
 * 이미지 → 캡션 변환
 */
export async function generateCaption(imageBlob: Blob): Promise<string> {
  if (!captionPipeline) {
    throw new Error('이미지 파이프라인이 초기화되지 않았습니다.');
  }

  // Blob → Data URL
  const dataUrl = await blobToDataUrl(imageBlob);

  // 캡셔닝 실행
  const result = await captionPipeline(dataUrl);

  return result[0]?.generated_text || '';
}

/**
 * 여러 이미지 캡셔닝
 */
export async function generateCaptions(
  imageBlobs: Blob[],
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const captions: string[] = [];

  for (let i = 0; i < imageBlobs.length; i++) {
    const caption = await generateCaption(imageBlobs[i]);
    captions.push(caption);
    onProgress?.(i + 1, imageBlobs.length);
  }

  return captions;
}

/**
 * 그래프 이미지 분석 (캡셔닝 + WebLLM)
 */
export async function analyzeGraphImage(
  imageBlob: Blob,
  context?: string
): Promise<{
  caption: string;
  analysis: string;
}> {
  // 1. 이미지 캡셔닝
  const caption = await generateCaption(imageBlob);

  // 2. WebLLM으로 상세 분석 요청
  const analysisPrompt = `다음은 회사 그래프 이미지의 설명입니다:
"${caption}"

${context ? `추가 컨텍스트: ${context}` : ''}

이 그래프가 나타내는 내용을 분석해주세요. 특히:
1. 어떤 종류의 데이터인지
2. 추세 (상승/하락/유지)
3. 주목할 만한 포인트

간결하게 3-5문장으로 분석해주세요.`;

  // WebLLM 분석 요청
  const response = await chrome.runtime.sendMessage({
    type: 'GENERATE_TEXT',
    payload: { prompt: analysisPrompt, maxTokens: 256 },
  });

  return {
    caption,
    analysis: response.success ? response.result : '',
  };
}

/**
 * PDF 페이지 이미지들 분석
 */
export async function analyzePdfImages(
  imageBlobs: Blob[],
  onProgress?: (current: number, total: number, caption: string) => void
): Promise<{
  captions: string[];
  combinedAnalysis: string;
}> {
  const captions: string[] = [];

  // 각 페이지 캡셔닝
  for (let i = 0; i < imageBlobs.length; i++) {
    const caption = await generateCaption(imageBlobs[i]);
    captions.push(caption);
    onProgress?.(i + 1, imageBlobs.length, caption);
  }

  // 전체 캡션을 바탕으로 WebLLM 분석
  const combinedPrompt = `다음은 PDF 재무제표 각 페이지의 설명입니다:

${captions.map((c, i) => `페이지 ${i + 1}: ${c}`).join('\n')}

이 재무제표의 전체 내용을 종합 분석해주세요:
1. 주요 재무 지표
2. 재무 상태 평가
3. 주의사항

JSON 형식으로 응답해주세요.`;

  const response = await chrome.runtime.sendMessage({
    type: 'GENERATE_TEXT',
    payload: { prompt: combinedPrompt, maxTokens: 512 },
  });

  return {
    captions,
    combinedAnalysis: response.success ? response.result : '',
  };
}

// ============ 유틸리티 ============

/**
 * Blob → Data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============ 메시지 핸들러 ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INIT_IMAGE_PIPELINE') {
    initImagePipeline((progress, status) => {
      chrome.runtime.sendMessage({
        type: 'IMAGE_PIPELINE_PROGRESS',
        payload: { progress, status },
      });
    }).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'GENERATE_CAPTION') {
    // Blob은 직접 전달 불가, IndexedDB에서 조회
    generateCaption(message.payload.blob).then((caption) => {
      sendResponse({ success: true, caption });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'ANALYZE_GRAPH') {
    analyzeGraphImage(message.payload.blob, message.payload.context).then((result) => {
      sendResponse({ success: true, result });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'ANALYZE_PDF_IMAGES') {
    analyzePdfImages(message.payload.blobs).then((result) => {
      sendResponse({ success: true, result });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});
```

---

## 사용 예시

### 그래프 이미지 분석

```typescript
// IndexedDB에서 이미지 Blob 조회
const blob = await getImageBlob(imageId);

// 분석 요청
const result = await chrome.runtime.sendMessage({
  type: 'ANALYZE_GRAPH',
  payload: {
    blob,
    context: '원티드 매출 그래프',
  },
});

console.log('캡션:', result.result.caption);
console.log('분석:', result.result.analysis);
```

### PDF 이미지들 분석

```typescript
const blobs = await Promise.all(
  imageIds.map(id => getImageBlob(id))
);

const result = await chrome.runtime.sendMessage({
  type: 'ANALYZE_PDF_IMAGES',
  payload: { blobs },
});

console.log('페이지별 캡션:', result.result.captions);
console.log('종합 분석:', result.result.combinedAnalysis);
```

---

## Manifest 설정

```json
{
  "host_permissions": [
    "https://huggingface.co/*"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

---

## 성능 고려사항

| 항목 | 값 |
|------|-----|
| 모델 다운로드 | ~300MB (첫 실행만) |
| 단일 이미지 캡셔닝 | 1-3초 |
| 메모리 사용 | ~500MB |

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/background/transformers-engine.ts` | Transformers.js 이미지 파이프라인 |

---

## 참조 문서
- [research/06-ai-implementation.md](../research/06-ai-implementation.md) - AI 구현 기술 조사
