import { SOURCE_COLORS, type DataType } from '@shared/constants';
import type { CompanyDetailDTO } from '@shared/types';

interface CompanyMetaProps {
  company: CompanyDetailDTO;
}

export default function CompanyMeta({ company }: CompanyMetaProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-surface-raised border-2 border-ink p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-ink-muted mb-2">데이터 소스</h3>
        <div className="flex flex-wrap gap-2">
          {company.dataSources.map((source) => (
            <span
              key={source}
              className="px-3 py-1.5 text-sm font-semibold text-white"
              style={{ backgroundColor: SOURCE_COLORS[source as DataType] }}
            >
              {source}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t-2 border-ink">
        <div>
          <p className="text-sm text-ink-muted mb-1">총 이미지</p>
          <p className="text-2xl font-bold text-ink">{company.imageCount}개</p>
        </div>
        <div>
          <p className="text-sm text-ink-muted mb-1">분석 상태</p>
          <p className="text-2xl font-bold text-ink">
            {company.analyzedCount > 0 ? (
              <span className="text-signal-positive">완료</span>
            ) : (
              <span className="text-ink-muted">미완료</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-muted mb-1">생성일</p>
          <p className="text-sm font-semibold text-ink">{formatDate(company.createdAt)}</p>
        </div>
        <div>
          <p className="text-sm text-ink-muted mb-1">최근 수정</p>
          <p className="text-sm font-semibold text-ink">{formatDate(company.updatedAt)}</p>
        </div>
      </div>
    </div>
  );
}
