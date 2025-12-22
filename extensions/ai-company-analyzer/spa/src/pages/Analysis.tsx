/**
 * AI 분석 페이지
 * 리팩토링: 611줄 -> ~120줄
 */
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import Card from '@/components/ui/Card';
import { useOllama } from '@/contexts/OllamaContext';
import { useImages } from '@/hooks/useImages';
import { useCompany } from '@/hooks/useCompanies';
import { useAnalysisSession } from '@/hooks/useAnalysisSession';
import {
  AnalysisProgress,
  ImageStatusGrid,
  SynthesisCard,
  ResultsPreview,
} from '@/components/analysis';

export default function Analysis() {
  const { companyId } = useParams<{ companyId: string }>();

  // Hooks
  const { isConnected: ollamaConnected, selectedModel } = useOllama();
  const { data: company } = useCompany(companyId);
  const { data: images } = useImages(companyId);

  // 분석 세션 훅
  const {
    isRunning,
    progress,
    results,
    completedImageIds,
    failedImageIds,
    synthesis,
    overallProgress,
    streaming,
    synthesisStreaming,
    startAnalysis,
    stopAnalysis,
  } = useAnalysisSession();

  // 분석 시작 핸들러
  const handleStart = () => {
    if (!companyId || !images || images.length === 0) return;
    startAnalysis(companyId, company?.name || '', images.map((img) => img.id));
  };

  // 시작 가능 여부
  const canStart = ollamaConnected && !!selectedModel && !!images && images.length > 0;

  return (
    <>
      <PageHeader
        title="AI 분석"
        subtitle={company?.name || `ID: ${companyId}`}
        backTo={`/company/${companyId}`}
      />

      <div className="editorial-grid gap-6">
        {/* Ollama 상태 카드 */}
        <div className="col-span-12 lg:col-span-4">
          <OllamaStatusCard
            isConnected={ollamaConnected}
            selectedModel={selectedModel}
          />
        </div>

        {/* 분석 진행 카드 */}
        <div className="col-span-12 lg:col-span-8">
          <AnalysisProgress
            progress={progress}
            overallProgress={overallProgress}
            isRunning={isRunning}
            canStart={canStart}
            streaming={streaming}
            synthesisStreaming={synthesisStreaming}
            onStart={handleStart}
            onStop={stopAnalysis}
          />
        </div>

        {/* 분석 대상 이미지 목록 */}
        {images && images.length > 0 && (
          <div className="col-span-12">
            <ImageStatusGrid
              images={images}
              completedImageIds={completedImageIds}
              failedImageIds={failedImageIds}
            />
          </div>
        )}

        {/* 종합 분석 결과 */}
        {synthesis && (
          <div className="col-span-12">
            <SynthesisCard synthesis={synthesis} />
          </div>
        )}

        {/* 개별 분석 결과 미리보기 */}
        {results.length > 0 && (
          <div className="col-span-12">
            <ResultsPreview results={results} />
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// Sub Components
// ============================================================================

interface OllamaStatusCardProps {
  isConnected: boolean;
  selectedModel: string | null;
}

function OllamaStatusCard({ isConnected, selectedModel }: OllamaStatusCardProps) {
  return (
    <Card className="p-6">
      <h2 className="headline text-xl mb-4">Ollama</h2>
      <div className="space-y-3">
        <div>
          <div className="text-sm text-ink-muted mb-1">연결 상태</div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-signal-positive' : 'bg-signal-negative'
              }`}
            />
            <span className="text-sm">{isConnected ? '연결됨' : '연결 안됨'}</span>
          </div>
        </div>
        <div>
          <div className="text-sm text-ink-muted mb-1">선택된 모델</div>
          <div className="data-figure">{selectedModel || '미선택'}</div>
        </div>
        {!isConnected && (
          <div className="mt-4 p-3 bg-surface-sunken text-sm text-ink-muted">
            설정 페이지에서 Ollama를 연결하세요.
          </div>
        )}
      </div>
    </Card>
  );
}
