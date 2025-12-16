import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// PDF.js 워커 초기화
let workerInitialized = false;

export async function initPdfWorker(): Promise<void> {
  if (workerInitialized) {
    return;
  }

  // Chrome Extension 환경에서 워커 경로 설정
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    const workerUrl = chrome.runtime.getURL('pdf.worker.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } else {
    // 개발 환경에서는 CDN 사용
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }

  workerInitialized = true;
}

export interface PdfInfo {
  numPages: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

export interface ProgressCallback {
  (current: number, total: number): void;
}

export class PdfProcessor {
  private pdfDoc: PDFDocumentProxy | null = null;

  constructor() {}

  /**
   * PDF 파일 로드
   */
  async loadPdf(file: File): Promise<void> {
    await initPdfWorker();

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    this.pdfDoc = await loadingTask.promise;
  }

  /**
   * PDF 정보 가져오기
   */
  async getPdfInfo(): Promise<PdfInfo> {
    if (!this.pdfDoc) {
      throw new Error('PDF가 로드되지 않았습니다.');
    }

    const metadata = await this.pdfDoc.getMetadata();
    const info = metadata.info as any;

    return {
      numPages: this.pdfDoc.numPages,
      title: info?.Title,
      author: info?.Author,
      subject: info?.Subject,
      keywords: info?.Keywords,
      creator: info?.Creator,
      producer: info?.Producer,
      creationDate: info?.CreationDate ? new Date(info.CreationDate) : undefined,
      modificationDate: info?.ModDate ? new Date(info.ModDate) : undefined,
    };
  }

  /**
   * 페이지 수 반환
   */
  getPageCount(): number {
    if (!this.pdfDoc) {
      throw new Error('PDF가 로드되지 않았습니다.');
    }
    return this.pdfDoc.numPages;
  }

  /**
   * 페이지를 Canvas에 렌더링
   */
  async renderPageToCanvas(
    pageNum: number,
    scale: number = 1.5
  ): Promise<HTMLCanvasElement> {
    if (!this.pdfDoc) {
      throw new Error('PDF가 로드되지 않았습니다.');
    }

    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context를 가져올 수 없습니다.');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // 메모리 정리
    page.cleanup();

    return canvas;
  }

  /**
   * 페이지를 PNG Blob으로 변환
   */
  async pageToBlob(pageNum: number, scale: number = 1.5): Promise<Blob> {
    const canvas = await this.renderPageToCanvas(pageNum, scale);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Blob 생성에 실패했습니다.'));
          }
        },
        'image/png',
        1.0
      );
    });
  }

  /**
   * 썸네일 생성 (작은 사이즈)
   */
  async generateThumbnail(
    pageNum: number,
    thumbnailScale: number = 0.5
  ): Promise<Blob> {
    return this.pageToBlob(pageNum, thumbnailScale);
  }

  /**
   * 모든 페이지를 Blob 배열로 반환
   */
  async extractAllPages(
    file: File,
    scale: number = 1.5,
    onProgress?: ProgressCallback
  ): Promise<Blob[]> {
    await this.loadPdf(file);

    const pageCount = this.getPageCount();
    const blobs: Blob[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const blob = await this.pageToBlob(i, scale);
      blobs.push(blob);

      if (onProgress) {
        onProgress(i, pageCount);
      }
    }

    return blobs;
  }

  /**
   * 선택한 페이지들을 Blob 배열로 반환
   */
  async extractSelectedPages(
    pageNumbers: number[],
    scale: number = 1.5,
    onProgress?: ProgressCallback
  ): Promise<Blob[]> {
    if (!this.pdfDoc) {
      throw new Error('PDF가 로드되지 않았습니다.');
    }

    const blobs: Blob[] = [];
    const total = pageNumbers.length;

    for (let i = 0; i < pageNumbers.length; i++) {
      const pageNum = pageNumbers[i];
      const blob = await this.pageToBlob(pageNum, scale);
      blobs.push(blob);

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    return blobs;
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }
  }
}

/**
 * 간편한 PDF 처리 함수
 */
export async function processPdf(
  file: File,
  options?: {
    scale?: number;
    pageNumbers?: number[];
    onProgress?: ProgressCallback;
  }
): Promise<Blob[]> {
  const processor = new PdfProcessor();

  try {
    await processor.loadPdf(file);

    if (options?.pageNumbers && options.pageNumbers.length > 0) {
      return await processor.extractSelectedPages(
        options.pageNumbers,
        options?.scale ?? 1.5,
        options?.onProgress
      );
    } else {
      return await processor.extractAllPages(
        file,
        options?.scale ?? 1.5,
        options?.onProgress
      );
    }
  } finally {
    processor.destroy();
  }
}
