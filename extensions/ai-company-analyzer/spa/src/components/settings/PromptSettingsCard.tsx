import { useState, useCallback, useEffect } from 'react';
import { Card, Button, Spinner } from '@/components/ui';
import { PromptEditor } from './PromptEditor';
import { usePromptSettings, useSavePromptSettings, useResetPromptSettings } from '@/hooks';
import {
  DEFAULT_IMAGE_ANALYSIS_PROMPT,
  DEFAULT_SYNTHESIS_PROMPT,
  IMAGE_ANALYSIS_VARIABLES,
  SYNTHESIS_VARIABLES,
} from '@/lib/prompts';
import { cn } from '@/lib/utils';

export function PromptSettingsCard() {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: settings, isLoading } = usePromptSettings();
  const { mutate: saveSettings, isPending: isSaving } = useSavePromptSettings();
  const { mutate: resetSettings, isPending: isResetting } = useResetPromptSettings();

  // 로컬 편집 상태
  const [imagePrompt, setImagePrompt] = useState('');
  const [synthesisPrompt, setSynthesisPrompt] = useState('');

  // 설정 로드 시 로컬 상태 동기화
  useEffect(() => {
    if (settings) {
      setImagePrompt(settings.imageAnalysis.prompt);
      setSynthesisPrompt(settings.synthesis.prompt);
    }
  }, [settings]);

  // 수정 여부 체크
  const isImageModified = settings?.imageAnalysis.prompt !== imagePrompt;
  const isSynthesisModified = settings?.synthesis.prompt !== synthesisPrompt;
  const hasChanges = isImageModified || isSynthesisModified;

  // 저장
  const handleSave = useCallback(() => {
    const params: { imageAnalysis?: { prompt: string }; synthesis?: { prompt: string } } = {};

    if (isImageModified) {
      params.imageAnalysis = { prompt: imagePrompt };
    }
    if (isSynthesisModified) {
      params.synthesis = { prompt: synthesisPrompt };
    }

    if (Object.keys(params).length > 0) {
      saveSettings(params);
    }
  }, [imagePrompt, synthesisPrompt, isImageModified, isSynthesisModified, saveSettings]);

  // 개별 리셋
  const handleResetImage = useCallback(() => {
    setImagePrompt(DEFAULT_IMAGE_ANALYSIS_PROMPT);
  }, []);

  const handleResetSynthesis = useCallback(() => {
    setSynthesisPrompt(DEFAULT_SYNTHESIS_PROMPT);
  }, []);

  // 전체 리셋 (저장소에서)
  const handleResetAll = useCallback(() => {
    resetSettings('all');
  }, [resetSettings]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* 헤더 - 접기/펼치기 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between p-6',
          'hover:bg-surface-sunken transition-colors',
          'text-left'
        )}
      >
        <div>
          <h2 className="headline text-xl">AI 프롬프트</h2>
          <p className="text-sm text-ink-muted mt-1">
            개별 이미지 분석 및 종합 분석 프롬프트 설정
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-xs px-2 py-1 bg-signal-neutral/10 text-signal-neutral">
              저장되지 않은 변경
            </span>
          )}
          <span
            className={cn(
              'text-2xl transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          >
            ▾
          </span>
        </div>
      </button>

      {/* 콘텐츠 */}
      <div
        className={cn(
          'transition-all duration-300 ease-out',
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        )}
      >
        <div className="px-6 pb-6 space-y-6">
          {/* 개별 이미지 분석 */}
          <PromptEditor
            title="개별 이미지 분석"
            value={imagePrompt}
            onChange={setImagePrompt}
            onReset={handleResetImage}
            variables={IMAGE_ANALYSIS_VARIABLES}
            isModified={isImageModified}
          />

          {/* 종합 분석 */}
          <PromptEditor
            title="종합 분석"
            value={synthesisPrompt}
            onChange={setSynthesisPrompt}
            onReset={handleResetSynthesis}
            variables={SYNTHESIS_VARIABLES}
            isModified={isSynthesisModified}
          />

          {/* 액션 버튼 */}
          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetAll}
              disabled={isResetting}
            >
              {isResetting ? <Spinner size="sm" /> : '모두 기본값으로'}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? <Spinner size="sm" /> : '변경사항 저장'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
