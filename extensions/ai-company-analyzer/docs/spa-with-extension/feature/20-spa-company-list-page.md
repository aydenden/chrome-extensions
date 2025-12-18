# Feature 20: 회사 목록 페이지

## 개요

SPA의 메인 페이지로 수집된 회사 목록을 표시하고 필터링/정렬 기능을 제공합니다.

## 범위

- CompanyList 페이지 컴포넌트
- CompanyCard 컴포넌트
- 필터 (사이트별)
- 정렬 (이름, 생성일, 수정일)
- 검색 기능

## 의존성

- Feature 15: React Query + Query Key Factory
- Feature 18: 기본 UI 컴포넌트

## 구현 상세

### spa/src/pages/CompanyList.tsx

```tsx
import { useState, useMemo } from 'react';
import { useCompanies, useDeleteCompany } from '@/hooks/useCompanies';
import { useStats } from '@/hooks/useStats';
import { PageHeader } from '@/components/layout';
import { Button, Card, Spinner, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import CompanyCard from '@/components/company/CompanyCard';
import CompanyFilters from '@/components/company/CompanyFilters';
import type { DataType } from '@shared/constants/categories';

interface Filters {
  siteType?: DataType;
  sortBy: 'name' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  search: string;
}

export default function CompanyList() {
  const [filters, setFilters] = useState<Filters>({
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    search: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: companies, isLoading, error } = useCompanies({
    siteType: filters.siteType,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  const { data: stats } = useStats();
  const deleteCompany = useDeleteCompany();
  const { showToast } = useToast();

  // 클라이언트 사이드 검색 필터링
  const filteredCompanies = useMemo(() => {
    if (!companies || !filters.search) return companies;

    const searchLower = filters.search.toLowerCase();
    return companies.filter(company =>
      company.name.toLowerCase().includes(searchLower)
    );
  }, [companies, filters.search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteCompany.mutateAsync(deleteTarget.id);
      showToast(`${deleteTarget.name} 삭제 완료`, 'success');
      setDeleteTarget(null);
    } catch (err) {
      showToast('삭제 실패', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="editorial-grid">
        <div className="col-span-12 flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editorial-grid">
        <div className="col-span-12 text-center py-20">
          <p className="text-signal-negative">데이터를 불러오는 중 오류가 발생했습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="수집된 회사"
        subtitle={stats ? `${stats.totalCompanies}개 회사, ${stats.totalImages}개 이미지` : undefined}
      />

      <div className="editorial-grid">
        {/* 필터 영역 */}
        <div className="col-span-12 mb-6">
          <CompanyFilters
            filters={filters}
            onChange={setFilters}
          />
        </div>

        {/* 회사 카드 그리드 */}
        {filteredCompanies && filteredCompanies.length > 0 ? (
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map(company => (
              <CompanyCard
                key={company.id}
                company={company}
                onDelete={() => setDeleteTarget({ id: company.id, name: company.name })}
              />
            ))}
          </div>
        ) : (
          <div className="col-span-12 text-center py-20">
            <p className="text-ink-muted">
              {filters.search
                ? '검색 결과가 없습니다.'
                : '수집된 회사가 없습니다. Extension에서 회사 정보를 캡처해주세요.'}
            </p>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="회사 삭제"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleteCompany.isPending}
            >
              삭제
            </Button>
          </>
        }
      >
        <p className="text-ink">
          <strong>{deleteTarget?.name}</strong>을(를) 삭제하시겠습니까?
        </p>
        <p className="text-ink-muted text-sm mt-2">
          관련된 모든 이미지와 분석 결과도 함께 삭제됩니다.
        </p>
      </Modal>
    </>
  );
}
```

### spa/src/components/company/CompanyCard.tsx

```tsx
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { DATA_TYPE_LABELS } from '@shared/constants/categories';
import type { CompanySummary } from '@shared/types';

interface CompanyCardProps {
  company: CompanySummary;
  onDelete: () => void;
}

export default function CompanyCard({ company, onDelete }: CompanyCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(ROUTES.COMPANY_DETAIL(company.id));
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <Card hoverable onClick={handleClick} className="p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="headline text-xl truncate flex-1 mr-4">
          {company.name}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDeleteClick}
          className="text-ink-muted hover:text-signal-negative shrink-0"
          aria-label="삭제"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </Button>
      </div>

      {/* 데이터 소스 뱃지 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {company.dataSources.map(source => (
          <span
            key={source}
            className={`px-2 py-0.5 text-xs font-medium text-white bg-source-${source.toLowerCase()}`}
          >
            {DATA_TYPE_LABELS[source]}
          </span>
        ))}
      </div>

      {/* 통계 */}
      <div className="flex items-center gap-6 text-sm text-ink-muted">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="data-figure">{company.imageCount}</span>
        </span>

        {company.hasAnalysis && (
          <span className="flex items-center gap-1 text-signal-positive">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            분석 완료
          </span>
        )}
      </div>

      {/* 날짜 */}
      <div className="mt-4 pt-4 border-t border-border-subtle text-xs text-ink-muted">
        수정: {new Date(company.updatedAt).toLocaleDateString('ko-KR')}
      </div>
    </Card>
  );
}
```

### spa/src/components/company/CompanyFilters.tsx

```tsx
import { DATA_TYPES, DATA_TYPE_LABELS, type DataType } from '@shared/constants/categories';

interface Filters {
  siteType?: DataType;
  sortBy: 'name' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  search: string;
}

interface CompanyFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export default function CompanyFilters({ filters, onChange }: CompanyFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* 검색 */}
      <div className="flex-1 min-w-[200px]">
        <input
          type="text"
          placeholder="회사명 검색..."
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          className="w-full px-4 py-2 border-2 border-ink bg-paper text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </div>

      {/* 사이트 필터 */}
      <select
        value={filters.siteType ?? ''}
        onChange={e => onChange({
          ...filters,
          siteType: e.target.value ? e.target.value as DataType : undefined,
        })}
        className="px-4 py-2 border-2 border-ink bg-paper text-ink focus:outline-none"
      >
        <option value="">전체 사이트</option>
        {DATA_TYPES.map(type => (
          <option key={type} value={type}>
            {DATA_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      {/* 정렬 */}
      <select
        value={`${filters.sortBy}-${filters.sortOrder}`}
        onChange={e => {
          const [sortBy, sortOrder] = e.target.value.split('-') as [Filters['sortBy'], Filters['sortOrder']];
          onChange({ ...filters, sortBy, sortOrder });
        }}
        className="px-4 py-2 border-2 border-ink bg-paper text-ink focus:outline-none"
      >
        <option value="updatedAt-desc">최근 수정순</option>
        <option value="updatedAt-asc">오래된 수정순</option>
        <option value="createdAt-desc">최근 생성순</option>
        <option value="createdAt-asc">오래된 생성순</option>
        <option value="name-asc">이름 오름차순</option>
        <option value="name-desc">이름 내림차순</option>
      </select>
    </div>
  );
}
```

### spa/src/components/company/index.ts

```typescript
export { default as CompanyCard } from './CompanyCard';
export { default as CompanyFilters } from './CompanyFilters';
```

## 완료 기준

- [ ] CompanyList 페이지: 회사 목록 표시
- [ ] CompanyCard: 이름, 데이터 소스, 이미지 수, 분석 상태
- [ ] 필터: 사이트별 필터링
- [ ] 정렬: 이름, 생성일, 수정일 기준
- [ ] 검색: 회사명 검색
- [ ] 삭제: 확인 모달 후 삭제
- [ ] 빈 상태: 수집된 회사 없음 안내
- [ ] 로딩/에러 상태 처리

## 참조 문서

- spec/06-page-layouts.md Section 2 (회사 목록)
- spec/05-design-system.md Section 9 (삭제 버튼 스타일)
