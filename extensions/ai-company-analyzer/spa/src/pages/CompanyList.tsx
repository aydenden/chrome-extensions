import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/layout';
import { CompanyCard, CompanyFilters } from '@/components/company';
import { Spinner, Modal, Button } from '@/components/ui';
import { useCompanies, useStats, useDeleteCompany } from '@/hooks';
import type { DataType } from '@shared/constants';

export default function CompanyList() {
  const [search, setSearch] = useState('');
  const [siteType, setSiteType] = useState<DataType | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'name'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: companies, isLoading, error } = useCompanies({ siteType, sortBy, sortOrder });
  const { data: stats } = useStats();
  const deleteCompany = useDeleteCompany();

  const filteredCompanies = useMemo(() => {
    if (!companies) return [];
    if (!search.trim()) return companies;

    const searchLower = search.toLowerCase().trim();
    return companies.filter((company) => company.name.toLowerCase().includes(searchLower));
  }, [companies, search]);

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      await deleteCompany.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete company:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="회사 목록" subtitle="수집된 회사 정보를 관리합니다" />
        <div className="editorial-grid">
          <div className="col-span-12">
            <div className="p-6 bg-signal-negative/10 border-2 border-signal-negative text-signal-negative">
              데이터를 불러오는데 실패했습니다: {error instanceof Error ? error.message : '알 수 없는 오류'}
            </div>
          </div>
        </div>
      </>
    );
  }

  const isEmpty = !filteredCompanies || filteredCompanies.length === 0;

  return (
    <>
      <PageHeader
        title="회사 목록"
        subtitle={`전체 ${stats?.totalCompanies ?? 0}개 회사, ${stats?.totalImages ?? 0}개 이미지`}
      />

      <div className="editorial-grid">
        <div className="col-span-12">
          <CompanyFilters
            search={search}
            onSearchChange={setSearch}
            siteType={siteType}
            onSiteTypeChange={setSiteType}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          />
        </div>

        {isEmpty ? (
          <div className="col-span-12">
            <div className="p-12 text-center text-ink-muted">
              {search ? '검색 결과가 없습니다.' : '등록된 회사가 없습니다.'}
            </div>
          </div>
        ) : (
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                onDelete={(id) => handleDeleteClick(id, company.name)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="회사 삭제"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteCompany.isPending}>
              취소
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={deleteCompany.isPending}>
              삭제
            </Button>
          </>
        }
      >
        <p className="text-ink">
          <strong>{deleteTarget?.name}</strong> 회사를 삭제하시겠습니까?
        </p>
        <p className="text-sm text-ink-muted mt-2">관련된 모든 이미지와 데이터가 함께 삭제됩니다.</p>
      </Modal>
    </>
  );
}
