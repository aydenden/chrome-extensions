# Feature 22: 이미지 갤러리 그리드

## 개요

회사 상세 페이지에서 수집된 이미지를 그리드 형태로 표시합니다.

## 범위

- ImageGallery 컴포넌트
- ImageCard 컴포넌트 (썸네일)
- 카테고리별 필터링
- 이미지 삭제 기능

## 의존성

- Feature 21: 회사 상세 페이지 기본 구조

## 구현 상세

### spa/src/components/image/ImageGallery.tsx

```tsx
import { useState } from 'react';
import { useImages, useDeleteImage } from '@/hooks/useImages';
import { Button, Spinner, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import ImageCard from './ImageCard';
import ImageFilters from './ImageFilters';
import ImageViewer from './ImageViewer';
import type { ImageSubCategory } from '@shared/constants/categories';

interface ImageGalleryProps {
  companyId: string;
}

interface Filters {
  category?: ImageSubCategory;
  hasAnalysis?: boolean;
}

export default function ImageGallery({ companyId }: ImageGalleryProps) {
  const [filters, setFilters] = useState<Filters>({});
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; category: string } | null>(null);

  const { data: images, isLoading, error } = useImages(companyId, filters);
  const deleteImage = useDeleteImage(companyId);
  const { showToast } = useToast();

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteImage.mutateAsync(deleteTarget.id);
      showToast('이미지 삭제 완료', 'success');
      setDeleteTarget(null);
    } catch (err) {
      showToast('삭제 실패', 'error');
    }
  };

  const handleImageClick = (imageId: string) => {
    setSelectedImageId(imageId);
  };

  const handleViewerClose = () => {
    setSelectedImageId(null);
  };

  const handleViewerNavigate = (direction: 'prev' | 'next') => {
    if (!images || !selectedImageId) return;

    const currentIndex = images.findIndex(img => img.id === selectedImageId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'prev'
      ? (currentIndex - 1 + images.length) % images.length
      : (currentIndex + 1) % images.length;

    setSelectedImageId(images[newIndex].id);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-signal-negative">이미지를 불러오는 중 오류가 발생했습니다.</p>
      </div>
    );
  }

  return (
    <>
      {/* 필터 */}
      <div className="mb-6">
        <ImageFilters filters={filters} onChange={setFilters} />
      </div>

      {/* 이미지 그리드 */}
      {images && images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {images.map(image => (
            <ImageCard
              key={image.id}
              image={image}
              onClick={() => handleImageClick(image.id)}
              onDelete={() => setDeleteTarget({ id: image.id, category: image.subCategory })}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-ink-muted">
            {filters.category
              ? '해당 카테고리에 이미지가 없습니다.'
              : '수집된 이미지가 없습니다.'}
          </p>
        </div>
      )}

      {/* 이미지 뷰어 모달 */}
      {selectedImageId && images && (
        <ImageViewer
          imageId={selectedImageId}
          images={images}
          onClose={handleViewerClose}
          onNavigate={handleViewerNavigate}
        />
      )}

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="이미지 삭제"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleteImage.isPending}
            >
              삭제
            </Button>
          </>
        }
      >
        <p className="text-ink">이 이미지를 삭제하시겠습니까?</p>
        <p className="text-ink-muted text-sm mt-2">
          관련된 분석 결과도 함께 삭제됩니다.
        </p>
      </Modal>
    </>
  );
}
```

### spa/src/components/image/ImageCard.tsx

```tsx
import { useThumbnail } from '@/hooks/useImages';
import { Spinner } from '@/components/ui';
import { IMAGE_SUB_CATEGORY_LABELS, type ImageSubCategory } from '@shared/constants/categories';
import type { ImageSummary } from '@shared/types';

interface ImageCardProps {
  image: ImageSummary;
  onClick: () => void;
  onDelete: () => void;
}

export default function ImageCard({ image, onClick, onDelete }: ImageCardProps) {
  const { data: thumbnail, isLoading } = useThumbnail(image.id);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      className="group relative bg-surface-sunken aspect-square cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      {/* 썸네일 이미지 */}
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" />
        </div>
      ) : thumbnail ? (
        <img
          src={thumbnail.dataUrl}
          alt={IMAGE_SUB_CATEGORY_LABELS[image.subCategory as ImageSubCategory]}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-ink-muted">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {/* 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        {/* 카테고리 뱃지 */}
        <div className="absolute bottom-2 left-2">
          <span className="px-2 py-1 text-xs font-medium text-white bg-ink/80">
            {IMAGE_SUB_CATEGORY_LABELS[image.subCategory as ImageSubCategory]}
          </span>
        </div>

        {/* 분석 완료 인디케이터 */}
        {image.hasAnalysis && (
          <div className="absolute top-2 left-2">
            <span className="w-5 h-5 flex items-center justify-center bg-signal-positive text-white rounded-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </div>
        )}

        {/* 삭제 버튼 */}
        <button
          onClick={handleDeleteClick}
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-signal-negative/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-signal-negative"
          aria-label="삭제"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

### spa/src/components/image/ImageFilters.tsx

```tsx
import { IMAGE_SUB_CATEGORIES, IMAGE_SUB_CATEGORY_LABELS, type ImageSubCategory } from '@shared/constants/categories';

interface Filters {
  category?: ImageSubCategory;
  hasAnalysis?: boolean;
}

interface ImageFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export default function ImageFilters({ filters, onChange }: ImageFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* 카테고리 필터 */}
      <select
        value={filters.category ?? ''}
        onChange={e => onChange({
          ...filters,
          category: e.target.value ? e.target.value as ImageSubCategory : undefined,
        })}
        className="px-4 py-2 border-2 border-ink bg-paper text-ink focus:outline-none"
      >
        <option value="">전체 카테고리</option>
        {IMAGE_SUB_CATEGORIES.map(category => (
          <option key={category} value={category}>
            {IMAGE_SUB_CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>

      {/* 분석 상태 필터 */}
      <select
        value={filters.hasAnalysis === undefined ? '' : filters.hasAnalysis.toString()}
        onChange={e => onChange({
          ...filters,
          hasAnalysis: e.target.value === '' ? undefined : e.target.value === 'true',
        })}
        className="px-4 py-2 border-2 border-ink bg-paper text-ink focus:outline-none"
      >
        <option value="">전체 상태</option>
        <option value="true">분석 완료</option>
        <option value="false">미분석</option>
      </select>
    </div>
  );
}
```

### spa/src/components/image/index.ts

```typescript
export { default as ImageGallery } from './ImageGallery';
export { default as ImageCard } from './ImageCard';
export { default as ImageFilters } from './ImageFilters';
export { default as ImageViewer } from './ImageViewer';
```

## 완료 기준

- [ ] ImageGallery: 이미지 그리드 레이아웃
- [ ] ImageCard: 썸네일, 카테고리 뱃지, 분석 상태
- [ ] 필터: 카테고리별, 분석 상태별
- [ ] 삭제: 확인 모달 + 낙관적 업데이트
- [ ] 이미지 클릭: 뷰어 모달 열기
- [ ] 호버 효과: 오버레이, 삭제 버튼
- [ ] 빈 상태 처리

## 참조 문서

- spec/06-page-layouts.md Section 3.2 (이미지 그리드)
- spec/04-data-flow.md Section 5 (썸네일 캐싱)
