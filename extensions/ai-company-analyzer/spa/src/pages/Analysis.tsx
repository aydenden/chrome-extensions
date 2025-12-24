/**
 * AI 분석 페이지
 * 이미지 분석 및 종합 분석 수행
 */
import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import Card from '@/components/ui/Card';
import { useOllama } from '@/contexts/OllamaContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useImages, useUpdateImageMemo } from '@/hooks/useImages';
import { useCompany, useUpdateCompanyContext } from '@/hooks/useCompanies';
import { usePromptSettings } from '@/hooks/usePromptSettings';
import {
  AnalysisProgress,
  AnalysisContextCard,
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
  const { data: promptSettings } = usePromptSettings();
  const updateContext = useUpdateCompanyContext();
  const updateMemo = useUpdateImageMemo(companyId || '');

  // 로컬 상태
  const [includePrevious, setIncludePrevious] = useState(false);
  const [analysisContext, setAnalysisContext] = useState(company?.analysisContext || '');

  // 회사 데이터가 로드되면 컨텍스트 동기화
  useMemo(() => {
    if (company?.analysisContext !== undefined) {
      setAnalysisContext(company.analysisContext || '');
    }
  }, [company?.analysisContext]);

  // 분석 Context (Port 기반 통신)
  const {
    status,
    results: analysisResults,
    synthesis,
    overallProgress,
    streaming,
    synthesisStreaming,
    startAnalysis: startAnalysisPort,
    abortAnalysis,
  } = useAnalysis();

  // 현재 회사에 대한 분석 세션인지 확인
  const isCurrentCompanySession = status.companyId === companyId;
  const isDifferentCompanyRunning = status.step !== 'idle' && status.step !== 'done' && status.step !== 'error'
    && status.companyId && status.companyId !== companyId;

  // 상태 변환 (호환성) - 현재 회사 세션만 표시
  const isRunning = isCurrentCompanySession
    && status.step !== 'idle' && status.step !== 'done' && status.step !== 'error';
  const completedImageIds = useMemo(
    () => new Set(isCurrentCompanySession ? status.completedImageIds : []),
    [status.completedImageIds, isCurrentCompanySession]
  );
  const failedImageIds = useMemo(
    () => new Set(isCurrentCompanySession ? status.failedImageIds : []),
    [status.failedImageIds, isCurrentCompanySession]
  );

  // 결과 변환 (ImageCompletePayload → AnalysisResultItem 호환) - 현재 회사만
  const results = useMemo(() => {
    if (!isCurrentCompanySession) return [];
    return analysisResults.map((r) => ({
      imageId: r.imageId,
      category: r.category,
      rawText: r.rawText,
      analysis: r.analysis,
    }));
  }, [analysisResults, isCurrentCompanySession]);

  // 현재 회사 세션의 synthesis만 표시
  const currentSynthesis = isCurrentCompanySession ? synthesis : null;

  // progress 변환 (AnalysisStatus → StepProgress 호환)
  const progress = useMemo(() => ({
    step: status.step,
    current: status.current,
    total: status.total,
    message: status.message,
  }), [status]);

  // 이미지 분류: 이전 분석 완료 vs 신규 분석 대상
  const { previouslyAnalyzed, toBeAnalyzed } = useMemo(() => {
    if (!images || !selectedModel) {
      return { previouslyAnalyzed: [], toBeAnalyzed: images || [] };
    }

    const previouslyAnalyzed = images.filter(
      (img) => img.hasAnalysis && img.analyzedModel === selectedModel
    );
    const toBeAnalyzed = images.filter(
      (img) => !img.hasAnalysis || img.analyzedModel !== selectedModel
    );

    return { previouslyAnalyzed, toBeAnalyzed };
  }, [images, selectedModel]);

  // 실제 분석 대상
  const targetImages = useMemo(() => {
    if (includePrevious) {
      return images || [];
    }
    return toBeAnalyzed;
  }, [includePrevious, images, toBeAnalyzed]);

  // 분석 시작 핸들러
  const handleStart = useCallback(() => {
    if (!companyId || !targetImages || targetImages.length === 0) return;
    startAnalysisPort({
      companyId,
      companyName: company?.name || '',
      imageIds: targetImages.map((img) => img.id),
      analysisContext: analysisContext || undefined,
      promptSettings: promptSettings ? {
        imageAnalysis: promptSettings.imageAnalysis.prompt,
        synthesis: promptSettings.synthesis.prompt,
      } : undefined,
    });
  }, [companyId, company?.name, targetImages, startAnalysisPort, analysisContext, promptSettings]);

  // 컨텍스트 저장 핸들러
  const handleSaveContext = useCallback(() => {
    if (!companyId) return;
    updateContext.mutate({ companyId, analysisContext });
  }, [companyId, analysisContext, updateContext]);

  // 이미지 메모 업데이트 핸들러
  const handleUpdateMemo = useCallback((imageId: string, memo: string) => {
    updateMemo.mutate({ imageId, memo });
  }, [updateMemo]);

  // 시작 가능 여부 (다른 회사 분석 중이면 시작 불가)
  const canStart = ollamaConnected && !!selectedModel && targetImages.length > 0 && !isDifferentCompanyRunning;

  // 현재 분석 중인 이미지 ID (현재 회사 세션만)
  const currentAnalyzingId = isCurrentCompanySession ? streaming.currentImageId : null;

  // 현재 회사 세션의 스트리밍 상태만 표시
  const currentStreaming = isCurrentCompanySession ? streaming : { currentImageId: null, phase: 'idle' as const, thinkingText: '', contentText: '' };
  const currentSynthesisStreaming = isCurrentCompanySession ? synthesisStreaming : { phase: 'idle' as const, thinkingText: '', contentText: '' };

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

        {/* 분석 컨텍스트 카드 */}
        <div className="col-span-12 lg:col-span-8">
          <AnalysisContextCard
            context={analysisContext}
            onChange={setAnalysisContext}
            onSave={handleSaveContext}
            isSaving={updateContext.isPending}
          />
        </div>

        {/* 다른 회사 분석 중 경고 */}
        {isDifferentCompanyRunning && (
          <div className="col-span-12">
            <div className="p-4 bg-highlight-yellow/20 border border-highlight-yellow">
              <p className="text-sm font-semibold">
                다른 회사({status.companyName})의 분석이 진행 중입니다.
              </p>
              <p className="text-sm text-ink-muted mt-1">
                현재 분석이 완료된 후 이 회사의 분석을 시작할 수 있습니다.
              </p>
            </div>
          </div>
        )}

        {/* 분석 진행 카드 */}
        <div className="col-span-12">
          <AnalysisProgress
            progress={progress}
            overallProgress={isCurrentCompanySession ? overallProgress : 0}
            isRunning={isRunning}
            canStart={canStart}
            streaming={currentStreaming}
            synthesisStreaming={currentSynthesisStreaming}
            onStart={handleStart}
            onStop={abortAnalysis}
          />
        </div>

        {/* 분석 대상 이미지 목록 */}
        {images && images.length > 0 && (
          <div className="col-span-12">
            <ImageStatusGrid
              toBeAnalyzed={toBeAnalyzed}
              previouslyAnalyzed={previouslyAnalyzed}
              includePrevious={includePrevious}
              onToggleIncludePrevious={setIncludePrevious}
              completedImageIds={completedImageIds}
              failedImageIds={failedImageIds}
              currentAnalyzingId={currentAnalyzingId}
              isAnalyzing={isRunning}
              onUpdateMemo={handleUpdateMemo}
            />
          </div>
        )}

        {/* 종합 분석 결과 */}
        {currentSynthesis && (
          <div className="col-span-12">
            <SynthesisCard synthesis={currentSynthesis} />
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
