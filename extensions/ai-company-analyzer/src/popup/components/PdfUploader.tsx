import React, { useState, useRef, useCallback } from 'react';
import { PdfProcessor, type PdfInfo } from '@/lib/pdf-processor';

export interface PdfUploaderProps {
  onPagesSelected: (blobs: Blob[]) => void;
  scale?: number;
  maxPages?: number;
}

interface ThumbnailData {
  pageNum: number;
  url: string;
  selected: boolean;
}

export const PdfUploader: React.FC<PdfUploaderProps> = ({
  onPagesSelected,
  scale = 1.5,
  maxPages,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
  const [thumbnails, setThumbnails] = useState<ThumbnailData[]>([]);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const processorRef = useRef<PdfProcessor | null>(null);

  const validatePdfFile = (file: File): string | null => {
    if (!file.type.includes('pdf')) {
      return 'PDF 파일만 업로드 가능합니다.';
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return 'PDF 파일 크기는 50MB를 초과할 수 없습니다.';
    }

    return null;
  };

  const processPdfFile = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    setThumbnails([]);
    setPdfInfo(null);
    setCurrentFile(file);

    try {
      const processor = new PdfProcessor();
      processorRef.current = processor;

      await processor.loadPdf(file);
      const info = await processor.getPdfInfo();
      setPdfInfo(info);

      // 최대 페이지 수 체크
      const pageCount = Math.min(info.numPages, maxPages || info.numPages);

      // 썸네일 생성
      const thumbs: ThumbnailData[] = [];
      setProgress({ current: 0, total: pageCount });

      for (let i = 1; i <= pageCount; i++) {
        const blob = await processor.generateThumbnail(i, 0.3);
        const url = URL.createObjectURL(blob);

        thumbs.push({
          pageNum: i,
          url,
          selected: true, // 기본적으로 모든 페이지 선택
        });

        setProgress({ current: i, total: pageCount });
      }

      setThumbnails(thumbs);
    } catch (err) {
      console.error('PDF 처리 오류:', err);
      setError(err instanceof Error ? err.message : 'PDF 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validatePdfFile(file);
    if (error) {
      setError(error);
      return;
    }

    await processPdfFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const error = validatePdfFile(file);
    if (error) {
      setError(error);
      return;
    }

    await processPdfFile(file);
  };

  const togglePageSelection = (pageNum: number) => {
    setThumbnails((prev) =>
      prev.map((thumb) =>
        thumb.pageNum === pageNum
          ? { ...thumb, selected: !thumb.selected }
          : thumb
      )
    );
  };

  const selectAll = () => {
    setThumbnails((prev) =>
      prev.map((thumb) => ({ ...thumb, selected: true }))
    );
  };

  const deselectAll = () => {
    setThumbnails((prev) =>
      prev.map((thumb) => ({ ...thumb, selected: false }))
    );
  };

  const handleSaveSelected = async () => {
    if (!processorRef.current || !currentFile) {
      setError('PDF 파일을 먼저 선택해주세요.');
      return;
    }

    const selectedPages = thumbnails
      .filter((t) => t.selected)
      .map((t) => t.pageNum);

    if (selectedPages.length === 0) {
      setError('최소 1개 이상의 페이지를 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const blobs = await processorRef.current.extractSelectedPages(
        selectedPages,
        scale,
        (current, total) => {
          setProgress({ current, total });
        }
      );

      onPagesSelected(blobs);

      // 썸네일 URL 정리
      thumbnails.forEach((thumb) => URL.revokeObjectURL(thumb.url));

      // 상태 초기화
      setThumbnails([]);
      setPdfInfo(null);
      setCurrentFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('페이지 추출 오류:', err);
      setError(err instanceof Error ? err.message : '페이지 추출 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  React.useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 정리
      thumbnails.forEach((thumb) => URL.revokeObjectURL(thumb.url));
      if (processorRef.current) {
        processorRef.current.destroy();
      }
    };
  }, []);

  const selectedCount = thumbnails.filter((t) => t.selected).length;

  return (
    <div className="pdf-uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {thumbnails.length === 0 ? (
        <div
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClickUpload}
          style={{
            border: '2px dashed #ccc',
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragging ? '#f0f0f0' : 'transparent',
          }}
        >
          <p style={{ margin: 0, color: '#666' }}>
            PDF 파일을 드래그하거나 클릭하여 선택하세요
          </p>
          {maxPages && (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#999' }}>
              최대 {maxPages} 페이지까지 처리됩니다
            </p>
          )}
        </div>
      ) : (
        <div className="pdf-preview">
          {pdfInfo && (
            <div className="pdf-info" style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 8px' }}>
                {pdfInfo.title || currentFile?.name || 'PDF 문서'}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                총 {pdfInfo.numPages}페이지 중 {selectedCount}페이지 선택됨
              </p>
            </div>
          )}

          <div className="selection-controls" style={{ marginBottom: '16px' }}>
            <button onClick={selectAll} disabled={isProcessing}>
              전체 선택
            </button>
            <button onClick={deselectAll} disabled={isProcessing} style={{ marginLeft: '8px' }}>
              전체 해제
            </button>
            <button
              onClick={handleClickUpload}
              disabled={isProcessing}
              style={{ marginLeft: '8px' }}
            >
              다른 파일 선택
            </button>
          </div>

          <div
            className="thumbnails-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
              maxHeight: '400px',
              overflowY: 'auto',
            }}
          >
            {thumbnails.map((thumb) => (
              <div
                key={thumb.pageNum}
                className={`thumbnail ${thumb.selected ? 'selected' : ''}`}
                onClick={() => togglePageSelection(thumb.pageNum)}
                style={{
                  border: `2px solid ${thumb.selected ? '#007bff' : '#ddd'}`,
                  borderRadius: '4px',
                  padding: '8px',
                  cursor: 'pointer',
                  backgroundColor: thumb.selected ? '#e7f3ff' : 'white',
                }}
              >
                <img
                  src={thumb.url}
                  alt={`Page ${thumb.pageNum}`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                  }}
                />
                <p
                  style={{
                    margin: '8px 0 0',
                    textAlign: 'center',
                    fontSize: '12px',
                  }}
                >
                  페이지 {thumb.pageNum}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveSelected}
            disabled={isProcessing || selectedCount === 0}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: selectedCount === 0 ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            선택한 페이지 저장 ({selectedCount}페이지)
          </button>
        </div>
      )}

      {isProcessing && progress.total > 0 && (
        <div className="progress-bar" style={{ marginTop: '16px' }}>
          <div
            style={{
              width: '100%',
              height: '4px',
              backgroundColor: '#e0e0e0',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
                height: '100%',
                backgroundColor: '#007bff',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '14px', textAlign: 'center' }}>
            처리 중... {progress.current}/{progress.total}
          </p>
        </div>
      )}

      {error && (
        <div
          className="error-message"
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#fee',
            color: '#c33',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};
