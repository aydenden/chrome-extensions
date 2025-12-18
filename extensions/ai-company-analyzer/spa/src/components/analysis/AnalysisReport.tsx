import { useNavigate } from 'react-router-dom';
import { useImages } from '@/hooks/useImages';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';

interface AnalysisReportProps {
  companyId: string;
}

interface AnalysisData {
  summary: string;
  keyPoints: string[];
  metrics?: Array<{ label: string; value: string | number; trend?: 'up' | 'down' | 'stable' }>;
  sentiment?: 'positive' | 'negative' | 'neutral';
  keywords: string[];
}

interface CompanyAnalysisSummary {
  overallSummary: string;
  strengths: string[];
  weaknesses: string[];
  score: number;
}

export default function AnalysisReport({ companyId }: AnalysisReportProps) {
  const navigate = useNavigate();
  const { data: images, isLoading, error } = useImages(companyId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-signal-negative">분석 결과를 불러오는 중 오류가 발생했습니다.</p>
      </div>
    );
  }

  const analyzedImages = images?.filter((img) => img.hasAnalysis) || [];

  if (!analyzedImages.length) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-muted mb-6">아직 분석된 결과가 없습니다.</p>
        <Button onClick={() => navigate(`/analysis/${companyId}`)}>AI 분석 시작</Button>
      </div>
    );
  }

  // 분석 데이터 수집
  const analyses: Array<{ imageId: string; data: AnalysisData; category?: string }> = [];
  for (const img of analyzedImages) {
    // analysis는 ImageDataDTO를 통해 가져와야 하지만, 지금은 hasAnalysis만 체크
    // 실제 분석 데이터는 Feature 32 구현 후 사용 가능
    analyses.push({
      imageId: img.id,
      data: {
        summary: '분석 결과 요약',
        keyPoints: [],
        keywords: [],
      },
      category: img.category,
    });
  }

  // 종합 요약 생성 (실제로는 Extension에서 계산된 값 사용)
  const summary: CompanyAnalysisSummary | null = analyses.length > 0 ? {
    overallSummary: `총 ${analyses.length}개의 이미지가 분석되었습니다.`,
    strengths: [],
    weaknesses: [],
    score: 0,
  } : null;

  return (
    <div className="space-y-8">
      {summary && <SummaryCard summary={summary} />}
      <KeywordCloud analyses={analyses} />
      <div>
        <h3 className="headline text-xl mb-4">상세 분석 ({analyses.length}개)</h3>
        <div className="space-y-4">
          {analyses.map((analysis, index) => (
            <AnalysisCard key={analysis.imageId} analysis={analysis} index={index + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ summary }: { summary: CompanyAnalysisSummary }) {
  return (
    <Card className="p-6 border-2 border-ink">
      <h3 className="headline text-xl mb-4">종합 분석</h3>

      <div className="flex items-center gap-6 mb-6">
        <div className="text-center">
          <span className="data-figure text-5xl">{summary.score.toFixed(1)}</span>
          <span className="block text-ink-muted text-sm">/10</span>
        </div>
        <p className="flex-1 text-ink-soft">{summary.overallSummary}</p>
      </div>

      {(summary.strengths.length > 0 || summary.weaknesses.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {summary.strengths.length > 0 && (
            <div>
              <h4 className="label text-signal-positive mb-2">강점</h4>
              <ul className="space-y-1">
                {summary.strengths.map((s, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-signal-positive">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary.weaknesses.length > 0 && (
            <div>
              <h4 className="label text-signal-negative mb-2">약점</h4>
              <ul className="space-y-1">
                {summary.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-signal-negative">-</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function KeywordCloud({
  analyses,
}: {
  analyses: Array<{ imageId: string; data: AnalysisData; category?: string }>;
}) {
  const keywordFreq = new Map<string, number>();
  for (const analysis of analyses) {
    for (const keyword of analysis.data.keywords) {
      keywordFreq.set(keyword, (keywordFreq.get(keyword) || 0) + 1);
    }
  }

  const topKeywords = Array.from(keywordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (topKeywords.length === 0) {
    return null;
  }

  const maxFreq = Math.max(...topKeywords.map((k) => k[1]));

  return (
    <Card className="p-6">
      <h3 className="headline text-xl mb-4">핵심 키워드</h3>
      <div className="flex flex-wrap gap-3">
        {topKeywords.map(([keyword, freq]) => {
          const size = 0.8 + (freq / maxFreq) * 0.8;
          return (
            <span
              key={keyword}
              className="px-3 py-1 bg-surface-sunken hover:bg-ink hover:text-paper transition-colors cursor-default"
              style={{ fontSize: `${size}rem` }}
            >
              {keyword}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

function AnalysisCard({
  analysis,
  index,
}: {
  analysis: { imageId: string; data: AnalysisData; category?: string };
  index: number;
}) {
  const sentimentColors = {
    positive: 'text-signal-positive',
    negative: 'text-signal-negative',
    neutral: 'text-ink-muted',
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 flex items-center justify-center bg-ink text-paper font-bold">
            {index}
          </span>
          <div>
            {analysis.category && <span className="label">{analysis.category}</span>}
          </div>
        </div>
        {analysis.data.sentiment && (
          <span
            className={`text-sm ${sentimentColors[analysis.data.sentiment]}`}
          >
            {analysis.data.sentiment === 'positive'
              ? '긍정적'
              : analysis.data.sentiment === 'negative'
                ? '부정적'
                : '중립적'}
          </span>
        )}
      </div>

      <p className="text-ink mb-4">{analysis.data.summary}</p>

      {analysis.data.keyPoints.length > 0 && (
        <div className="mb-4">
          <h4 className="label mb-2">핵심 포인트</h4>
          <ul className="space-y-1">
            {analysis.data.keyPoints.map((point, i) => (
              <li key={i} className="text-sm text-ink-soft flex items-start gap-2">
                <span className="text-ink">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.data.metrics && analysis.data.metrics.length > 0 && (
        <div className="flex flex-wrap gap-4 pt-4 border-t border-border-subtle">
          {analysis.data.metrics.map((metric, i) => (
            <div key={i} className="text-center">
              <span className="label block mb-1">{metric.label}</span>
              <span className="data-figure text-lg">{metric.value}</span>
              {metric.trend && (
                <span
                  className={`ml-1 text-xs ${
                    metric.trend === 'up'
                      ? 'text-signal-positive'
                      : metric.trend === 'down'
                        ? 'text-signal-negative'
                        : ''
                  }`}
                >
                  {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
