/**
 * AI 분석 Orchestrator
 * 전체 분석 플로우를 조율: 이미지 로드 -> 개별 분석 -> 종합 분석 -> 저장
 */
import { getExtensionClient } from '@/lib/extension-client';
import type { ChatMessage, ChatOptions, StreamChunk, StreamOptions, StreamResult } from '@/lib/ai/types';
import { loadAndOptimizeImages } from './image-loader';
import {
  analyzeImages,
  analyzeImagesWithStream,
  type AnalyzeImageFn,
  type AnalyzeImageStreamFn,
} from './image-analyzer';
import { generateSynthesisWithStream, type SynthesisResult } from './synthesis';
import type {
  StepProgress,
  AnalysisOptions,
  AnalysisResultItem,
  OrchestratorResult,
} from './types';

// ============================================================================
// Orchestrator 의존성
// ============================================================================

/** 스트리밍 채팅 함수 타입 */
type ChatStreamFunction = (
  messages: ChatMessage[],
  options?: StreamOptions
) => AsyncGenerator<StreamChunk, StreamResult, unknown>;

/** Orchestrator가 필요로 하는 외부 의존성 */
export interface OrchestratorDeps {
  /** Ollama 이미지 분석 함수 (비스트리밍) */
  analyzeImage: AnalyzeImageFn;
  /** Ollama 이미지 분석 함수 (스트리밍) */
  analyzeImageStream: AnalyzeImageStreamFn;
  /** Ollama 채팅 함수 (종합 분석용, 비스트리밍 - 폴백용) */
  chat: (messages: ChatMessage[], options?: ChatOptions) => Promise<string>;
  /** Ollama 채팅 함수 (종합 분석용, 스트리밍) */
  chatStream: ChatStreamFunction;
  /** 선택된 모델명 */
  selectedModel: string;
  /** Ollama 엔드포인트 */
  endpoint: string;
}

// ============================================================================
// Orchestrator
// ============================================================================

/**
 * AI 분석 Orchestrator
 * 전체 분석 플로우를 조율하는 클래스
 */
export class AnalysisOrchestrator {
  private deps: OrchestratorDeps;
  private client = getExtensionClient();

  constructor(deps: OrchestratorDeps) {
    this.deps = deps;
  }

  /**
   * 분석 실행
   * @param companyId 회사 ID
   * @param companyName 회사명
   * @param imageIds 분석할 이미지 ID 배열
   * @param options 분석 옵션
   */
  async run(
    companyId: string,
    companyName: string,
    imageIds: string[],
    options: AnalysisOptions = {}
  ): Promise<OrchestratorResult> {
    const { onProgress, onImageComplete, onStreamChunk, abortSignal, useStreaming = true } = options;
    let results: AnalysisResultItem[] = [];
    let completedIds: string[] = [];
    let failedIds: string[] = [];

    // ========================================================================
    // Step 1: 이미지 로드 및 최적화
    // ========================================================================
    this.emitProgress(onProgress, {
      step: 'loading-images',
      current: 0,
      total: imageIds.length,
      message: '이미지 데이터 로드 중...',
    });

    const loadedImages = await loadAndOptimizeImages(imageIds, {
      abortSignal,
      onProgress: (current, total) => {
        this.emitProgress(onProgress, {
          step: 'loading-images',
          current,
          total,
          message: `이미지 ${current}/${total} 최적화 중...`,
        });
      },
    });

    // ========================================================================
    // Step 2: 개별 이미지 AI 분석
    // ========================================================================
    this.emitProgress(onProgress, {
      step: 'analyzing',
      current: 0,
      total: loadedImages.length,
      message: 'AI 분석 시작...',
    });

    let analysisResult: {
      results: AnalysisResultItem[];
      completedIds: string[];
      failedIds: string[];
    };

    if (useStreaming) {
      // 스트리밍 분석
      analysisResult = await analyzeImagesWithStream(
        loadedImages,
        companyName,
        this.deps.analyzeImageStream,
        {
          abortSignal,
          onProgress: (current, total) => {
            this.emitProgress(onProgress, {
              step: 'analyzing',
              current,
              total,
              message: `AI 분석 ${current}/${total}`,
            });
          },
          onImageComplete,
          onStreamChunk,
        }
      );
    } else {
      // 비스트리밍 분석 (폴백)
      analysisResult = await analyzeImages(
        loadedImages,
        companyName,
        this.deps.analyzeImage,
        {
          abortSignal,
          onProgress: (current, total) => {
            this.emitProgress(onProgress, {
              step: 'analyzing',
              current,
              total,
              message: `AI 분석 ${current}/${total}`,
            });
          },
          onImageComplete,
        }
      );
    }

    results = analysisResult.results;
    completedIds = analysisResult.completedIds;
    failedIds = analysisResult.failedIds;

    // 중단 시 현재까지 결과 저장 후 반환
    if (abortSignal?.aborted) {
      const saveResult = await this.saveResults(results);
      return {
        results,
        synthesis: null,
        savedCount: saveResult.savedCount,
        failedCount: saveResult.failedCount,
      };
    }

    // ========================================================================
    // Step 3: 종합 분석 생성 (스트리밍)
    // ========================================================================
    let synthesis: SynthesisResult | null = null;
    const { onSynthesisStreamChunk } = options;

    if (completedIds.length > 0) {
      this.emitProgress(onProgress, {
        step: 'synthesizing',
        current: 0,
        total: 1,
        message: '종합 분석 생성 중...',
      });

      synthesis = await generateSynthesisWithStream(
        companyName,
        results,
        this.deps.chatStream,
        {
          onThinking: (text, accumulated) => {
            onSynthesisStreamChunk?.({
              type: 'thinking',
              text,
              accumulated: { thinking: accumulated, content: '' },
            });
          },
          onContent: (text, accumulated) => {
            onSynthesisStreamChunk?.({
              type: 'content',
              text,
              accumulated: { thinking: '', content: accumulated },
            });
          },
        }
      );

      // 종합 분석 결과 저장
      if (synthesis) {
        console.log('[Orchestrator] Saving synthesis:', { companyId, synthesis });
        try {
          const saveResponse = await this.client.send('UPDATE_COMPANY_ANALYSIS', {
            companyId,
            analysis: synthesis,
          });
          console.log('[Orchestrator] Synthesis saved:', saveResponse);
        } catch (error) {
          console.error('[Orchestrator] Synthesis save FAILED:', error);
        }
      }
    }

    // ========================================================================
    // Step 4: 개별 결과 저장
    // ========================================================================
    this.emitProgress(onProgress, {
      step: 'saving',
      current: 0,
      total: 1,
      message: '분석 결과 저장 중...',
    });

    const saveResult = await this.saveResults(results);

    // 완료
    this.emitProgress(onProgress, {
      step: 'done',
      current: results.length,
      total: results.length,
      message: `분석 완료! (${saveResult.savedCount}개 저장, ${failedIds.length}개 실패)`,
    });

    return {
      results,
      synthesis,
      savedCount: saveResult.savedCount,
      failedCount: saveResult.failedCount,
    };
  }

  /**
   * 진행 상태 전달
   */
  private emitProgress(
    callback: ((progress: StepProgress) => void) | undefined,
    progress: StepProgress
  ): void {
    callback?.(progress);
  }

  /**
   * 분석 결과 저장
   */
  private async saveResults(
    results: AnalysisResultItem[]
  ): Promise<{ savedCount: number; failedCount: number }> {
    if (results.length === 0) {
      return { savedCount: 0, failedCount: 0 };
    }

    const savePayload = results.map((r) => ({
      imageId: r.imageId,
      category: r.category,
      rawText: r.rawText,
      analysis: r.analysis,
    }));

    console.log('[Orchestrator] Saving image results:', savePayload.map(p => ({ imageId: p.imageId, category: p.category })));

    const saveResult = await this.client.send('BATCH_SAVE_ANALYSIS', {
      results: savePayload,
    });

    console.log('[Orchestrator] Save result:', saveResult);

    if (saveResult.failedIds?.length > 0) {
      console.warn('[Orchestrator] 일부 저장 실패:', saveResult.failedIds);
    }

    return {
      savedCount: saveResult.savedCount,
      failedCount: saveResult.failedIds?.length ?? 0,
    };
  }
}
