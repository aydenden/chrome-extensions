/**
 * 분석 진행률 표시 컴포넌트
 */
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import Spinner from '@/components/ui/Spinner';
import type { StepProgress, AnalysisStep } from '@/lib/analysis';

// ============================================================================
// Props
// ============================================================================

/** 스트리밍 상태 타입 (이미지 분석용) */
interface StreamingState {
  currentImageId: string | null;
  phase: 'idle' | 'thinking' | 'content';
  thinkingText: string;
  contentText: string;
}

/** 종합 분석 스트리밍 상태 타입 */
interface SynthesisStreamingState {
  phase: 'idle' | 'thinking' | 'content';
  thinkingText: string;
  contentText: string;
}

interface AnalysisProgressProps {
  progress: StepProgress;
  overallProgress: number;
  isRunning: boolean;
  canStart: boolean;
  streaming?: StreamingState;
  synthesisStreaming?: SynthesisStreamingState;
  onStart: () => void;
  onStop: () => void;
}

// ============================================================================
// Component
// ============================================================================

export default function AnalysisProgress({
  progress,
  overallProgress,
  isRunning,
  canStart,
  streaming,
  synthesisStreaming,
  onStart,
  onStop,
}: AnalysisProgressProps) {
  return (
    <Card className="p-6">
      <h2 className="headline text-xl mb-4">분석 진행</h2>

      {/* 전체 진행률 */}
      <div className="mb-6">
        <div className="text-sm text-ink-muted mb-2">전체 진행률</div>
        <ProgressBar value={overallProgress} />
      </div>

      {/* 단계 표시 */}
      <div className="space-y-3 mb-6">
        <StepIndicator
          label="1. 이미지 로딩"
          isActive={progress.step === 'loading-images'}
          isDone={isStepDone('loading-images', progress.step)}
          isError={progress.step === 'error' && progress.message.includes('로드')}
        />
        <StepIndicator
          label="2. AI 분석 (개별)"
          isActive={progress.step === 'analyzing'}
          isDone={isStepDone('analyzing', progress.step)}
          isError={progress.step === 'error' && progress.message.includes('분석')}
        />
        <StepIndicator
          label="3. 종합 분석"
          isActive={progress.step === 'synthesizing'}
          isDone={isStepDone('synthesizing', progress.step)}
          isError={progress.step === 'error' && progress.message.includes('종합')}
        />
        <StepIndicator
          label="4. 결과 저장"
          isActive={progress.step === 'saving'}
          isDone={progress.step === 'done'}
          isError={progress.step === 'error' && progress.message.includes('저장')}
        />
      </div>

      {/* 상태 메시지 */}
      <div className="bg-surface-sunken p-4 mb-4">
        <div className="flex items-center gap-2">
          {isRunning && <Spinner size="sm" />}
          <span className="text-sm text-ink-muted">{progress.message}</span>
        </div>
      </div>

      {/* 이미지 분석 스트리밍 상태 표시 */}
      {streaming && streaming.phase !== 'idle' && (
        <div className="mb-4 space-y-3">
          {/* Thinking 표시 */}
          {streaming.thinkingText && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-sm font-medium text-amber-700">Thinking...</span>
              </div>
              <div className="text-sm text-amber-800 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                {streaming.thinkingText}
              </div>
            </div>
          )}

          {/* Content 표시 */}
          {streaming.phase === 'content' && streaming.contentText && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-700">응답 생성 중...</span>
              </div>
              <div className="text-sm text-green-800 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                {streaming.contentText}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 종합 분석 스트리밍 상태 표시 */}
      {progress.step === 'synthesizing' && synthesisStreaming && synthesisStreaming.phase !== 'idle' && (
        <div className="mb-4 space-y-3">
          {/* Thinking 표시 */}
          {synthesisStreaming.thinkingText && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-sm font-medium text-blue-700">종합 분석 중...</span>
              </div>
              <div className="text-sm text-blue-800 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                {synthesisStreaming.thinkingText}
              </div>
            </div>
          )}

          {/* Content 표시 */}
          {synthesisStreaming.phase === 'content' && synthesisStreaming.contentText && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-sm font-medium text-indigo-700">결과 생성 중...</span>
              </div>
              <div className="text-sm text-indigo-800 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                {synthesisStreaming.contentText}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 시작/중단 버튼 */}
      <div className="flex gap-3">
        {!isRunning ? (
          <Button onClick={onStart} disabled={!canStart} className="flex-1">
            분석 시작
          </Button>
        ) : (
          <Button onClick={onStop} variant="danger" className="flex-1">
            중단
          </Button>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/** 단계 완료 여부 확인 */
function isStepDone(targetStep: AnalysisStep, currentStep: AnalysisStep): boolean {
  const stepOrder: AnalysisStep[] = [
    'idle',
    'loading-images',
    'analyzing',
    'synthesizing',
    'saving',
    'done',
  ];

  const targetIndex = stepOrder.indexOf(targetStep);
  const currentIndex = stepOrder.indexOf(currentStep);

  return currentIndex > targetIndex;
}

// ============================================================================
// Sub Components
// ============================================================================

interface StepIndicatorProps {
  label: string;
  isActive: boolean;
  isDone: boolean;
  isError: boolean;
}

function StepIndicator({ label, isActive, isDone, isError }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
          isError
            ? 'bg-signal-negative text-white'
            : isDone
              ? 'bg-signal-positive text-white'
              : isActive
                ? 'bg-ink text-paper'
                : 'bg-surface-sunken text-ink-muted'
        }`}
      >
        {isError ? '!' : isDone ? '✓' : isActive ? '...' : ''}
      </div>
      <span className={`text-sm ${isActive ? 'text-ink font-semibold' : 'text-ink-muted'}`}>
        {label}
      </span>
    </div>
  );
}
