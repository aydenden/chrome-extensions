# Feature 33: AI 분석 리포트 표시

## 개요

회사 상세 페이지의 "분석" 탭에서 AI 분석 결과 리포트를 표시합니다.

## 범위

- AnalysisReport 컴포넌트
- 이미지별 분석 결과
- 종합 요약 카드
- 키워드 클라우드
- 지표 시각화

## 의존성

- Feature 32: 분석 진행 페이지

## 구현 상세

### spa/src/components/analysis/AnalysisReport.tsx

```tsx
import { useQuery } from '@tanstack/react-query';
import { getExtensionClient } from '@/lib/extension-client';
import { queryKeys } from '@/lib/query/keys';
import { Button, Card, Spinner } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useNavigate } from 'react-router-dom';

interface AnalysisReportProps {
  companyId: string;
}

interface AnalysisData {
  imageId: string;
  ocrText: string;
  category: string;
  subCategory: string;
  confidence: number;
  analysis: {
    summary: string;
    keyPoints: string[];
    metrics?: Array<{ label: string; value: string | number; trend?: string }>;
    sentiment?: string;
    keywords: string[];
  };
  createdAt: string;
}

interface CompanyAnalysis {
  hasAnalysis: boolean;
  analyses: AnalysisData[];
  summary?: {
    overallSummary: string;
    strengths: string[];
    weaknesses: string[];
    score: number;
    topKeywords: string[];
  };
}

export default function AnalysisReport({ companyId }: AnalysisReportProps) {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<CompanyAnalysis>({
    queryKey: queryKeys.company(companyId),
    queryFn: async () => {
      const client = getExtensionClient();
      const company = await client.send('GET_COMPANY', { companyId });
      return company.analysisData;
    },
  });

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

  if (!data?.hasAnalysis || !data.analyses.length) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-muted mb-6">아직 분석된 결과가 없습니다.</p>
        <Button onClick={() => navigate(ROUTES.ANALYSIS(companyId))}>
          AI 분석 시작
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 종합 요약 */}
      {data.summary && (
        <SummaryCard summary={data.summary} />
      )}

      {/* 키워드 클라우드 */}
      <KeywordCloud analyses={data.analyses} />

      {/* 개별 분석 결과 */}
      <div>
        <h3 className="headline text-xl mb-4">상세 분석 ({data.analyses.length}개)</h3>
        <div className="space-y-4">
          {data.analyses.map((analysis, index) => (
            <AnalysisCard key={analysis.imageId} analysis={analysis} index={index + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 종합 요약 카드 */
function SummaryCard({ summary }: { summary: NonNullable<CompanyAnalysis['summary']> }) {
  return (
    <Card className="p-6 border-2 border-ink">
      <h3 className="headline text-xl mb-4">종합 분석</h3>

      {/* 점수 */}
      <div className="flex items-center gap-6 mb-6">
        <div className="text-center">
          <span className="data-figure text-5xl">{summary.score.toFixed(1)}</span>
          <span className="block text-ink-muted text-sm">/10</span>
        </div>
        <p className="flex-1 text-ink-soft">{summary.overallSummary}</p>
      </div>

      {/* 강점/약점 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>
    </Card>
  );
}

/** 키워드 클라우드 */
function KeywordCloud({ analyses }: { analyses: AnalysisData[] }) {
  // 모든 키워드 수집 및 빈도 계산
  const keywordFreq = new Map<string, number>();
  for (const analysis of analyses) {
    for (const keyword of analysis.analysis.keywords) {
      keywordFreq.set(keyword, (keywordFreq.get(keyword) || 0) + 1);
    }
  }

  // 상위 20개
  const topKeywords = Array.from(keywordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  const maxFreq = Math.max(...topKeywords.map(k => k[1]));

  return (
    <Card className="p-6">
      <h3 className="headline text-xl mb-4">핵심 키워드</h3>
      <div className="flex flex-wrap gap-3">
        {topKeywords.map(([keyword, freq]) => {
          const size = 0.8 + (freq / maxFreq) * 0.8; // 0.8 ~ 1.6
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

/** 개별 분석 카드 */
function AnalysisCard({ analysis, index }: { analysis: AnalysisData; index: number }) {
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
            <span className="label">{analysis.subCategory}</span>
            <span className="text-xs text-ink-muted ml-2">
              신뢰도: {Math.round(analysis.confidence * 100)}%
            </span>
          </div>
        </div>
        {analysis.analysis.sentiment && (
          <span className={`text-sm ${sentimentColors[analysis.analysis.sentiment as keyof typeof sentimentColors]}`}>
            {analysis.analysis.sentiment === 'positive' ? '긍정적' :
             analysis.analysis.sentiment === 'negative' ? '부정적' : '중립적'}
          </span>
        )}
      </div>

      {/* 요약 */}
      <p className="text-ink mb-4">{analysis.analysis.summary}</p>

      {/* 핵심 포인트 */}
      {analysis.analysis.keyPoints.length > 0 && (
        <div className="mb-4">
          <h4 className="label mb-2">핵심 포인트</h4>
          <ul className="space-y-1">
            {analysis.analysis.keyPoints.map((point, i) => (
              <li key={i} className="text-sm text-ink-soft flex items-start gap-2">
                <span className="text-ink">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 지표 */}
      {analysis.analysis.metrics && analysis.analysis.metrics.length > 0 && (
        <div className="flex flex-wrap gap-4 pt-4 border-t border-border-subtle">
          {analysis.analysis.metrics.map((metric, i) => (
            <div key={i} className="text-center">
              <span className="label block mb-1">{metric.label}</span>
              <span className="data-figure text-lg">{metric.value}</span>
              {metric.trend && (
                <span className={`ml-1 text-xs ${
                  metric.trend === 'up' ? 'text-signal-positive' :
                  metric.trend === 'down' ? 'text-signal-negative' : ''
                }`}>
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
```

### spa/src/components/analysis/index.ts

```typescript
export { default as AnalysisReport } from './AnalysisReport';
```

## 완료 기준

- [ ] AnalysisReport 컴포넌트
- [ ] SummaryCard: 종합 점수, 요약, 강점/약점
- [ ] KeywordCloud: 빈도 기반 크기 조절
- [ ] AnalysisCard: 개별 분석 결과
- [ ] 지표 시각화 (trend 표시)
- [ ] 센티먼트 표시 (긍정/부정/중립)
- [ ] 분석 없음 상태 → 분석 시작 버튼

## 참조 문서

- spec/06-page-layouts.md Section 3.4 (분석 결과 탭)
