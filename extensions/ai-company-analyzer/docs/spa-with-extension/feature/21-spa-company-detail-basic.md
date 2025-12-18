# Feature 21: 회사 상세 페이지 기본 구조

## 개요

개별 회사의 상세 정보를 표시하는 페이지의 기본 구조를 구현합니다.

## 범위

- CompanyDetail 페이지 레이아웃
- 회사 정보 헤더 (이름, 데이터 소스, 통계)
- 탭 네비게이션 (이미지, 분석)
- 라우트 파라미터 처리

## 의존성

- Feature 20: 회사 목록 페이지

## 구현 상세

### spa/src/pages/CompanyDetail.tsx

```tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany, useDeleteCompany } from '@/hooks/useCompanies';
import { PageHeader } from '@/components/layout';
import { Button, Spinner, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ROUTES } from '@/lib/routes';
import { DATA_TYPE_LABELS } from '@shared/constants/categories';
import ImageGallery from '@/components/image/ImageGallery';
import AnalysisReport from '@/components/analysis/AnalysisReport';

type TabType = 'images' | 'analysis';

export default function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('images');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: company, isLoading, error } = useCompany(companyId);
  const deleteCompany = useDeleteCompany();

  const handleDelete = async () => {
    if (!companyId || !company) return;

    try {
      await deleteCompany.mutateAsync(companyId);
      showToast(`${company.name} 삭제 완료`, 'success');
      navigate(ROUTES.HOME);
    } catch (err) {
      showToast('삭제 실패', 'error');
    }
  };

  const handleAnalyze = () => {
    if (companyId) {
      navigate(ROUTES.ANALYSIS(companyId));
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

  if (error || !company) {
    return (
      <div className="editorial-grid">
        <div className="col-span-12 text-center py-20">
          <p className="text-signal-negative mb-4">회사 정보를 찾을 수 없습니다.</p>
          <Button variant="secondary" onClick={() => navigate(ROUTES.HOME)}>
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={company.name}
        backTo={ROUTES.HOME}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleAnalyze}
            >
              AI 분석 시작
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDeleteModal(true)}
              className="text-ink-muted hover:text-signal-negative"
              aria-label="삭제"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
          </>
        }
      />

      <div className="editorial-grid">
        {/* 회사 메타 정보 */}
        <div className="col-span-12 mb-8">
          <CompanyMeta company={company} />
        </div>

        {/* 탭 네비게이션 */}
        <div className="col-span-12 mb-6">
          <TabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            imageCount={company.imageCount}
            hasAnalysis={company.hasAnalysis}
          />
        </div>

        {/* 탭 컨텐츠 */}
        <div className="col-span-12">
          {activeTab === 'images' ? (
            <ImageGallery companyId={companyId!} />
          ) : (
            <AnalysisReport companyId={companyId!} />
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="회사 삭제"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
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
          <strong>{company.name}</strong>을(를) 삭제하시겠습니까?
        </p>
        <p className="text-ink-muted text-sm mt-2">
          관련된 모든 이미지와 분석 결과도 함께 삭제됩니다.
        </p>
      </Modal>
    </>
  );
}
```

### spa/src/pages/CompanyDetail/CompanyMeta.tsx

```tsx
import { DATA_TYPE_LABELS, type DataType } from '@shared/constants/categories';
import type { CompanyDetail } from '@shared/types';

interface CompanyMetaProps {
  company: CompanyDetail;
}

export default function CompanyMeta({ company }: CompanyMetaProps) {
  return (
    <div className="bg-surface-elevated border border-border-subtle p-6">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {/* 데이터 소스 뱃지 */}
        {company.dataSources.map((source: DataType) => (
          <span
            key={source}
            className={`px-3 py-1 text-sm font-medium text-white bg-source-${source.toLowerCase()}`}
          >
            {DATA_TYPE_LABELS[source]}
          </span>
        ))}
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <StatItem label="총 이미지" value={company.imageCount} />
        <StatItem
          label="분석 상태"
          value={company.hasAnalysis ? '완료' : '미완료'}
          valueColor={company.hasAnalysis ? 'text-signal-positive' : 'text-ink-muted'}
        />
        <StatItem
          label="생성일"
          value={new Date(company.createdAt).toLocaleDateString('ko-KR')}
        />
        <StatItem
          label="최근 수정"
          value={new Date(company.updatedAt).toLocaleDateString('ko-KR')}
        />
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string | number;
  valueColor?: string;
}

function StatItem({ label, value, valueColor = 'text-ink' }: StatItemProps) {
  return (
    <div>
      <span className="label block mb-1">{label}</span>
      <span className={`data-figure text-xl ${valueColor}`}>{value}</span>
    </div>
  );
}
```

### spa/src/pages/CompanyDetail/TabNavigation.tsx

```tsx
interface TabNavigationProps {
  activeTab: 'images' | 'analysis';
  onTabChange: (tab: 'images' | 'analysis') => void;
  imageCount: number;
  hasAnalysis: boolean;
}

export default function TabNavigation({
  activeTab,
  onTabChange,
  imageCount,
  hasAnalysis,
}: TabNavigationProps) {
  const tabs = [
    { id: 'images' as const, label: '이미지', count: imageCount },
    { id: 'analysis' as const, label: '분석 결과', badge: hasAnalysis },
  ];

  return (
    <div className="flex border-b-2 border-ink">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-6 py-3 font-semibold transition-colors relative ${
            activeTab === tab.id
              ? 'text-ink bg-ink text-paper'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <span>{tab.label}</span>

          {'count' in tab && (
            <span className="ml-2 data-figure text-sm">
              ({tab.count})
            </span>
          )}

          {'badge' in tab && tab.badge && (
            <span className="ml-2 w-2 h-2 rounded-full bg-signal-positive inline-block" />
          )}
        </button>
      ))}
    </div>
  );
}
```

### spa/src/pages/CompanyDetail/index.ts

```typescript
export { default } from './CompanyDetail';
```

### spa/src/components/image/ImageGallery.tsx (스텁)

```tsx
// Feature 22에서 구현
interface ImageGalleryProps {
  companyId: string;
}

export default function ImageGallery({ companyId }: ImageGalleryProps) {
  return (
    <div className="text-center py-20 text-ink-muted">
      이미지 갤러리 (Feature 22에서 구현)
    </div>
  );
}
```

### spa/src/components/analysis/AnalysisReport.tsx (스텁)

```tsx
// Feature 33에서 구현
interface AnalysisReportProps {
  companyId: string;
}

export default function AnalysisReport({ companyId }: AnalysisReportProps) {
  return (
    <div className="text-center py-20 text-ink-muted">
      분석 결과 (Feature 33에서 구현)
    </div>
  );
}
```

## 완료 기준

- [ ] CompanyDetail 페이지: 회사 정보 표시
- [ ] CompanyMeta: 데이터 소스, 통계 표시
- [ ] TabNavigation: 이미지/분석 탭 전환
- [ ] 뒤로가기: 목록 페이지로 이동
- [ ] AI 분석 시작 버튼: 분석 페이지로 이동
- [ ] 삭제: 확인 모달 후 삭제 및 목록으로 이동
- [ ] 로딩/에러 상태 처리

## 참조 문서

- spec/06-page-layouts.md Section 3 (회사 상세)
