import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useImageData } from '@/hooks/useImages';
import Spinner from '@/components/ui/Spinner';
import { CATEGORY_LABELS } from '@shared/constants/categories';
import type { ImageMetaDTO } from '@shared/types/models';

interface ImageViewerProps {
  imageId: string;
  images: ImageMetaDTO[];
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export default function ImageViewer({
  imageId,
  images,
  onClose,
  onNavigate,
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const { data: imageData, isLoading } = useImageData(imageId);

  const currentImage = images.find((img) => img.id === imageId);
  const currentIndex = images.findIndex((img) => img.id === imageId);
  const canNavigate = images.length > 1;

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (canNavigate) onNavigate('prev');
          break;
        case 'ArrowRight':
          if (canNavigate) onNavigate('next');
          break;
        case '+':
        case '=':
          setZoom((z) => Math.min(z + 0.25, 3));
          break;
        case '-':
          setZoom((z) => Math.max(z - 0.25, 0.5));
          break;
        case '0':
          setZoom(1);
          break;
      }
    },
    [canNavigate, onClose, onNavigate]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // 줌 리셋 when image changes
  useEffect(() => {
    setZoom(1);
  }, [imageId]);

  // 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          {/* 카테고리 뱃지 */}
          {currentImage?.category && (
            <span className="px-3 py-1 text-sm font-medium text-white bg-white/20">
              {CATEGORY_LABELS[currentImage.category]}
            </span>
          )}

          {/* 인덱스 */}
          <span className="text-white/70 font-mono">
            {currentIndex + 1} / {images.length}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* 줌 컨트롤 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              aria-label="축소"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-white/70 font-mono min-w-[4rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              aria-label="확대"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-2 py-1 text-xs text-white/70 hover:text-white border border-white/30 hover:border-white/60 transition-colors"
            >
              Reset
            </button>
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            aria-label="닫기"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 이미지 영역 */}
      <div
        className="flex-1 flex items-center justify-center overflow-auto relative"
        onClick={handleBackdropClick}
      >
        {/* 이전 버튼 */}
        {canNavigate && (
          <button
            onClick={() => onNavigate('prev')}
            className="absolute left-4 z-10 w-12 h-12 flex items-center justify-center bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
            aria-label="이전 이미지"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* 이미지 */}
        <div className="max-w-full max-h-full overflow-auto p-8">
          {isLoading ? (
            <Spinner size="lg" />
          ) : imageData?.base64 ? (
            <img
              src={`data:${imageData.mimeType};base64,${imageData.base64}`}
              alt={currentImage?.category ? CATEGORY_LABELS[currentImage.category] : '이미지'}
              className="max-w-none transition-transform duration-200"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
              draggable={false}
            />
          ) : (
            <div className="text-white/50">이미지를 불러올 수 없습니다.</div>
          )}
        </div>

        {/* 다음 버튼 */}
        {canNavigate && (
          <button
            onClick={() => onNavigate('next')}
            className="absolute right-4 z-10 w-12 h-12 flex items-center justify-center bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
            aria-label="다음 이미지"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* 푸터: 메타데이터 */}
      {currentImage && (
        <div className="px-6 py-4 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-6 text-sm text-white/70">
            <span>생성: {new Date(currentImage.createdAt).toLocaleString('ko-KR')}</span>
            {currentImage.hasAnalysis && (
              <span className="flex items-center gap-1 text-green-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                분석 완료
              </span>
            )}
          </div>
        </div>
      )}

      {/* 키보드 단축키 도움말 */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/30 text-xs">
        ESC 닫기 · ← → 이동 · +/- 확대/축소 · 0 리셋
      </div>
    </div>,
    document.body
  );
}
