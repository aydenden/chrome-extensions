/**
 * 분석 대상 이미지 상태 그리드 컴포넌트
 * 신규 분석 대상과 이전 분석 완료를 분리하여 표시
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import Card from '@/components/ui/Card';
import { CATEGORY_LABELS, type ImageSubCategory } from '@shared/constants/categories';
import type { ImageMetaDTO } from '@shared/types/models';

// ============================================================================
// Props
// ============================================================================

interface ImageStatusGridProps {
  /** 신규 분석 대상 이미지 */
  toBeAnalyzed: ImageMetaDTO[];
  /** 이전 분석 완료 이미지 (같은 모델) */
  previouslyAnalyzed: ImageMetaDTO[];
  /** 이전 분석 포함 여부 */
  includePrevious: boolean;
  /** 이전 분석 포함 토글 핸들러 */
  onToggleIncludePrevious: (value: boolean) => void;
  /** 현재 세션에서 완료된 이미지 ID */
  completedImageIds: Set<string>;
  /** 현재 세션에서 실패한 이미지 ID */
  failedImageIds: Set<string>;
  /** 현재 분석 중인 이미지 ID */
  currentAnalyzingId?: string | null;
  /** 분석 중인지 여부 */
  isAnalyzing?: boolean;
  /** 메모 업데이트 핸들러 */
  onUpdateMemo?: (imageId: string, memo: string) => void;
}

// ============================================================================
// Sub Components
// ============================================================================

interface ImageStatusItemProps {
  image: ImageMetaDTO;
  status: 'pending' | 'analyzing' | 'completed' | 'failed' | 'previous';
  onUpdateMemo?: (imageId: string, memo: string) => void;
  isAnalyzing?: boolean;
}

function ImageStatusItem({ image, status, onUpdateMemo, isAnalyzing }: ImageStatusItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [memoValue, setMemoValue] = useState(image.memo || '');
  const [isHovered, setIsHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 이미지 메모가 외부에서 변경되면 동기화
  useEffect(() => {
    if (!isEditing) {
      setMemoValue(image.memo || '');
    }
  }, [image.memo, isEditing]);

  // debounce 저장
  const saveMemo = useCallback((value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      if (onUpdateMemo && value !== image.memo) {
        onUpdateMemo(image.id, value);
      }
    }, 500);
  }, [image.id, image.memo, onUpdateMemo]);

  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMemoValue(value);
    saveMemo(value);
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleBlur = () => {
    // 즉시 저장
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (onUpdateMemo && memoValue !== image.memo) {
      onUpdateMemo(image.id, memoValue);
    }
    setIsEditing(false);
  };

  const statusStyles = {
    pending: 'border-border-subtle bg-surface-elevated',
    analyzing: 'border-signal-neutral bg-blue-50 animate-pulse',
    completed: 'border-signal-positive bg-green-50',
    failed: 'border-signal-negative bg-red-50',
    previous: 'border-signal-neutral bg-blue-50/50',
  };

  const statusLabels = {
    pending: null,
    analyzing: '분석 중...',
    completed: '완료',
    failed: '실패',
    previous: '완료',
  };

  const statusTextColors = {
    pending: '',
    analyzing: 'text-signal-neutral',
    completed: 'text-signal-positive',
    failed: 'text-signal-negative',
    previous: 'text-signal-neutral',
  };

  const canEdit = onUpdateMemo && !isAnalyzing;

  return (
    <div
      className={`p-3 border-2 transition-colors relative ${statusStyles[status]}`}
      data-testid="image-item"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 편집 버튼 - 호버 시 표시 */}
      {canEdit && isHovered && !isEditing && (
        <button
          type="button"
          onClick={handleEditClick}
          className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center
                     bg-ink/80 text-paper rounded hover:bg-ink transition-colors"
          title="메모 편집"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}

      <div className="text-xs text-ink-muted mb-1">
        {image.category
          ? CATEGORY_LABELS[image.category as ImageSubCategory]
          : '미분류'}
      </div>
      <div className="text-xs text-ink-muted">
        {(image.size / 1024).toFixed(1)} KB
      </div>

      {/* 메모 표시/편집 영역 */}
      {isEditing ? (
        <div className="mt-2">
          <textarea
            ref={textareaRef}
            value={memoValue}
            onChange={handleMemoChange}
            onBlur={handleBlur}
            placeholder="메모 입력..."
            className="w-full text-xs p-2 border border-border-subtle rounded resize-none
                       focus:outline-none focus:ring-1 focus:ring-signal-neutral"
            rows={2}
          />
        </div>
      ) : image.memo ? (
        <div
          className="mt-1 text-xs text-ink-soft truncate cursor-pointer hover:text-ink"
          title={image.memo}
          onClick={canEdit ? handleEditClick : undefined}
        >
          {image.memo}
        </div>
      ) : canEdit && isHovered ? (
        <div
          className="mt-1 text-xs text-ink-muted/50 cursor-pointer hover:text-ink-muted"
          onClick={handleEditClick}
        >
          + 메모 추가
        </div>
      ) : null}

      {statusLabels[status] && (
        <div className={`mt-2 text-xs font-semibold ${statusTextColors[status]}`}>
          {statusLabels[status]}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ImageStatusGrid({
  toBeAnalyzed,
  previouslyAnalyzed,
  includePrevious,
  onToggleIncludePrevious,
  completedImageIds,
  failedImageIds,
  currentAnalyzingId,
  isAnalyzing = false,
  onUpdateMemo,
}: ImageStatusGridProps) {
  const totalToAnalyze = includePrevious
    ? toBeAnalyzed.length + previouslyAnalyzed.length
    : toBeAnalyzed.length;

  const allImages = [...toBeAnalyzed, ...previouslyAnalyzed];
  if (allImages.length === 0) {
    return null;
  }

  const getImageStatus = (image: ImageMetaDTO, isPrevious: boolean): ImageStatusItemProps['status'] => {
    if (failedImageIds.has(image.id)) return 'failed';
    if (completedImageIds.has(image.id)) return 'completed';
    if (currentAnalyzingId === image.id) return 'analyzing';
    if (isPrevious && !includePrevious) return 'previous';
    return 'pending';
  };

  return (
    <Card className="p-6" data-testid="image-list">
      {/* 헤더 + 토글 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="headline text-xl">
          분석 대상 ({totalToAnalyze}개)
        </h2>
        {previouslyAnalyzed.length > 0 && (
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includePrevious}
              onChange={(e) => onToggleIncludePrevious(e.target.checked)}
              className="w-4 h-4 rounded border-border-subtle accent-signal-neutral"
              disabled={isAnalyzing}
            />
            <span className={isAnalyzing ? 'text-ink-muted' : 'text-ink'}>
              이전 분석 포함 ({previouslyAnalyzed.length}개)
            </span>
          </label>
        )}
      </div>

      {/* 신규 분석 대상 섹션 */}
      {toBeAnalyzed.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-ink mb-3">
            신규 분석 ({toBeAnalyzed.length}개)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {toBeAnalyzed.map((image) => (
              <ImageStatusItem
                key={image.id}
                image={image}
                status={getImageStatus(image, false)}
                onUpdateMemo={onUpdateMemo}
                isAnalyzing={isAnalyzing}
              />
            ))}
          </div>
        </div>
      )}

      {/* 이전 분석 완료 섹션 */}
      {previouslyAnalyzed.length > 0 && (
        <div className={`pt-4 border-t border-border-subtle ${!includePrevious ? 'opacity-60' : ''}`}>
          <h3 className="text-sm font-semibold text-ink-muted mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-signal-neutral" />
            이전 분석 완료 ({previouslyAnalyzed.length}개)
            {!includePrevious && <span className="text-xs font-normal">(분석 제외)</span>}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {previouslyAnalyzed.map((image) => (
              <ImageStatusItem
                key={image.id}
                image={image}
                status={getImageStatus(image, true)}
                onUpdateMemo={onUpdateMemo}
                isAnalyzing={isAnalyzing}
              />
            ))}
          </div>
        </div>
      )}

      {/* 신규 분석 대상이 없는 경우 */}
      {toBeAnalyzed.length === 0 && previouslyAnalyzed.length > 0 && !includePrevious && (
        <div className="p-4 bg-surface-sunken text-center text-sm text-ink-muted">
          모든 이미지가 이미 분석되었습니다. 재분석하려면 "이전 분석 포함"을 체크하세요.
        </div>
      )}
    </Card>
  );
}
