# 06. PDF 처리

## 개요
pdfjs-dist 기반 PDF 파일 처리 및 이미지 변환

## 선행 조건
- 02-data-storage 완료

## 기술 스택
| 분류 | 기술 | 용도 |
|------|------|------|
| PDF 라이브러리 | pdfjs-dist | PDF 파싱/렌더링 |
| 처리 위치 | Popup | Canvas 렌더링 필요 |

---

## 주요 기능

1. **파일 선택**: 파일 다이얼로그로 PDF 업로드
2. **페이지 렌더링**: 각 페이지를 Canvas로 렌더링
3. **이미지 변환**: Canvas → PNG Blob
4. **저장**: IndexedDB에 페이지별 이미지 저장

---

## 구현

### src/lib/pdf-processor.ts

```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Worker 설정 (Vite 빌드 시 복사 필요)
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

interface PdfPage {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
}

interface PdfProcessResult {
  pages: PdfPage[];
  totalPages: number;
  filename: string;
}

/**
 * PDF 파일 처리
 */
export async function processPdf(
  file: File,
  options: {
    scale?: number;           // 렌더링 스케일 (기본 1.5)
    maxPages?: number;        // 최대 페이지 수 (기본 무제한)
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<PdfProcessResult> {
  const { scale = 1.5, maxPages, onProgress } = options;

  // PDF 로드
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const totalPages = maxPages ? Math.min(pdf.numPages, maxPages) : pdf.numPages;
  const pages: PdfPage[] = [];

  // 각 페이지 처리
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const blob = await renderPageToBlob(page, scale);

    const viewport = page.getViewport({ scale });
    pages.push({
      pageNumber: i,
      blob,
      width: viewport.width,
      height: viewport.height,
    });

    // 진행률 콜백
    onProgress?.(i, totalPages);

    // 메모리 정리
    page.cleanup();
  }

  return {
    pages,
    totalPages: pdf.numPages,
    filename: file.name,
  };
}

/**
 * PDF 페이지를 Canvas로 렌더링 후 Blob 반환
 */
async function renderPageToBlob(
  page: pdfjsLib.PDFPageProxy,
  scale: number
): Promise<Blob> {
  const viewport = page.getViewport({ scale });

  // Canvas 생성
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // 렌더링
  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  // Canvas → Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas to Blob 변환 실패'));
      }
    }, 'image/png');
  });
}

/**
 * PDF 미리보기 썸네일 생성 (작은 스케일)
 */
export async function generateThumbnail(
  file: File,
  pageNumber: number = 1,
  scale: number = 0.3
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  if (pageNumber > pdf.numPages) {
    throw new Error(`페이지 ${pageNumber}가 존재하지 않습니다.`);
  }

  const page = await pdf.getPage(pageNumber);
  const blob = await renderPageToBlob(page, scale);

  page.cleanup();

  return blob;
}

/**
 * PDF 메타데이터 조회
 */
export async function getPdfInfo(file: File): Promise<{
  numPages: number;
  title?: string;
  author?: string;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const metadata = await pdf.getMetadata();

  return {
    numPages: pdf.numPages,
    title: (metadata.info as any)?.Title,
    author: (metadata.info as any)?.Author,
  };
}
```

### 파일 선택 컴포넌트 (React)

```typescript
// src/popup/components/PdfUploader.tsx
import React, { useRef, useState } from 'react';
import { processPdf, PdfProcessResult } from '@/lib/pdf-processor';

interface PdfUploaderProps {
  onUploadComplete: (result: PdfProcessResult) => void;
}

export function PdfUploader({ onUploadComplete }: PdfUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // PDF 파일 확인
    if (file.type !== 'application/pdf') {
      setError('PDF 파일만 업로드할 수 있습니다.');
      return;
    }

    setError(null);
    setProgress({ current: 0, total: 0 });

    try {
      const result = await processPdf(file, {
        scale: 1.5,
        onProgress: (current, total) => {
          setProgress({ current, total });
        },
      });

      onUploadComplete(result);
    } catch (err) {
      setError('PDF 처리 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="pdf-uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={progress !== null}
      >
        {progress
          ? `처리 중... (${progress.current}/${progress.total})`
          : 'PDF 파일 선택'}
      </button>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

---

## Vite 설정 (Worker 복사)

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import { copyFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'copy-pdf-worker',
      buildEnd() {
        // pdf.js worker 파일 복사
        const workerSrc = resolve(
          __dirname,
          'node_modules/pdfjs-dist/build/pdf.worker.min.js'
        );
        const workerDest = resolve(__dirname, 'dist/pdf.worker.min.js');
        copyFileSync(workerSrc, workerDest);
      },
    },
  ],
});
```

---

## Manifest 설정

```json
{
  "web_accessible_resources": [
    {
      "resources": ["pdf.worker.min.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

---

## 사용 흐름

```
1. 팝업에서 "PDF 업로드" 버튼 클릭
2. 파일 선택 다이얼로그
3. PDF 파일 선택
4. 페이지별 렌더링 (진행률 표시)
5. 컨펌 팝업 표시 (미리보기)
6. 저장 확인 → IndexedDB 저장
```

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/lib/pdf-processor.ts` | PDF 처리 로직 |
| `src/popup/components/PdfUploader.tsx` | 파일 선택 컴포넌트 |

---

## 참조 문서
- [spec/02-data-extraction.md](../spec/02-data-extraction.md) - 데이터 추출
- [research/03-pdf-processing.md](../research/03-pdf-processing.md) - PDF 처리 기술 조사
