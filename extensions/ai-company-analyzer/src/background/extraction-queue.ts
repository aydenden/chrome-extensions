/**
 * 통합 추출 큐
 * 3단계 파이프라인: 분류 → 텍스트 추출 → 임베딩 생성
 */

import { classifyImage } from './classifier';
import { initEngine, isEngineReady, analyzeImage } from './smolvlm-engine';
import {
  initEmbeddingEngine,
  generateEmbeddings,
  isEmbeddingEngineReady,
} from './embedding-engine';
import { buildExtractionPrompt } from '@/lib/prompts/extraction';
import {
  getImageBlob,
  getExtractedData,
  updateExtractedDataCategory,
  updateExtractionStatus,
  saveExtractedText,
  saveVectorIndexBatch,
  getPendingExtractions,
} from '@/lib/storage';
import type { DataType, ExtractionStatus, ExtractedMetadata } from '@/types/storage';

// 추출 작업 인터페이스
interface ExtractionTask {
  extractedDataId: string;
  siteType: DataType;
  currentPhase: 'classify' | 'extract' | 'embed';
  retryCount: number;
}

// 설정
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 5000; // 5초
const PROCESSING_DELAY = 1000; // 작업 간 딜레이
const MAX_EXTRACTION_RETRIES = 2; // 추출 실패 시 재시도 횟수

/**
 * VLM 응답 유효성 검사
 * 중국어 반복, 무의미한 출력 등을 감지
 */
function isValidVLMResponse(response: string): { valid: boolean; reason?: string } {
  if (!response || response.length < 10) {
    return { valid: false, reason: '응답이 너무 짧음' };
  }

  // 1. 중국어/한자 반복 패턴 감지 (현재现在 등)
  const chinesePattern = /[\u4e00-\u9fff]{2,}/g;
  const chineseMatches = response.match(chinesePattern) || [];
  const totalChineseChars = chineseMatches.join('').length;

  if (totalChineseChars > response.length * 0.3 && !response.includes('{')) {
    return { valid: false, reason: '중국어 반복 출력 감지' };
  }

  // 2. 같은 문자/단어 반복 패턴 (20회 이상)
  if (/(.)\1{20,}/.test(response)) {
    return { valid: false, reason: '문자 반복 감지' };
  }

  // 3. 같은 단어 반복 패턴 (예: "现在现在现在")
  if (/(.{2,})\1{10,}/.test(response)) {
    return { valid: false, reason: '단어 반복 감지' };
  }

  // 4. JSON 구조가 전혀 없는 경우
  if (!response.includes('{') && !response.includes('rawText') && !response.includes('summary')) {
    return { valid: false, reason: 'JSON 구조 없음' };
  }

  return { valid: true };
}

/**
 * 추출 큐 클래스
 */
class ExtractionQueue {
  private queue: ExtractionTask[] = [];
  private isProcessing = false;
  private processingId: string | null = null;

  /**
   * 추출 작업 추가
   */
  enqueue(extractedDataId: string, siteType: DataType): void {
    // 이미 큐에 있는지 확인
    const exists = this.queue.some(
      (task) => task.extractedDataId === extractedDataId
    );

    if (exists || this.processingId === extractedDataId) {
      console.log('[ExtractionQueue] 이미 큐에 존재하는 작업:', extractedDataId);
      return;
    }

    this.queue.push({
      extractedDataId,
      siteType,
      currentPhase: 'classify',
      retryCount: 0,
    });

    console.log('[ExtractionQueue] 작업 추가됨:', extractedDataId, '큐 크기:', this.queue.length);

    // 처리 시작
    this.processNext();
  }

  /**
   * 다음 작업 처리
   */
  private async processNext(): Promise<void> {
    // 이미 처리 중이거나 큐가 비어있으면 종료
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift()!;
    this.processingId = task.extractedDataId;

    console.log(
      '[ExtractionQueue] 작업 시작:',
      task.extractedDataId,
      '단계:',
      task.currentPhase,
      '재시도:',
      task.retryCount
    );

    try {
      // 1단계: 분류
      if (task.currentPhase === 'classify') {
        await this.runClassification(task);
        task.currentPhase = 'extract';
      }

      // 2단계: 텍스트 추출
      if (task.currentPhase === 'extract') {
        await this.runTextExtraction(task);
        task.currentPhase = 'embed';
      }

      // 3단계: 임베딩 생성
      if (task.currentPhase === 'embed') {
        await this.runEmbedding(task);
      }

      // 완료
      await updateExtractionStatus(task.extractedDataId, 'completed');
      console.log('[ExtractionQueue] 작업 완료:', task.extractedDataId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[ExtractionQueue] 작업 실패:', task.extractedDataId, errorMessage);
      if (errorStack) {
        console.error('[ExtractionQueue] 스택 트레이스:', errorStack);
      }

      // 재시도 로직
      if (task.retryCount < MAX_RETRIES) {
        task.retryCount++;
        const delay = RETRY_DELAY_BASE * task.retryCount;

        console.log(
          '[ExtractionQueue] 재시도 예약:',
          task.extractedDataId,
          '시도:',
          task.retryCount,
          '딜레이:',
          delay,
          'ms'
        );

        setTimeout(() => {
          this.queue.push(task);
          this.processNext();
        }, delay);
      } else {
        // 최대 재시도 횟수 초과 - 실패로 마킹 (에러 메시지 포함)
        console.error('[ExtractionQueue] 최대 재시도 횟수 초과:', task.extractedDataId);
        await updateExtractionStatus(task.extractedDataId, 'failed', errorMessage);
      }
    } finally {
      this.isProcessing = false;
      this.processingId = null;

      // 다음 작업 처리 (약간의 딜레이 후)
      if (this.queue.length > 0) {
        setTimeout(() => this.processNext(), PROCESSING_DELAY);
      }
    }
  }

  /**
   * 1단계: 이미지 분류
   */
  private async runClassification(task: ExtractionTask): Promise<void> {
    console.log('[ExtractionQueue] 분류 시작:', task.extractedDataId);
    await updateExtractionStatus(task.extractedDataId, 'classifying');

    // 이미지 Blob 가져오기
    const blob = await getImageBlob(task.extractedDataId);
    if (!blob) {
      throw new Error('이미지 Blob을 찾을 수 없습니다.');
    }

    // Vision 모델 준비
    if (!isEngineReady()) {
      console.log('[ExtractionQueue] Vision 모델 로딩...');
      await initEngine();
    }

    // 분류 수행
    const category = await classifyImage(blob, task.siteType);
    console.log('[ExtractionQueue] 분류 완료:', task.extractedDataId, '->', category);

    // DB 업데이트
    await updateExtractedDataCategory(task.extractedDataId, category);
  }

  /**
   * 2단계: 텍스트 추출
   */
  private async runTextExtraction(task: ExtractionTask): Promise<void> {
    console.log('[ExtractionQueue] 텍스트 추출 시작:', task.extractedDataId);
    await updateExtractionStatus(task.extractedDataId, 'extracting_text');

    // 데이터 조회
    const data = await getExtractedData(task.extractedDataId);
    if (!data) {
      throw new Error('추출 데이터를 찾을 수 없습니다.');
    }

    // 이미지 Blob 가져오기
    const blob = await getImageBlob(task.extractedDataId);
    if (!blob) {
      throw new Error('이미지 Blob을 찾을 수 없습니다.');
    }

    // Vision 모델 준비
    if (!isEngineReady()) {
      console.log('[ExtractionQueue] Vision 모델 로딩...');
      await initEngine();
    }

    // 카테고리별 프롬프트로 텍스트 추출
    const category = data.subCategory || 'unknown';
    const prompt = buildExtractionPrompt(category, task.siteType);

    // 추출 시도 (유효성 검사 포함)
    let response = '';
    let extractionAttempt = 0;
    let lastValidationError = '';

    while (extractionAttempt < MAX_EXTRACTION_RETRIES) {
      extractionAttempt++;
      console.log(`[ExtractionQueue] 추출 시도 ${extractionAttempt}/${MAX_EXTRACTION_RETRIES}:`, category);

      response = await analyzeImage(blob, prompt);

      // 응답 유효성 검사
      const validation = isValidVLMResponse(response);
      if (validation.valid) {
        break; // 유효한 응답
      }

      lastValidationError = validation.reason || '알 수 없는 오류';
      console.warn(`[ExtractionQueue] 유효하지 않은 응답 (${lastValidationError}):`, response.slice(0, 100));

      // 마지막 시도가 아니면 잠시 대기 후 재시도
      if (extractionAttempt < MAX_EXTRACTION_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 최종 응답 검사
    const finalValidation = isValidVLMResponse(response);
    if (!finalValidation.valid) {
      console.warn(`[ExtractionQueue] 모든 추출 시도 실패 (${lastValidationError}), 기본값으로 저장`);
      // 기본값으로 저장하고 계속 진행 (임베딩 단계에서 빈 텍스트 처리)
      await saveExtractedText(
        task.extractedDataId,
        data.companyId,
        category,
        `[추출 실패: ${lastValidationError}]`,
        { summary: '', keyPoints: [] }
      );
      return;
    }

    // JSON 응답 파싱
    const parsed = parseExtractionResponse(response);
    console.log('[ExtractionQueue] 추출 결과:', parsed.summary?.slice(0, 50));

    // DB 저장
    await saveExtractedText(
      task.extractedDataId,
      data.companyId,
      category,
      parsed.rawText || response, // 파싱 실패 시 원본 사용
      parsed
    );
  }

  /**
   * 3단계: 임베딩 생성
   */
  private async runEmbedding(task: ExtractionTask): Promise<void> {
    console.log('[ExtractionQueue] 임베딩 생성 시작:', task.extractedDataId);
    await updateExtractionStatus(task.extractedDataId, 'embedding');

    // 데이터 조회
    console.log('[ExtractionQueue] 추출 데이터 조회 중...');
    const data = await getExtractedData(task.extractedDataId);
    if (!data) {
      throw new Error('추출 데이터를 찾을 수 없습니다.');
    }
    console.log('[ExtractionQueue] 추출 데이터 조회 완료:', data.id);

    // 추출된 텍스트 조회
    console.log('[ExtractionQueue] 추출 텍스트 조회 중...');
    const { getExtractedText } = await import('@/lib/storage');
    const textData = await getExtractedText(task.extractedDataId);
    if (!textData) {
      throw new Error(`추출된 텍스트를 찾을 수 없습니다. (id: ${task.extractedDataId})`);
    }
    console.log('[ExtractionQueue] 추출 텍스트 조회 완료, rawText 길이:', textData.rawText?.length || 0);

    // 임베딩 모델 준비
    const embeddingReady = await isEmbeddingEngineReady();
    console.log('[ExtractionQueue] 임베딩 엔진 상태:', embeddingReady);
    if (!embeddingReady) {
      console.log('[ExtractionQueue] 임베딩 모델 로딩...');
      await initEmbeddingEngine();
      console.log('[ExtractionQueue] 임베딩 모델 로딩 완료');
    }

    // 임베딩 생성
    console.log('[ExtractionQueue] 임베딩 생성 중...');
    const embeddings = await generateEmbeddings(textData.rawText);
    console.log('[ExtractionQueue] 임베딩 생성 완료:', embeddings.length, '개 청크');

    if (embeddings.length === 0) {
      console.warn('[ExtractionQueue] 임베딩 결과 없음, 스킵');
      return;
    }

    // DB 저장
    console.log('[ExtractionQueue] 벡터 인덱스 저장 중...');
    const chunks = embeddings.map(e => ({
      chunkText: e.chunkText,
      embedding: e.embedding,
    }));

    await saveVectorIndexBatch(
      task.extractedDataId,
      data.companyId,
      data.subCategory || 'unknown',
      chunks
    );
    console.log('[ExtractionQueue] 벡터 인덱스 저장 완료');
  }

  /**
   * 큐 상태 조회
   */
  getStatus(): {
    queueLength: number;
    isProcessing: boolean;
    processingId: string | null;
    processingPhase: string | null;
  } {
    const processingTask = this.queue.find(
      t => t.extractedDataId === this.processingId
    );

    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      processingId: this.processingId,
      processingPhase: processingTask?.currentPhase || null,
    };
  }

  /**
   * 큐 비우기
   */
  clear(): void {
    this.queue = [];
    console.log('[ExtractionQueue] 큐 초기화됨');
  }
}

/**
 * 반복 패턴 제거 (모델 루프 방지)
 */
function removeRepetitionPatterns(text: string): string {
  // 연속된 동일 문자 패턴 제거 (예: "::::::", "    ", "====")
  let cleaned = text.replace(/(.)\1{10,}/g, '$1$1$1');

  // 연속된 동일 패턴 제거 (예: ": : : : :", ":: :: ::")
  cleaned = cleaned.replace(/(:+ ?){5,}/g, ':');
  cleaned = cleaned.replace(/(= ?){5,}/g, '=');
  cleaned = cleaned.replace(/(- ?){5,}/g, '-');

  return cleaned;
}

/**
 * 불완전한 JSON 복구 시도
 */
function tryRecoverJson(text: string): string | null {
  // 반복 패턴 제거
  let cleaned = removeRepetitionPatterns(text);

  // JSON 시작 찾기
  const startIdx = cleaned.indexOf('{');
  if (startIdx === -1) return null;

  cleaned = cleaned.slice(startIdx);

  // 중괄호 균형 맞추기
  let depth = 0;
  let endIdx = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }

  // 균형 잡힌 JSON을 찾지 못한 경우
  if (endIdx === -1) {
    // 마지막으로 닫히지 않은 JSON 복구 시도
    const partialJson = cleaned;

    // 열린 중괄호 수 세기
    let openBraces = 0;
    let openBrackets = 0;
    for (const char of partialJson) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }

    // 닫는 괄호 추가
    let recovered = partialJson;
    while (openBrackets > 0) {
      recovered += ']';
      openBrackets--;
    }
    while (openBraces > 0) {
      recovered += '}';
      openBraces--;
    }

    return recovered;
  }

  return cleaned.slice(0, endIdx + 1);
}

/**
 * JSON 응답 파싱 (강화된 버전)
 */
function parseExtractionResponse(response: string): ExtractedMetadata & { rawText: string } {
  // 기본값
  const defaultResult: ExtractedMetadata & { rawText: string } = {
    rawText: response,
    summary: '',
    keyPoints: [],
  };

  try {
    // 1. 반복 패턴 제거
    let cleaned = removeRepetitionPatterns(response);

    // 2. 마크다운 코드블록 제거
    cleaned = cleaned
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // 3. JSON 복구 시도
    const recoveredJson = tryRecoverJson(cleaned);
    if (!recoveredJson) {
      console.warn('[ExtractionQueue] JSON 객체를 찾을 수 없음');
      return extractFieldsFromText(response, defaultResult);
    }

    // 4. JSON 파싱 시도
    const parsed = JSON.parse(recoveredJson);

    // 5. 결과 정규화
    return {
      rawText: typeof parsed.rawText === 'string' ? parsed.rawText : response,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      keyPoints: Array.isArray(parsed.keyPoints)
        ? parsed.keyPoints.filter((p: unknown) => typeof p === 'string')
        : [],
      numbers: Array.isArray(parsed.numbers) ? parsed.numbers : undefined,
      trend: parsed.trend || undefined,
      sentiment: parsed.sentiment || undefined,
    };
  } catch (error) {
    console.warn('[ExtractionQueue] JSON 파싱 실패:', error);
    return extractFieldsFromText(response, defaultResult);
  }
}

/**
 * 텍스트에서 필드 직접 추출 (JSON 파싱 실패 시 폴백)
 */
function extractFieldsFromText(
  text: string,
  defaultResult: ExtractedMetadata & { rawText: string }
): ExtractedMetadata & { rawText: string } {
  try {
    // rawText 추출 (여러 패턴 시도)
    const rawTextPatterns = [
      /"rawText"\s*:\s*"((?:[^"\\]|\\.)*)"/,
      /"rawText"\s*:\s*'((?:[^'\\]|\\.)*)'/,
    ];

    let rawText = '';
    for (const pattern of rawTextPatterns) {
      const match = text.match(pattern);
      if (match) {
        rawText = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        break;
      }
    }

    // summary 추출
    const summaryMatch = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const summary = summaryMatch
      ? summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
      : '';

    // keyPoints 추출
    const keyPointsMatch = text.match(/"keyPoints"\s*:\s*\[([\s\S]*?)\]/);
    let keyPoints: string[] = [];
    if (keyPointsMatch) {
      const pointsStr = keyPointsMatch[1];
      const points = pointsStr.match(/"((?:[^"\\]|\\.)*)"/g);
      if (points) {
        keyPoints = points.map((p) =>
          p.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n')
        );
      }
    }

    return {
      rawText: rawText || text,
      summary,
      keyPoints,
    };
  } catch {
    return defaultResult;
  }
}

// 싱글톤 인스턴스
export const extractionQueue = new ExtractionQueue();

/**
 * Service Worker 재시작 시 대기 중인 작업 복구
 */
export async function restorePendingExtractions(): Promise<void> {
  try {
    const pendingItems = await getPendingExtractions();
    console.log('[ExtractionQueue] 대기 중인 추출 작업 복구:', pendingItems.length, '개');

    for (const item of pendingItems) {
      extractionQueue.enqueue(item.id, item.type);
    }
  } catch (error) {
    console.error('[ExtractionQueue] 대기 작업 복구 실패:', error);
  }
}

/**
 * 특정 이미지 재추출 요청
 */
export async function requestReExtraction(
  extractedDataId: string
): Promise<boolean> {
  try {
    const data = await getExtractedData(extractedDataId);
    if (!data) {
      console.error('[ExtractionQueue] 데이터를 찾을 수 없음:', extractedDataId);
      return false;
    }

    // 상태 초기화
    await updateExtractionStatus(extractedDataId, 'pending');

    // 큐에 추가
    extractionQueue.enqueue(extractedDataId, data.type);
    return true;
  } catch (error) {
    console.error('[ExtractionQueue] 재추출 요청 실패:', error);
    return false;
  }
}
