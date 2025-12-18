import { DATA_TYPES, type DataType } from '@shared/constants';

interface CompanyFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  siteType?: DataType;
  onSiteTypeChange: (siteType?: DataType) => void;
  sortBy: 'updatedAt' | 'createdAt' | 'name';
  onSortByChange: (sortBy: 'updatedAt' | 'createdAt' | 'name') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (sortOrder: 'asc' | 'desc') => void;
}

export default function CompanyFilters({
  search,
  onSearchChange,
  siteType,
  onSiteTypeChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: CompanyFiltersProps) {
  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="회사명 검색..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full px-4 py-2 border-2 border-border-subtle bg-surface-elevated text-ink placeholder-ink-muted focus:border-ink focus:outline-none"
      />

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-semibold text-ink mb-1">데이터 소스</label>
          <select
            value={siteType ?? ''}
            onChange={(e) => onSiteTypeChange(e.target.value ? (e.target.value as DataType) : undefined)}
            className="w-full px-3 py-2 border-2 border-border-subtle bg-surface-elevated text-ink focus:border-ink focus:outline-none"
          >
            <option value="">전체</option>
            {DATA_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-semibold text-ink mb-1">정렬 기준</label>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as 'updatedAt' | 'createdAt' | 'name')}
            className="w-full px-3 py-2 border-2 border-border-subtle bg-surface-elevated text-ink focus:border-ink focus:outline-none"
          >
            <option value="updatedAt">최근 수정</option>
            <option value="createdAt">최근 생성</option>
            <option value="name">이름</option>
          </select>
        </div>

        <div className="w-[120px]">
          <label className="block text-sm font-semibold text-ink mb-1">정렬 방향</label>
          <select
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as 'asc' | 'desc')}
            className="w-full px-3 py-2 border-2 border-border-subtle bg-surface-elevated text-ink focus:border-ink focus:outline-none"
          >
            <option value="desc">내림차순</option>
            <option value="asc">오름차순</option>
          </select>
        </div>
      </div>
    </div>
  );
}
