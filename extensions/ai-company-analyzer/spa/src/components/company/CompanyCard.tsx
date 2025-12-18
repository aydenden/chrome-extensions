import { useNavigate } from 'react-router-dom';
import { Card, Button } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { SOURCE_COLORS, type DataType } from '@shared/constants';
import type { CompanyDTO } from '@shared/types';

interface CompanyCardProps {
  company: CompanyDTO;
  onDelete: (companyId: string) => void;
}

export default function CompanyCard({ company, onDelete }: CompanyCardProps) {
  const navigate = useNavigate();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(company.id);
  };

  return (
    <Card
      hoverable
      onClick={() => navigate(ROUTES.COMPANY_DETAIL(company.id))}
      className="p-6 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="headline text-lg mb-2 truncate">{company.name}</h3>
          <div className="flex flex-wrap gap-2">
            {company.dataSources.map((source) => (
              <span
                key={source}
                className="px-2 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: SOURCE_COLORS[source as DataType] }}
              >
                {source}
              </span>
            ))}
          </div>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          className="shrink-0"
        >
          삭제
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-ink-muted">이미지</span>
          <span className="ml-2 font-semibold text-ink">{company.imageCount}개</span>
        </div>
        <div>
          <span className="text-ink-muted">분석</span>
          <span className="ml-2 font-semibold text-ink">
            {company.analyzedCount > 0 ? '완료' : '미완료'}
          </span>
        </div>
      </div>

      <div className="text-xs text-ink-muted">
        <div>생성: {new Date(company.createdAt).toLocaleDateString('ko-KR')}</div>
        <div>수정: {new Date(company.updatedAt).toLocaleDateString('ko-KR')}</div>
      </div>
    </Card>
  );
}
