/**
 * 분석 컨텍스트 카드 컴포넌트
 * AI 분석 시 참고할 추가 정보를 입력하는 카드
 */
import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface AnalysisContextCardProps {
  context: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving?: boolean;
  readOnly?: boolean;
}

export default function AnalysisContextCard({
  context,
  onChange,
  onSave,
  isSaving = false,
  readOnly = false,
}: AnalysisContextCardProps) {
  const [isExpanded, setIsExpanded] = useState(!!context);

  // 읽기 전용 모드: 내용이 있을 때만 표시
  if (readOnly) {
    if (!context) return null;

    return (
      <Card className="p-6">
        <h2 className="headline text-lg mb-3">분석 컨텍스트</h2>
        <div className="p-4 bg-surface-sunken text-sm text-ink whitespace-pre-wrap">
          {context}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="headline text-lg">분석 컨텍스트</h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-ink-muted hover:text-ink transition-colors"
        >
          {isExpanded ? '접기' : '펼치기'}
        </button>
      </div>

      {isExpanded ? (
        <>
          <p className="text-sm text-ink-muted mb-3">
            AI 분석 시 참고할 추가 정보를 입력하세요 (예: 관심 분야, 특별히 확인하고 싶은 내용)
          </p>
          <textarea
            value={context}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-24 p-3 border-2 border-border-subtle bg-paper text-sm resize-none focus:border-ink focus:outline-none"
            placeholder="예: 워라밸 중시, 기술 스택 중요, 성장 가능성 확인..."
          />
          <div className="flex justify-end mt-3">
            <Button
              onClick={onSave}
              variant="secondary"
              size="sm"
              loading={isSaving}
              disabled={isSaving}
            >
              저장
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          {context ? `"${context.slice(0, 50)}${context.length > 50 ? '...' : ''}"` : '클릭하여 컨텍스트 추가'}
        </p>
      )}
    </Card>
  );
}
