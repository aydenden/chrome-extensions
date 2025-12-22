/**
 * 종합 분석 결과 카드 컴포넌트
 * CompanyDetail.tsx에서도 재사용 가능
 */
import Card from '@/components/ui/Card';
import type { SynthesisResult } from '@/lib/analysis';
import type { CompanyDetailDTO } from '@shared/types';

// ============================================================================
// Props
// ============================================================================

type SynthesisData = SynthesisResult | NonNullable<CompanyDetailDTO['analysis']>;

interface SynthesisCardProps {
  synthesis: SynthesisData;
  /** 제목 표시 여부 */
  showTitle?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export default function SynthesisCard({ synthesis, showTitle = true }: SynthesisCardProps) {
  return (
    <Card className="p-6">
      {showTitle && <h2 className="headline text-xl mb-4">AI 종합 분석</h2>}

      {/* 점수 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-4xl font-bold">{synthesis.score}</div>
        <div className="text-sm text-ink-muted">/ 100</div>
      </div>

      {/* 요약 */}
      <p className="text-ink mb-4">{synthesis.summary}</p>

      {/* 강점/약점 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-signal-positive mb-2">강점</h3>
          <ul className="text-sm space-y-1">
            {synthesis.strengths?.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-signal-negative mb-2">약점</h3>
          <ul className="text-sm space-y-1">
            {synthesis.weaknesses?.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 추천 */}
      <div className="p-3 bg-surface-sunken">
        <span
          className={`font-semibold ${
            synthesis.recommendation === 'recommend'
              ? 'text-signal-positive'
              : synthesis.recommendation === 'not_recommend'
                ? 'text-signal-negative'
                : 'text-ink-muted'
          }`}
        >
          {synthesis.recommendation === 'recommend'
            ? '추천'
            : synthesis.recommendation === 'not_recommend'
              ? '비추천'
              : '중립'}
        </span>
        <span className="text-sm text-ink-muted ml-2">{synthesis.reasoning}</span>
      </div>
    </Card>
  );
}
