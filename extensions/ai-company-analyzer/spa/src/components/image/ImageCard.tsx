import { useThumbnailWithCache } from '@/hooks/useImageWithCache';
import { CATEGORY_LABELS } from '@shared/constants/categories';
import type { ImageMetaDTO } from '@shared/types/models';
import Spinner from '@/components/ui/Spinner';

interface ImageCardProps {
  image: ImageMetaDTO;
  onClick: () => void;
  onDelete: () => void;
}

export default function ImageCard({ image, onClick, onDelete }: ImageCardProps) {
  const { data: thumbnail, isLoading } = useThumbnailWithCache(image.id);

  return (
    <div className="group relative aspect-square bg-surface-sunken border-2 border-ink overflow-hidden cursor-pointer" data-testid="image-card" onClick={onClick}>
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : thumbnail ? (
        <img src={`data:${thumbnail.mimeType};base64,${thumbnail.base64}`} alt={CATEGORY_LABELS[image.category || 'unknown']} className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-ink-muted">이미지 없음</div>
      )}

      {/* 호버 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* 분석 완료 인디케이터 (상단 좌측) */}
      {image.hasAnalysis && (
        <div className="absolute top-2 left-2 bg-signal-positive text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity" title="분석 완료">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* 삭제 버튼 (상단 우측) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 bg-signal-negative text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
        title="삭제"
        aria-label="이미지 삭제"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 카테고리 뱃지 (하단 좌측) */}
      <div className="absolute bottom-2 left-2 bg-ink text-paper px-2 py-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
        {CATEGORY_LABELS[image.category || 'unknown']}
      </div>
    </div>
  );
}
