import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useImages, useImageData } from '@/hooks/useImages';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import SynthesisCard from './SynthesisCard';
import { CATEGORY_LABELS } from '@shared/constants/categories';
import type { ImageMetaDTO, CompanyDetailDTO } from '@shared/types/models';
import type { ImageSubCategory } from '@shared/constants/categories';

interface AnalysisReportProps {
  companyId: string;
  synthesis?: CompanyDetailDTO['analysis'];
}

interface AnalysisData {
  summary: string;
  keyPoints: string[];
  metrics?: Array<{ label: string; value: string | number; trend?: 'up' | 'down' | 'stable' }>;
  sentiment?: 'positive' | 'negative' | 'neutral';
  keywords: string[];
}

export default function AnalysisReport({ companyId, synthesis }: AnalysisReportProps) {
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

  return (
    <div className="space-y-8">
      {/* 종합 분석 */}
      {synthesis && <SynthesisCard synthesis={synthesis} />}

      {/* 개별 분석 */}
      <div>
        <h3 className="headline text-xl mb-4">상세 분석 ({analyzedImages.length}개)</h3>
        <div className="space-y-4">
          {analyzedImages.map((image, index) => (
            <AnalysisCardWithData key={image.id} image={image} index={index + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

// 개별 이미지 분석 데이터를 조회하는 컴포넌트
function AnalysisCardWithData({ image, index }: { image: ImageMetaDTO; index: number }) {
  const { data: imageData, isLoading } = useImageData(image.id, { includeAnalysis: true });

  const analysisData = useMemo((): AnalysisData | null => {
    if (!imageData?.analysis) return null;
    try {
      const parsed = JSON.parse(imageData.analysis);
      return {
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
        keywords: parsed.keywords || [],
        sentiment: parsed.sentiment,
        metrics: parsed.metrics,
      };
    } catch {
      return null;
    }
  }, [imageData?.analysis]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 flex items-center justify-center bg-ink text-paper font-bold">
            {index}
          </span>
          <Spinner size="sm" />
          <span className="text-ink-muted">분석 데이터 로딩 중...</span>
        </div>
      </Card>
    );
  }

  return (
    <AnalysisCard
      analysis={{
        imageId: image.id,
        data: analysisData || { summary: '분석 데이터 없음', keyPoints: [], keywords: [] },
        category: image.category,
      }}
      index={index}
    />
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
            {analysis.category && (
              <span className="label">
                {CATEGORY_LABELS[analysis.category as ImageSubCategory] || analysis.category}
              </span>
            )}
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
