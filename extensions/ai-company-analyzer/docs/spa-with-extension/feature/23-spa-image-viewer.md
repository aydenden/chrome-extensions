# Feature 23: 이미지 확대 뷰어 모달

## 개요

이미지를 전체 화면 모달에서 확대하여 볼 수 있는 뷰어를 구현합니다.

## 범위

- ImageViewer 모달 컴포넌트
- 이미지 확대/축소
- 이전/다음 네비게이션
- 키보드 단축키 (ESC, 좌우 화살표)
- 이미지 메타데이터 표시

## 의존성

- Feature 22: 이미지 갤러리 그리드

## 구현 상세

### spa/src/components/image/ImageViewer.tsx

```tsx
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useImageData } from '@/hooks/useImages';
import { Spinner, Button } from '@/components/ui';
import { IMAGE_SUB_CATEGORY_LABELS, type ImageSubCategory } from '@shared/constants/categories';
import type { ImageSummary } from '@shared/types';

interface ImageViewerProps {
  imageId: string;
  images: ImageSummary[];
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

  const currentImage = images.find(img => img.id === imageId);
  const currentIndex = images.findIndex(img => img.id === imageId);
  const canNavigate = images.length > 1;

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
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
        setZoom(z => Math.min(z + 0.25, 3));
        break;
      case '-':
        setZoom(z => Math.max(z - 0.25, 0.5));
        break;
      case '0':
        setZoom(1);
        break;
    }
  }, [canNavigate, onClose, onNavigate]);

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

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          {/* 카테고리 뱃지 */}
          {currentImage && (
            <span className="px-3 py-1 text-sm font-medium text-white bg-ink-soft">
              {IMAGE_SUB_CATEGORY_LABELS[currentImage.subCategory as ImageSubCategory]}
            </span>
          )}

          {/* 인덱스 */}
          <span className="text-white/70 data-figure">
            {currentIndex + 1} / {images.length}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* 줌 컨트롤 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white"
              aria-label="축소"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-white/70 data-figure min-w-[4rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white"
              aria-label="확대"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-2 py-1 text-xs text-white/70 hover:text-white border border-white/30 hover:border-white/60"
            >
              Reset
            </button>
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white"
            aria-label="닫기"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 이미지 영역 */}
      <div className="flex-1 flex items-center justify-center overflow-auto relative">
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
            <Spinner size="lg" className="text-white" />
          ) : imageData ? (
            <img
              src={imageData.dataUrl}
              alt={currentImage ? IMAGE_SUB_CATEGORY_LABELS[currentImage.subCategory as ImageSubCategory] : '이미지'}
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
            <span>
              생성: {new Date(currentImage.createdAt).toLocaleString('ko-KR')}
            </span>
            {currentImage.hasAnalysis && (
              <span className="flex items-center gap-1 text-signal-positive">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                분석 완료
              </span>
            )}
          </div>
        </div>
      )}

      {/* 키보드 단축키 도움말 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs">
        ESC 닫기 • ← → 이동 • +/- 확대/축소 • 0 리셋
      </div>
    </div>,
    document.body
  );
}
```

### spa/src/hooks/useImageData.ts (확장)

```typescript
// Feature 15에서 정의된 useImageData 확장
import { useQuery } from '@tanstack/react-query';
import { getExtensionClient } from '@/lib/extension-client';
import { queryKeys } from '@/lib/query/keys';

interface ImageDataResult {
  dataUrl: string;
  width: number;
  height: number;
  mimeType: string;
}

export function useImageData(imageId: string | undefined) {
  const client = getExtensionClient();

  return useQuery<ImageDataResult>({
    queryKey: queryKeys.imageData(imageId!),
    queryFn: () => client.send('GET_IMAGE_DATA', { imageId: imageId! }),
    enabled: !!imageId,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}
```

## 완료 기준

- [ ] ImageViewer 모달: 전체 화면 표시
- [ ] 확대/축소: +/- 버튼, 키보드, 퍼센트 표시
- [ ] 네비게이션: 이전/다음 버튼, 화살표 키
- [ ] ESC 키로 닫기
- [ ] 현재 인덱스 표시 (1 / 10)
- [ ] 카테고리, 생성일 메타데이터 표시
- [ ] 분석 완료 상태 표시
- [ ] 키보드 단축키 도움말

## 참조 문서

- spec/06-page-layouts.md Section 3.3 (이미지 뷰어)
