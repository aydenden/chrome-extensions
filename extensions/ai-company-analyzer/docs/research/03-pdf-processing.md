# PDF 처리 조사

> 조사일: 2025-12-15
> 관련 스펙: [02-data-extraction.md](../spec/02-data-extraction.md)

## 결정사항

- **선택**: pdfjs-dist (Mozilla 공식)
- **처리 위치**: Popup에서 처리 (DOM/Canvas 필요)
- **저장 형식**: 페이지별 PNG Blob → IndexedDB
- **이유**: 가장 안정적, 널리 사용됨

## 조사 대상

| 라이브러리 | 특징 | 채택 |
|-----------|------|------|
| [pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist) | Mozilla 공식, 가장 안정적 | ⭐ 채택 |
| [unpdf](https://unjs.io/packages/unpdf/) | 간소화된 API, pdfjs 기반 | ❌ |
| [pdf2pic](https://www.npmjs.com/package/pdf2pic) | Node.js 전용 | ❌ |

## 상세 분석

### pdfjs-dist

**장점:**
- Mozilla 공식 라이브러리
- 브라우저 환경 완벽 지원
- 활발한 유지보수

**단점:**
- Worker 파일 별도 번들링 필요
- 번들 크기 큼

**기본 사용법:**
```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Worker 설정 (필수)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

async function pdfToImages(file: File): Promise<Blob[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const blobs: Blob[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: canvas.getContext('2d')!,
      viewport,
    }).promise;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    blobs.push(blob);
  }

  return blobs;
}
```

### unpdf

**장점:**
- 간소화된 API
- pdfjs 기반

**단점:**
- pdfjs-dist에 의존
- 추가 추상화 레이어

**API 예시:**
```typescript
import { renderPageAsImage } from 'unpdf';

const result = await renderPageAsImage(buffer, pageNumber, {
  canvas: () => import('canvas'),
});
```

## Manifest V3 고려사항

### 처리 위치별 제약

| 환경 | Canvas 사용 | 권장 용도 |
|------|------------|----------|
| **Popup** | ✅ 가능 | PDF 업로드 UI, 렌더링 |
| **Content Script** | ✅ 가능 | 페이지 내 처리 |
| **Service Worker** | ❌ DOM 없음 | 로직만, 메시지 중계 |

### 구현 위치 전략

```
[Popup UI]
├── 파일 선택 다이얼로그
├── PDF → Canvas 렌더링 (pdfjs-dist)
├── Canvas → Blob 변환
└── IndexedDB에 저장

[Service Worker]
└── 저장 완료 메시지 처리만
```

## manifest.json 설정

```json
{
  "web_accessible_resources": [{
    "resources": ["pdf.worker.min.js"],
    "matches": ["<all_urls>"]
  }]
}
```

## 파일 구조

```
src/
├── lib/
│   └── pdf.ts              # PDF 처리 유틸
├── popup/
│   └── PdfUploader.tsx     # PDF 업로드 컴포넌트
└── assets/
    └── pdf.worker.min.js   # pdfjs worker 파일
```

## 전체 구현 예시

```typescript
// lib/pdf.ts
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

export async function processPdf(file: File): Promise<{
  pageCount: number;
  pages: Blob[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: Blob[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 고해상도

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    pages.push(blob);

    // 메모리 해제
    page.cleanup();
  }

  return { pageCount: pdf.numPages, pages };
}

// 첫 페이지만 미리보기
export async function getFirstPagePreview(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 0.5 }); // 썸네일용 작은 크기

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: canvas.getContext('2d')!,
    viewport,
  }).promise;

  return canvas.toDataURL('image/png');
}
```

## 주의사항

1. **Worker 파일 번들링**: pdfjs worker는 별도 파일로 배포 필요
2. **메모리 관리**: 큰 PDF는 페이지별로 처리 후 `page.cleanup()` 호출
3. **스케일 설정**: 용도에 따라 viewport scale 조정 (미리보기: 0.5, 저장: 1.5~2.0)

## 미채택 사유

| 옵션 | 사유 |
|------|------|
| unpdf | 추가 추상화 레이어, pdfjs-dist 직접 사용이 더 명확 |
| pdf2pic | Node.js 전용, 브라우저 미지원 |

## 참고 자료

- [pdfjs-dist - npm](https://www.npmjs.com/package/pdfjs-dist)
- [PDF.js Examples](https://mozilla.github.io/pdf.js/examples/)
- [PDF to Image conversion using Reactjs](https://medium.com/@charanvinaynarni/pdf-to-image-conversion-using-reactjs-fd250a25bf05)
- [Canvas Rendering - pdfjs-dist](https://deepwiki.com/mozilla/pdfjs-dist/4.1-canvas-rendering)
