/**
 * 이미지 분류 큐
 * 백그라운드에서 비동기로 이미지 분류를 처리
 */

import { classifyImage } from './classifier';
import {
  getImageBlob,
  updateExtractedDataCategory,
  markClassificationFailed,
  getPendingClassifications,
  getExtractedData,
} from '@/lib/storage';
import type { DataType, ImageSubCategory } from '@/types/storage';

// 분류 작업 인터페이스
interface ClassificationTask {
  extractedDataId: string;
  siteType: DataType;
  retryCount: number;
}

// 설정
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 5000; // 5초
const PROCESSING_DELAY = 1000; // 작업 간 딜레이

/**
 * 분류 큐 클래스
 */
class ClassificationQueue {
  private queue: ClassificationTask[] = [];
  private isProcessing = false;
  private processingId: string | null = null;

  /**
   * 분류 작업 추가
   */
  enqueue(extractedDataId: string, siteType: DataType): void {
    // 이미 큐에 있는지 확인
    const exists = this.queue.some(
      (task) => task.extractedDataId === extractedDataId
    );

    if (exists || this.processingId === extractedDataId) {
      console.log('[Queue] 이미 큐에 존재하는 작업:', extractedDataId);
      return;
    }

    this.queue.push({
      extractedDataId,
      siteType,
      retryCount: 0,
    });

    console.log('[Queue] 작업 추가됨:', extractedDataId, '큐 크기:', this.queue.length);

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

    console.log('[Queue] 작업 시작:', task.extractedDataId, '재시도:', task.retryCount);

    try {
      // 이미지 Blob 가져오기
      const blob = await getImageBlob(task.extractedDataId);
      if (!blob) {
        throw new Error('이미지 Blob을 찾을 수 없습니다.');
      }

      // 분류 수행
      const category = await classifyImage(blob, task.siteType);
      console.log('[Queue] 분류 완료:', task.extractedDataId, '->', category);

      // DB 업데이트
      await updateExtractedDataCategory(task.extractedDataId, category);
      console.log('[Queue] DB 업데이트 완료:', task.extractedDataId);

    } catch (error) {
      console.error('[Queue] 분류 실패:', task.extractedDataId, error);

      // 재시도 로직
      if (task.retryCount < MAX_RETRIES) {
        task.retryCount++;
        const delay = RETRY_DELAY_BASE * task.retryCount;

        console.log(
          '[Queue] 재시도 예약:',
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
        // 최대 재시도 횟수 초과 - 실패로 마킹
        console.error('[Queue] 최대 재시도 횟수 초과:', task.extractedDataId);
        await markClassificationFailed(task.extractedDataId);
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
   * 큐 상태 조회
   */
  getStatus(): {
    queueLength: number;
    isProcessing: boolean;
    processingId: string | null;
  } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      processingId: this.processingId,
    };
  }

  /**
   * 큐 비우기
   */
  clear(): void {
    this.queue = [];
    console.log('[Queue] 큐 초기화됨');
  }
}

// 싱글톤 인스턴스
export const classificationQueue = new ClassificationQueue();

/**
 * Service Worker 재시작 시 대기 중인 작업 복구
 */
export async function restorePendingClassifications(): Promise<void> {
  try {
    const pendingItems = await getPendingClassifications();
    console.log('[Queue] 대기 중인 분류 작업 복구:', pendingItems.length, '개');

    for (const item of pendingItems) {
      classificationQueue.enqueue(item.id, item.type);
    }
  } catch (error) {
    console.error('[Queue] 대기 작업 복구 실패:', error);
  }
}

/**
 * 특정 이미지 재분류 요청
 */
export async function requestReclassification(
  extractedDataId: string
): Promise<boolean> {
  try {
    const data = await getExtractedData(extractedDataId);
    if (!data) {
      console.error('[Queue] 데이터를 찾을 수 없음:', extractedDataId);
      return false;
    }

    classificationQueue.enqueue(extractedDataId, data.type);
    return true;
  } catch (error) {
    console.error('[Queue] 재분류 요청 실패:', error);
    return false;
  }
}
