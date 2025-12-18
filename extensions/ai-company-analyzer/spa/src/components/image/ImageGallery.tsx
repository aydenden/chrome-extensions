import { useState, useMemo, useCallback } from 'react';
import { useImages, useDeleteImage } from '@/hooks/useImages';
import type { ImageSubCategory } from '@shared/constants/categories';
import ImageFilters from './ImageFilters';
import ImageCard from './ImageCard';
import ImageViewer from './ImageViewer';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface ImageGalleryProps {
  companyId: string;
  onImageSelect?: (imageId: string) => void;
}

export default function ImageGallery({ companyId, onImageSelect }: ImageGalleryProps) {
  // 필터 상태
  const [category, setCategory] = useState<ImageSubCategory | 'all'>('all');
  const [hasAnalysis, setHasAnalysis] = useState<boolean | 'all'>('all');

  // 이미지 데이터
  const { data: images, isLoading } = useImages(companyId);
  const deleteImage = useDeleteImage(companyId);

  // 삭제 모달 상태
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 이미지 뷰어 상태
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  // 필터링된 이미지
  const filteredImages = useMemo(() => {
    if (!images) return [];

    return images.filter((img) => {
      if (category !== 'all' && img.category !== category) return false;
      if (hasAnalysis !== 'all' && img.hasAnalysis !== hasAnalysis) return false;
      return true;
    });
  }, [images, category, hasAnalysis]);

  // 이미지 클릭 핸들러
  const handleImageClick = (imageId: string) => {
    setSelectedImageId(imageId);
    onImageSelect?.(imageId);
  };

  // 뷰어 닫기 핸들러
  const handleViewerClose = () => {
    setSelectedImageId(null);
  };

  // 뷰어 네비게이션 핸들러
  const handleViewerNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (!filteredImages.length || !selectedImageId) return;

      const currentIndex = filteredImages.findIndex((img) => img.id === selectedImageId);
      if (currentIndex === -1) return;

      const newIndex =
        direction === 'prev'
          ? (currentIndex - 1 + filteredImages.length) % filteredImages.length
          : (currentIndex + 1) % filteredImages.length;

      setSelectedImageId(filteredImages[newIndex].id);
    },
    [filteredImages, selectedImageId]
  );

  // 삭제 확인 핸들러
  const handleDeleteConfirm = () => {
    if (deleteTargetId) {
      deleteImage.mutate(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <ImageFilters
        category={category}
        onCategoryChange={setCategory}
        hasAnalysis={hasAnalysis}
        onHasAnalysisChange={setHasAnalysis}
      />

      {filteredImages.length === 0 ? (
        <div className="p-12 text-center bg-surface-sunken border-2 border-ink">
          <p className="text-ink-muted text-lg">이미지가 없습니다</p>
          {(category !== 'all' || hasAnalysis !== 'all') && (
            <p className="text-ink-muted text-sm mt-2">필터 조건을 변경해보세요</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredImages.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              onClick={() => handleImageClick(image.id)}
              onDelete={() => setDeleteTargetId(image.id)}
            />
          ))}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        title="이미지 삭제"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTargetId(null)}>
              취소
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={deleteImage.isPending}>
              삭제
            </Button>
          </>
        }
      >
        <p className="text-ink">이미지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
      </Modal>

      {/* 이미지 뷰어 모달 */}
      {selectedImageId && filteredImages.length > 0 && (
        <ImageViewer
          imageId={selectedImageId}
          images={filteredImages}
          onClose={handleViewerClose}
          onNavigate={handleViewerNavigate}
        />
      )}
    </div>
  );
}
