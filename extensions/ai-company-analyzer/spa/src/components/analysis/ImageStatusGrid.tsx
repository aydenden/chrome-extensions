/**
 * 분석 대상 이미지 상태 그리드 컴포넌트
 */
import Card from '@/components/ui/Card';
import { CATEGORY_LABELS, type ImageSubCategory } from '@shared/constants/categories';
import type { ImageMetaDTO } from '@shared/types/models';

// ============================================================================
// Props
// ============================================================================

interface ImageStatusGridProps {
  images: ImageMetaDTO[];
  completedImageIds: Set<string>;
  failedImageIds: Set<string>;
}

// ============================================================================
// Component
// ============================================================================

export default function ImageStatusGrid({
  images,
  completedImageIds,
  failedImageIds,
}: ImageStatusGridProps) {
  if (!images || images.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <h2 className="headline text-xl mb-4">분석 대상 ({images.length}개)</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.map((image) => {
          const isCompleted = completedImageIds.has(image.id);
          const isFailed = failedImageIds.has(image.id);

          return (
            <div
              key={image.id}
              className={`p-3 border-2 transition-colors ${
                isFailed
                  ? 'border-signal-negative bg-red-50'
                  : isCompleted
                    ? 'border-signal-positive bg-green-50'
                    : 'border-border-subtle bg-surface-elevated'
              }`}
            >
              <div className="text-xs text-ink-muted mb-1">
                {image.category
                  ? CATEGORY_LABELS[image.category as ImageSubCategory]
                  : '미분류'}
              </div>
              <div className="text-xs text-ink-muted">
                {(image.size / 1024).toFixed(1)} KB
              </div>
              {isCompleted && !isFailed && (
                <div className="mt-2 text-xs text-signal-positive font-semibold">완료</div>
              )}
              {isFailed && (
                <div className="mt-2 text-xs text-signal-negative font-semibold">실패</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
