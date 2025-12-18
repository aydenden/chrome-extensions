import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { CompanyMeta, TabNavigation } from '@/components/company';
import { ImageGallery } from '@/components/image';
import { AnalysisReport } from '@/components/analysis';
import { Spinner, Modal, Button } from '@/components/ui';
import { useCompany, useDeleteCompany } from '@/hooks';
import { ROUTES } from '@/lib/routes';

type TabId = 'images' | 'analysis';

export default function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('images');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { data: company, isLoading, error } = useCompany(companyId);
  const deleteCompany = useDeleteCompany();

  const handleStartAnalysis = () => {
    if (companyId) {
      navigate(ROUTES.ANALYSIS(companyId));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!companyId) return;

    try {
      await deleteCompany.mutateAsync(companyId);
      navigate(ROUTES.HOME);
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

  if (error || !company) {
    return (
      <>
        <PageHeader title="회사 상세" backTo={ROUTES.HOME} />
        <div className="editorial-grid">
          <div className="col-span-12">
            <div className="p-6 bg-signal-negative/10 border-2 border-signal-negative text-signal-negative">
              {error instanceof Error ? error.message : '회사 정보를 찾을 수 없습니다'}
            </div>
          </div>
        </div>
      </>
    );
  }

  const tabs = [
    { id: 'images' as TabId, label: '이미지', count: company.imageCount },
    { id: 'analysis' as TabId, label: '분석 결과', badge: company.analyzedCount > 0 ? '완료' : undefined },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as TabId);
  };

  return (
    <>
      <PageHeader
        title={company.name}
        backTo={ROUTES.HOME}
        actions={
          <>
            <Button variant="primary" onClick={handleStartAnalysis}>
              AI 분석 시작
            </Button>
            <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
              삭제
            </Button>
          </>
        }
      />

      <div className="editorial-grid">
        <div className="col-span-12">
          <CompanyMeta company={company} />
        </div>

        <div className="col-span-12">
          <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
        </div>

        <div className="col-span-12">
          {activeTab === 'images' && <ImageGallery companyId={companyId!} />}
          {activeTab === 'analysis' && <AnalysisReport companyId={companyId!} />}
        </div>
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="회사 삭제"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleteCompany.isPending}>
              취소
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={deleteCompany.isPending}>
              삭제
            </Button>
          </>
        }
      >
        <p className="text-ink">
          <strong>{company.name}</strong> 회사를 삭제하시겠습니까?
        </p>
        <p className="text-sm text-ink-muted mt-2">관련된 모든 이미지와 데이터가 함께 삭제됩니다.</p>
      </Modal>
    </>
  );
}
