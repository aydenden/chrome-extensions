import { IMAGE_SUB_CATEGORIES, CATEGORY_LABELS } from '@shared/constants/categories';
import type { ImageSubCategory } from '@shared/constants/categories';

interface ImageFiltersProps {
  category: ImageSubCategory | 'all';
  onCategoryChange: (value: ImageSubCategory | 'all') => void;
  hasAnalysis: boolean | 'all';
  onHasAnalysisChange: (value: boolean | 'all') => void;
}

export default function ImageFilters({
  category,
  onCategoryChange,
  hasAnalysis,
  onHasAnalysisChange,
}: ImageFiltersProps) {
  return (
    <div className="flex gap-4 mb-6">
      <div className="flex-1">
        <label htmlFor="category-filter" className="block text-sm font-semibold text-ink mb-2">
          카테고리
        </label>
        <select
          id="category-filter"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as ImageSubCategory | 'all')}
          className="w-full px-4 py-2 bg-paper text-ink border-2 border-ink focus:outline-none focus:ring-2 focus:ring-ink"
        >
          <option value="all">전체</option>
          {IMAGE_SUB_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label htmlFor="analysis-filter" className="block text-sm font-semibold text-ink mb-2">
          분석 상태
        </label>
        <select
          id="analysis-filter"
          value={hasAnalysis === 'all' ? 'all' : hasAnalysis ? 'true' : 'false'}
          onChange={(e) => {
            const value = e.target.value;
            onHasAnalysisChange(value === 'all' ? 'all' : value === 'true');
          }}
          className="w-full px-4 py-2 bg-paper text-ink border-2 border-ink focus:outline-none focus:ring-2 focus:ring-ink"
        >
          <option value="all">전체</option>
          <option value="true">분석완료</option>
          <option value="false">미분석</option>
        </select>
      </div>
    </div>
  );
}
