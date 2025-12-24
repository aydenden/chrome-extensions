/**
 * Analysis Manager
 * 백그라운드에서 AI 분석을 실행하고 세션 상태를 관리
 */
import { v4 as uuid } from 'uuid';
import { db, type AnalysisSession, type StoredImage } from '@/lib/db';
import { OllamaClient } from '@/lib/ai/ollama-client';
import { extractJsonFromContent } from '@/lib/ai/stream-parser';
import type {
  AnalysisStatus,
  AnalysisStep,
  StartAnalysisPayload,
  StreamChunkPayload,
  ImageCompletePayload,
  AnalysisCompletePayload,
  SynthesisResult,
  AnalysisEvent,
} from '@shared/types';
import type { ImageSubCategory } from '@shared/constants/categories';

// ============================================================================
// Default Prompts
// ============================================================================

const DEFAULT_IMAGE_ANALYSIS_PROMPT = `{{companyName}} 회사의 스크린샷을 분석하세요.
{{#if memo}}

## 사용자 메모
이 이미지에 대해 사용자가 제공한 추가 정보입니다:
{{memo}}
{{/if}}

## 카테고리
다음 중 하나를 선택하세요:
- revenue_trend: 매출/수익 추이 그래프
- balance_sheet: 재무상태표
- income_statement: 손익계산서
- employee_trend: 직원수/입퇴사 추이
- review_positive: 긍정적 리뷰
- review_negative: 부정적 리뷰
- company_overview: 회사 개요/소개
- unknown: 분류 불가

## 분석 요청
1. 이미지에서 텍스트와 수치 데이터를 추출하세요
2. 적절한 카테고리를 선택하세요
3. 핵심 내용을 요약하세요

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요:

\`\`\`json
{
  "category": "카테고리명",
  "summary": "2-3문장 요약",
  "keyPoints": ["핵심포인트1", "핵심포인트2", "핵심포인트3"],
  "sentiment": "positive 또는 neutral 또는 negative",
  "extractedText": "이미지에서 추출한 주요 텍스트/수치"
}
\`\`\``;

const DEFAULT_SYNTHESIS_PROMPT = `다음은 {{companyName}} 회사에 대한 개별 분석 결과입니다:
{{#if analysisContext}}

## 분석 컨텍스트
사용자가 제공한 추가 정보입니다:
{{analysisContext}}
{{/if}}

## 개별 분석 결과
{{analyses}}

위 분석 결과를 종합하여 회사 전체를 평가해주세요.

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요:

\`\`\`json
{
  "score": 0-100 사이 숫자,
  "summary": "회사 종합 요약 (2-3문장)",
  "strengths": ["강점1", "강점2", "강점3"],
  "weaknesses": ["약점1", "약점2", "약점3"],
  "recommendation": "recommend" 또는 "neutral" 또는 "not_recommend",
  "reasoning": "추천 이유 (1-2문장)"
}
\`\`\``;

// ============================================================================
// Types
// ============================================================================

type EventBroadcaster = (event: AnalysisEvent) => void;

interface AnalysisManagerOptions {
  onEvent?: EventBroadcaster;
}

// ============================================================================
// AnalysisManager Class
// ============================================================================

export class AnalysisManager {
  private currentSessionId: string | null = null;
  private abortController: AbortController | null = null;
  private ollamaClient: OllamaClient | null = null;
  private eventBroadcaster: EventBroadcaster | null = null;

  constructor(options?: AnalysisManagerOptions) {
    this.eventBroadcaster = options?.onEvent ?? null;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * 초기화 - 미완료 세션 복구
   */
  async init(): Promise<void> {
    // Ollama 설정 로드
    const settings = await db.ollamaSettings.get('default');
    if (settings) {
      this.ollamaClient = new OllamaClient(settings.endpoint, settings.model);
    }

    // 미완료 세션 확인
    const incompleteSession = await db.analysisSessions
      .where('step')
      .anyOf(['loading-images', 'analyzing', 'synthesizing', 'saving'])
      .first();

    if (incompleteSession) {
      console.log('[AnalysisManager] Found incomplete session:', incompleteSession.id);
      this.currentSessionId = incompleteSession.id;

      // paused 상태로 변경
      await db.analysisSessions.update(incompleteSession.id, {
        step: 'paused',
        updatedAt: new Date(),
      });

      this.broadcastStatus();
    }
  }

  /**
   * 이벤트 브로드캐스터 설정
   */
  setEventBroadcaster(broadcaster: EventBroadcaster): void {
    this.eventBroadcaster = broadcaster;
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * 현재 세션 상태 조회
   */
  async getStatus(): Promise<AnalysisStatus> {
    if (!this.currentSessionId) {
      return this.createIdleStatus();
    }

    const session = await db.analysisSessions.get(this.currentSessionId);
    if (!session) {
      return this.createIdleStatus();
    }

    return this.sessionToStatus(session);
  }

  /**
   * 분석 시작
   */
  async startAnalysis(payload: StartAnalysisPayload): Promise<void> {
    // 이미 실행 중인 세션이 있으면 에러
    const current = await this.getStatus();
    if (current.step !== 'idle' && current.step !== 'done' && current.step !== 'error') {
      this.broadcastEvent({
        type: 'ERROR',
        payload: { message: '이미 분석이 진행 중입니다', recoverable: true },
      });
      return;
    }

    // Ollama 설정 로드
    const settings = await db.ollamaSettings.get('default');
    if (!settings) {
      this.broadcastEvent({
        type: 'ERROR',
        payload: { message: 'Ollama 설정이 없습니다', recoverable: false },
      });
      return;
    }

    this.ollamaClient = new OllamaClient(settings.endpoint, settings.model);

    // 연결 확인
    const connected = await this.ollamaClient.checkConnection();
    if (!connected) {
      this.broadcastEvent({
        type: 'ERROR',
        payload: { message: 'Ollama 서버에 연결할 수 없습니다', recoverable: true },
      });
      return;
    }

    // 새 세션 생성
    const sessionId = uuid();
    const session: AnalysisSession = {
      id: sessionId,
      companyId: payload.companyId,
      companyName: payload.companyName,
      imageIds: payload.imageIds,
      step: 'loading-images',
      current: 0,
      total: payload.imageIds.length,
      completedImageIds: [],
      failedImageIds: [],
      results: [],
      synthesis: null,
      analysisContext: payload.analysisContext,
      promptSettings: payload.promptSettings,
      model: settings.model,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.analysisSessions.add(session);
    this.currentSessionId = sessionId;
    this.abortController = new AbortController();

    this.broadcastStatus();

    // 분석 실행 (비동기)
    this.runAnalysis(sessionId).catch((error) => {
      console.error('[AnalysisManager] Analysis failed:', error);
    });
  }

  /**
   * 분석 중단
   */
  async abort(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.currentSessionId) {
      await db.analysisSessions.update(this.currentSessionId, {
        step: 'error',
        error: '사용자가 중단함',
        updatedAt: new Date(),
      });
      this.broadcastStatus();
    }
  }

  /**
   * 실패한 이미지 재시도
   */
  async retryFailed(): Promise<void> {
    if (!this.currentSessionId) return;

    const session = await db.analysisSessions.get(this.currentSessionId);
    if (!session || session.failedImageIds.length === 0) return;

    // 실패한 이미지만 재분석
    const failedIds = [...session.failedImageIds];
    await db.analysisSessions.update(session.id, {
      imageIds: failedIds,
      failedImageIds: [],
      step: 'analyzing',
      current: 0,
      total: failedIds.length,
      updatedAt: new Date(),
    });

    this.abortController = new AbortController();
    this.broadcastStatus();

    this.runAnalysis(session.id).catch((error) => {
      console.error('[AnalysisManager] Retry failed:', error);
    });
  }

  // ==========================================================================
  // Analysis Execution
  // ==========================================================================

  /**
   * 분석 실행 (메인 루프)
   */
  private async runAnalysis(sessionId: string): Promise<void> {
    try {
      const session = await db.analysisSessions.get(sessionId);
      if (!session || !this.ollamaClient) return;

      // Step 1: 이미지 로드
      await this.updateSession(sessionId, {
        step: 'loading-images',
        message: '이미지 로드 중...',
      });

      const images = await this.loadImages(session.imageIds);
      if (images.length === 0) {
        throw new Error('분석할 이미지가 없습니다');
      }

      // Step 2: 개별 이미지 분석
      await this.updateSession(sessionId, {
        step: 'analyzing',
        current: 0,
        total: images.length,
      });

      const results: ImageCompletePayload[] = [];
      const completedIds: string[] = [];
      const failedIds: string[] = [];

      for (let i = 0; i < images.length; i++) {
        if (this.abortController?.signal.aborted) {
          throw new Error('AbortError');
        }

        const image = images[i];
        await this.updateSession(sessionId, {
          current: i,
          currentImageId: image.id,
          message: `이미지 분석 중... (${i + 1}/${images.length})`,
        });

        try {
          const result = await this.analyzeImage(session, image);
          results.push(result);
          completedIds.push(image.id);

          // 이미지 분석 결과 저장
          await db.analysisSessions.update(sessionId, {
            results: [...(await db.analysisSessions.get(sessionId))!.results, {
              imageId: result.imageId,
              category: result.category,
              rawText: result.rawText,
              analysis: result.analysis,
            }],
            completedImageIds: completedIds,
            updatedAt: new Date(),
          });

          this.broadcastEvent({ type: 'IMAGE_COMPLETE', payload: result });
        } catch (error) {
          console.error(`[AnalysisManager] Image ${image.id} failed:`, error);
          failedIds.push(image.id);

          await db.analysisSessions.update(sessionId, {
            failedImageIds: failedIds,
            updatedAt: new Date(),
          });

          this.broadcastEvent({
            type: 'IMAGE_COMPLETE',
            payload: {
              imageId: image.id,
              category: 'unknown',
              rawText: '',
              analysis: JSON.stringify({ error: true }),
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      }

      // Step 3: 종합 분석
      let synthesis: SynthesisResult | null = null;
      if (completedIds.length > 0) {
        await this.updateSession(sessionId, {
          step: 'synthesizing',
          current: 0,
          total: 1,
          message: '종합 분석 중...',
        });

        this.broadcastEvent({ type: 'SYNTHESIS_START' });

        synthesis = await this.generateSynthesis(session, results);

        await db.analysisSessions.update(sessionId, {
          synthesis,
          updatedAt: new Date(),
        });
      }

      // Step 4: 결과 저장
      await this.updateSession(sessionId, {
        step: 'saving',
        message: '결과 저장 중...',
      });

      const saveResult = await this.saveResults(session.companyId, results, synthesis);

      // 완료
      await this.updateSession(sessionId, {
        step: 'done',
        message: `분석 완료! (${completedIds.length}개 성공, ${failedIds.length}개 실패)`,
      });

      this.broadcastEvent({
        type: 'COMPLETE',
        payload: {
          results,
          synthesis,
          savedCount: saveResult.savedCount,
          failedCount: saveResult.failedCount,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message === 'AbortError') {
        await this.updateSession(sessionId, {
          step: 'error',
          error: '사용자가 중단함',
        });
      } else {
        await this.updateSession(sessionId, {
          step: 'error',
          error: message,
        });
        this.broadcastEvent({
          type: 'ERROR',
          payload: { message, recoverable: true },
        });
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * 이미지 로드
   */
  private async loadImages(imageIds: string[]): Promise<StoredImage[]> {
    const images: StoredImage[] = [];
    for (const id of imageIds) {
      const image = await db.images.get(id);
      if (image) {
        images.push(image);
      }
    }
    return images;
  }

  /**
   * 단일 이미지 분석
   */
  private async analyzeImage(
    session: AnalysisSession,
    image: StoredImage
  ): Promise<ImageCompletePayload> {
    // 이미지를 base64로 변환
    const base64 = await this.blobToBase64(image.blob);

    // 프롬프트 생성
    const prompt = this.interpolatePrompt(
      session.promptSettings?.imageAnalysis || DEFAULT_IMAGE_ANALYSIS_PROMPT,
      {
        companyName: session.companyName,
        memo: image.memo,
      }
    );

    // 스트리밍 분석
    let accumulatedThinking = '';
    let accumulatedContent = '';

    const generator = this.ollamaClient!.analyzeImageStream(base64, prompt, {
      abortSignal: this.abortController?.signal,
    });

    for await (const chunk of generator) {
      if (chunk.type === 'thinking') {
        accumulatedThinking = chunk.accumulated.thinking;
        this.broadcastEvent({
          type: 'STREAM_CHUNK',
          payload: {
            imageId: image.id,
            chunkType: 'thinking',
            text: chunk.text,
            accumulated: chunk.accumulated,
          },
        });
      } else if (chunk.type === 'content') {
        accumulatedContent = chunk.accumulated.content;
        this.broadcastEvent({
          type: 'STREAM_CHUNK',
          payload: {
            imageId: image.id,
            chunkType: 'content',
            text: chunk.text,
            accumulated: chunk.accumulated,
          },
        });
      }
    }

    // JSON 추출
    const parsed = extractJsonFromContent(accumulatedContent);
    const category = this.validateCategory(parsed);
    const rawText = (parsed as Record<string, unknown>)?.extractedText as string || '';

    return {
      imageId: image.id,
      category,
      rawText,
      analysis: JSON.stringify(parsed || { error: true }),
      success: parsed !== null,
    };
  }

  /**
   * 종합 분석 생성
   */
  private async generateSynthesis(
    session: AnalysisSession,
    results: ImageCompletePayload[]
  ): Promise<SynthesisResult | null> {
    if (results.length === 0) return null;

    // 분석 결과 텍스트 생성
    const analysesText = results
      .filter((r) => r.success)
      .map((r, i) => {
        try {
          const data = JSON.parse(r.analysis);
          return `[${i + 1}] ${r.category}: ${data.summary || data.extractedText || '요약 없음'}`;
        } catch {
          return `[${i + 1}] ${r.category}: 분석 데이터 없음`;
        }
      })
      .join('\n\n');

    const prompt = this.interpolatePrompt(
      session.promptSettings?.synthesis || DEFAULT_SYNTHESIS_PROMPT,
      {
        companyName: session.companyName,
        analysisContext: session.analysisContext,
        analyses: analysesText,
      }
    );

    // 스트리밍 분석
    let accumulatedContent = '';

    const generator = this.ollamaClient!.chatStream(
      [{ role: 'user', content: prompt }],
      { abortSignal: this.abortController?.signal }
    );

    for await (const chunk of generator) {
      if (chunk.type === 'thinking') {
        this.broadcastEvent({
          type: 'STREAM_CHUNK',
          payload: {
            chunkType: 'thinking',
            text: chunk.text,
            accumulated: chunk.accumulated,
          },
        });
      } else if (chunk.type === 'content') {
        accumulatedContent = chunk.accumulated.content;
        this.broadcastEvent({
          type: 'STREAM_CHUNK',
          payload: {
            chunkType: 'content',
            text: chunk.text,
            accumulated: chunk.accumulated,
          },
        });
      }
    }

    // JSON 추출 및 검증
    const parsed = extractJsonFromContent(accumulatedContent);
    return this.validateSynthesisResult(parsed);
  }

  /**
   * 결과 저장
   */
  private async saveResults(
    companyId: string,
    results: ImageCompletePayload[],
    synthesis: SynthesisResult | null
  ): Promise<{ savedCount: number; failedCount: number }> {
    let savedCount = 0;
    let failedCount = 0;

    // 이미지별 결과 저장
    for (const result of results) {
      if (!result.success) {
        failedCount++;
        continue;
      }

      try {
        await db.images.update(result.imageId, {
          category: result.category,
          rawText: result.rawText,
          analysis: result.analysis,
          analyzedModel: this.ollamaClient?.getModel(),
          updatedAt: new Date(),
        });
        savedCount++;
      } catch {
        failedCount++;
      }
    }

    // 종합 분석 저장
    if (synthesis) {
      try {
        await db.companies.update(companyId, {
          analysis: {
            ...synthesis,
            analyzedAt: new Date().toISOString(),
            analyzedModel: this.ollamaClient?.getModel(),
          },
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error('[AnalysisManager] Failed to save synthesis:', error);
      }
    }

    return { savedCount, failedCount };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private async updateSession(
    sessionId: string,
    updates: Partial<{
      step: AnalysisStep;
      current: number;
      total: number;
      currentImageId: string;
      message: string;
      error: string;
    }>
  ): Promise<void> {
    await db.analysisSessions.update(sessionId, {
      ...updates,
      updatedAt: new Date(),
    });
    this.broadcastStatus();
  }

  private broadcastStatus(): void {
    this.getStatus().then((status) => {
      this.broadcastEvent({ type: 'STATUS', payload: status });
    });
  }

  private broadcastEvent(event: AnalysisEvent): void {
    this.eventBroadcaster?.(event);
  }

  private createIdleStatus(): AnalysisStatus {
    return {
      sessionId: '',
      companyId: '',
      companyName: '',
      step: 'idle',
      current: 0,
      total: 0,
      message: '분석 대기 중...',
      completedImageIds: [],
      failedImageIds: [],
    };
  }

  private sessionToStatus(session: AnalysisSession): AnalysisStatus {
    return {
      sessionId: session.id,
      companyId: session.companyId,
      companyName: session.companyName,
      step: session.step,
      current: session.current,
      total: session.total,
      message: this.getStepMessage(session.step, session.current, session.total),
      currentImageId: session.currentImageId,
      completedImageIds: session.completedImageIds,
      failedImageIds: session.failedImageIds,
      error: session.error,
    };
  }

  private getStepMessage(step: AnalysisStep, current: number, total: number): string {
    switch (step) {
      case 'idle':
        return '분석 대기 중...';
      case 'loading-images':
        return '이미지 로드 중...';
      case 'analyzing':
        return `이미지 분석 중... (${current + 1}/${total})`;
      case 'synthesizing':
        return '종합 분석 중...';
      case 'saving':
        return '결과 저장 중...';
      case 'done':
        return '분석 완료!';
      case 'paused':
        return '일시 정지됨 (재연결 대기 중)';
      case 'error':
        return '오류 발생';
      default:
        return '';
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  private interpolatePrompt(
    template: string,
    variables: Record<string, string | undefined>
  ): string {
    let result = template;

    // 조건부 블록 처리: {{#if variable}}...{{/if}}
    const ifBlockRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    result = result.replace(ifBlockRegex, (_, varName, content) => {
      const value = variables[varName];
      if (value && value.trim()) {
        return content.replace(/\{\{(\w+)\}\}/g, (match: string, innerVar: string) => {
          return variables[innerVar] ?? match;
        });
      }
      return '';
    });

    // 일반 변수 치환: {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] ?? match;
    });

    return result;
  }

  private validateCategory(parsed: object | null): ImageSubCategory {
    const validCategories: ImageSubCategory[] = [
      'revenue_trend',
      'balance_sheet',
      'income_statement',
      'employee_trend',
      'review_positive',
      'review_negative',
      'company_overview',
      'unknown',
    ];

    const category = (parsed as Record<string, unknown>)?.category as string;
    return validCategories.includes(category as ImageSubCategory)
      ? (category as ImageSubCategory)
      : 'unknown';
  }

  private validateSynthesisResult(parsed: object | null): SynthesisResult | null {
    if (!parsed) return null;

    const data = parsed as Record<string, unknown>;

    if (typeof data.score !== 'number') return null;
    if (typeof data.summary !== 'string') return null;
    if (!Array.isArray(data.strengths)) return null;
    if (!Array.isArray(data.weaknesses)) return null;
    if (!['recommend', 'neutral', 'not_recommend'].includes(data.recommendation as string)) {
      return null;
    }
    if (typeof data.reasoning !== 'string') return null;

    return {
      score: Math.min(100, Math.max(0, data.score)),
      summary: data.summary,
      strengths: data.strengths.slice(0, 3).map(String),
      weaknesses: data.weaknesses.slice(0, 3).map(String),
      recommendation: data.recommendation as 'recommend' | 'neutral' | 'not_recommend',
      reasoning: data.reasoning,
    };
  }
}

// 싱글톤 인스턴스
export const analysisManager = new AnalysisManager();
