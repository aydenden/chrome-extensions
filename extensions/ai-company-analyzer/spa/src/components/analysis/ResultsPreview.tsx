/**
 * 개별 분석 결과 미리보기 컴포넌트
 */
import Card from '@/components/ui/Card';
import { CATEGORY_LABELS, type ImageSubCategory } from '@shared/constants/categories';
import type { AnalysisResultItem } from '@/lib/analysis';

// ============================================================================
// Props
// ============================================================================

interface ResultsPreviewProps {
  results: AnalysisResultItem[];
}

// ============================================================================
// Component
// ============================================================================

export default function ResultsPreview({ results }: ResultsPreviewProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <h2 className="headline text-xl mb-4">개별 분석 결과 ({results.length}개)</h2>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {results.map((result, idx) => (
          <ResultItem key={result.imageId} result={result} index={idx + 1} />
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// Sub Components
// ============================================================================

interface ResultItemProps {
  result: AnalysisResultItem;
  index: number;
}

function ResultItem({ result, index }: ResultItemProps) {
  const categoryLabel =
    CATEGORY_LABELS[result.category as ImageSubCategory] || result.category;

  return (
    <div className="p-4 bg-surface-sunken">
      <div className="text-sm font-semibold text-ink mb-2">
        {index}. {categoryLabel}
      </div>
      <div className="text-xs text-ink-muted mb-2">
        추출된 텍스트: {result.rawText.substring(0, 100)}
        {result.rawText.length > 100 ? '...' : ''}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-ink-muted hover:text-ink">
          분석 내용 보기
        </summary>
        <pre className="mt-2 p-2 bg-paper overflow-x-auto text-xs">{result.analysis}</pre>
      </details>
    </div>
  );
}
