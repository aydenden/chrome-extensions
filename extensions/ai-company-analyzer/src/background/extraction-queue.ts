/**
 * 통합 추출 큐 (v5.0)
 * 2단계 파이프라인: Donut OCR → 텍스트 LM 분류/분석
 *
 * 변경 이력:
 * - v5.0: Tesseract.js → Donut OCR로 교체 (Service Worker 호환)
 * - v4.0: VLM → Tesseract.js로 OCR 엔진 교체 (안정성/속도 개선)
 * - v3.0: VLM은 OCR만, 분류/분석은 텍스트 LM으로 분리
 * - v2.0: JSON 제거, 단순 텍스트 추출
 * - v1.0: VLM으로 분류+추출 동시 수행
 */

import { initDonut, isDonutReady, recognizeText } from './donut-engine';
import { initTextLLM, isTextLLMReady, generateText } from './text-llm-engine';
import { parseExtractedText, type ParsedNumber } from '@/lib/prompts/extraction';
import {
  CLASSIFY_SYSTEM,
  ANALYZE_SYSTEM,
  buildClassifyPrompt,
  buildAnalyzePrompt,
  parseCategory,
  removeThinkingTags,
} from '@/lib/prompts/text-analysis';
import type { ExtractedNumber, ImageSubCategory } from '@/types/storage';
import {
  getImageBlob,
  getExtractedData,
  updateExtractedDataCategory,
  updateExtractionStatus,
  saveExtractedText,
  getPendingExtractions,
} from '@/lib/storage';
import type { DataType, ExtractionStatus, ExtractedMetadata } from '@/types/storage';

// 추출 작업 인터페이스
interface ExtractionTask {
  extractedDataId: string;
  siteType: DataType;
  currentPhase: 'ocr' | 'analyze';
  retryCount: number;
  rawText?: string; // OCR 결과 (단계 간 전달용)
}

// 설정
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 5000; // 5초
const PROCESSING_DELAY = 1000; // 작업 간 딜레이
const MAX_EXTRACTION_RETRIES = 2; // 추출 실패 시 재시도 횟수

/**
 * OCR 응답 유효성 검사 (v5.0)
 * Donut OCR 결과의 유효성 검사
 */
function isValidOCRResponse(response: string): { valid: boolean; reason?: string } {
  if (!response || response.length < 5) {
    return { valid: false, reason: '응답이 너무 짧음' };
  }

  // 1. 같은 문자 반복 패턴 (20회 이상)
  if (/(.)\1{20,}/.test(response)) {
    return { valid: false, reason: '문자 반복 감지' };
  }

  // 2. 같은 단어 반복 패턴
  if (/(.{2,})\1{10,}/.test(response)) {
    return { valid: false, reason: '단어 반복 감지' };
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
      currentPhase: 'ocr', // v3.0: 'classify' → 'ocr'
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
      // 1단계: VLM OCR (이미지 → 텍스트)
      if (task.currentPhase === 'ocr') {
        const rawText = await this.runOCR(task);
        task.rawText = rawText;
        task.currentPhase = 'analyze';
      }

      // 2단계: 텍스트 LM 분류/분석
      if (task.currentPhase === 'analyze') {
        await this.runTextAnalysis(task);
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
   * 1단계: Donut OCR (이미지 → 텍스트)
   * v5.0: Tesseract.js → Donut으로 교체 (Service Worker 호환)
   */
  private async runOCR(task: ExtractionTask): Promise<string> {
    console.log('[ExtractionQueue] OCR 시작:', task.extractedDataId);
    await updateExtractionStatus(task.extractedDataId, 'extracting_text');

    // 이미지 Blob 가져오기
    const blob = await getImageBlob(task.extractedDataId);
    if (!blob) {
      throw new Error('이미지 Blob을 찾을 수 없습니다.');
    }

    // Donut 준비
    if (!isDonutReady()) {
      console.log('[ExtractionQueue] Donut OCR 로딩...');
      await initDonut();
    }

    // OCR 수행
    let rawText = '';
    let ocrAttempt = 0;

    while (ocrAttempt < MAX_EXTRACTION_RETRIES) {
      ocrAttempt++;
      console.log(`[ExtractionQueue] OCR 시도 ${ocrAttempt}/${MAX_EXTRACTION_RETRIES}`);

      rawText = await recognizeText(blob);

      // 응답 유효성 검사
      const validation = isValidOCRResponse(rawText);
      if (validation.valid) {
        break;
      }

      console.warn(`[ExtractionQueue] OCR 유효하지 않은 응답 (${validation.reason}):`, rawText.slice(0, 100));

      if (ocrAttempt < MAX_EXTRACTION_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 최종 검사
    const finalValidation = isValidOCRResponse(rawText);
    if (!finalValidation.valid) {
      throw new Error(`OCR 실패: ${finalValidation.reason}`);
    }

    console.log('[ExtractionQueue] OCR 완료:', rawText.slice(0, 100));
    return rawText;
  }

  /**
   * 2단계: 텍스트 LM 분류/분석
   * v3.0: OCR 결과를 텍스트 LM으로 분류하고 분석
   */
  private async runTextAnalysis(task: ExtractionTask): Promise<void> {
    console.log('[ExtractionQueue] 텍스트 분석 시작:', task.extractedDataId);
    await updateExtractionStatus(task.extractedDataId, 'classifying');

    // 데이터 조회
    const data = await getExtractedData(task.extractedDataId);
    if (!data) {
      throw new Error('추출 데이터를 찾을 수 없습니다.');
    }

    const rawText = task.rawText;
    if (!rawText || rawText.length < 5) {
      throw new Error('OCR 결과가 없습니다.');
    }

    // 텍스트 LM 준비 (선택적)
    let category: ImageSubCategory = 'unknown';
    let summary = '';

    if (!isTextLLMReady()) {
      console.log('[ExtractionQueue] 텍스트 LM 로딩...');
      try {
        await initTextLLM();
      } catch (error) {
        console.warn('[ExtractionQueue] 텍스트 LM 로딩 실패, 분류/분석 건너뜀:', error);
      }
    }

    // 텍스트 LM이 준비되면 분류 및 분석 수행
    if (isTextLLMReady()) {
      // 분류
      try {
        console.log('[ExtractionQueue] 분류 중...');
        const classifyResult = await generateText(
          CLASSIFY_SYSTEM,
          buildClassifyPrompt(rawText),
          16  // 카테고리명만 출력
        );
        category = parseCategory(classifyResult);
        console.log('[ExtractionQueue] 분류 결과:', category);
      } catch (error) {
        console.warn('[ExtractionQueue] 분류 실패:', error);
      }

      // 분석 (분류가 성공한 경우)
      if (category !== 'unknown') {
        try {
          console.log('[ExtractionQueue] 분석 중...');
          summary = await generateText(
            ANALYZE_SYSTEM,
            buildAnalyzePrompt(rawText, category),
            256
          );
          console.log('[ExtractionQueue] 분석 결과:', removeThinkingTags(summary).slice(0, 100));
        } catch (error) {
          console.warn('[ExtractionQueue] 분석 실패:', error);
        }
      }
    }

    // DB 업데이트: 카테고리
    await updateExtractedDataCategory(task.extractedDataId, category);

    // 텍스트 후처리: 정규표현식으로 숫자/연도/퍼센트 추출
    const structured = parseExtractedText(rawText);
    console.log('[ExtractionQueue] 파싱된 숫자:', structured.numbers.length, '개');
    console.log('[ExtractionQueue] 파싱된 연도:', structured.years);

    // ParsedNumber → ExtractedNumber 변환
    const convertedNumbers: ExtractedNumber[] = structured.numbers.map((n: ParsedNumber) => ({
      label: n.context?.slice(0, 20) || '',
      value: n.value,
      unit: n.unit,
    }));

    // 분석 결과에서 <think> 태그 제거 (Qwen3 0.6B는 /no_think가 작동하지 않음)
    const cleanedSummary = summary ? removeThinkingTags(summary) : rawText.slice(0, 200);

    // DB 저장 (rawText + 구조화된 메타데이터)
    await saveExtractedText(
      task.extractedDataId,
      data.companyId,
      category,
      rawText,
      {
        summary: cleanedSummary,
        keyPoints: convertedNumbers.slice(0, 5).map(n => `${n.value}${n.unit}`),
        numbers: convertedNumbers,
      }
    );
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
