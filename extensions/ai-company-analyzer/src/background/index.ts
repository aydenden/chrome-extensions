// Service Worker 진입점
import { registerCaptureHandler } from './capture-handler';
import {
  initDonut,
  getDonutStatus,
  recognizeText,
  disposeDonut,
} from './donut-engine';
import {
  initTextLLM,
  getTextLLMStatus,
  generateText,
  disposeTextLLM,
} from './text-llm-engine';
import {
  getAllCompanies,
  createCompany,
  saveImage,
  getImageBlob,
  getExtractedData,
  manualClassify,
  getExtractedText,
} from '@/lib/storage';
import {
  classificationQueue,
  restorePendingClassifications,
  requestReclassification,
} from './classification-queue';
import {
  extractionQueue,
  restorePendingExtractions,
  requestReExtraction,
} from './extraction-queue';
import { buildAnalysisPrompt } from '@/lib/prompts';
import {
  gatherAnalysisContext,
  buildRAGAnalysisPrompt,
  buildCustomQueryPrompt,
  checkContextAvailability,
} from '@/lib/prompts/rag-analysis';
import type { DataType, ImageSubCategory } from '@/types/storage';

console.log('AI 기업분석 - Background Service Worker 시작');

// Service Worker 유지용 heartbeat
const HEARTBEAT_INTERVAL = 20000;
setInterval(() => {
  chrome.runtime.getPlatformInfo(() => {});
}, HEARTBEAT_INTERVAL);

// 캡처 핸들러 등록
registerCaptureHandler();

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);

  switch (message.type) {
    case 'PING':
      sendResponse({ status: 'pong' });
      break;

    // ============ OCR 엔진 관련 메시지 (v5.0: Donut OCR) ============
    case 'INIT_SMOLVLM':
    case 'INIT_OCR':
      // OCR 엔진 초기화 (Donut + Text LLM)
      (async () => {
        try {
          // Donut 초기화
          await initDonut((progress) => {
            chrome.runtime.sendMessage({
              type: 'SMOLVLM_PROGRESS',
              data: progress,
            }).catch(() => {});
          });

          // Text LLM 초기화
          await initTextLLM((progress) => {
            chrome.runtime.sendMessage({
              type: 'TEXTLLM_PROGRESS',
              data: progress,
            }).catch(() => {});
          });

          sendResponse({
            success: true,
            status: {
              donut: getDonutStatus(),
              textLLM: getTextLLMStatus(),
            },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'GET_ENGINE_STATUS':
      // 엔진 상태 조회
      sendResponse({
        success: true,
        status: {
          donut: getDonutStatus(),
          textLLM: getTextLLMStatus(),
          // 호환성: isReady는 둘 다 준비되었을 때
          isReady: getDonutStatus().isReady && getTextLLMStatus().isReady,
          isLoading: getDonutStatus().isLoading || getTextLLMStatus().isLoading,
          loadProgress: (getDonutStatus().loadProgress + getTextLLMStatus().loadProgress) / 2,
        },
      });
      break;

    case 'ANALYZE_FINANCIALS':
    case 'ANALYZE_REVIEWS':
    case 'ANALYZE_GRAPH_IMAGE':
    case 'ANALYZE_IMAGE':
      // v4.0: 직접 분석 대신 extraction_queue 사용 권장
      // 레거시 호환성을 위해 OCR만 수행
      (async () => {
        try {
          const { imageDataUrl } = message.data;
          const response = await fetch(imageDataUrl);
          const blob = await response.blob();
          const text = await recognizeText(blob);
          sendResponse({ success: true, data: { result: text, rawText: text } });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'CALCULATE_TOTAL_SCORE':
      // 종합 점수 계산 (단순 가중 평균)
      try {
        const { financialScore, reviewScore, weights } = message.data;
        const w = weights || { financial: 0.6, review: 0.4 };
        const totalScore = Math.round(
          (financialScore || 3) * w.financial + (reviewScore || 3) * w.review
        );
        sendResponse({ success: true, data: { totalScore } });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
      break;

    case 'DISPOSE_ENGINE':
      // 엔진 정리
      (async () => {
        try {
          await disposeDonut();
          await disposeTextLLM();
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    // ============ Storage 관련 메시지 ============
    case 'GET_COMPANIES':
      // 회사 목록 조회
      (async () => {
        try {
          const companies = await getAllCompanies();
          sendResponse({ success: true, data: companies });
        } catch (error) {
          console.error('회사 목록 조회 실패:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true; // 비동기 응답

    case 'SAVE_DATA':
      // 이미지 데이터 저장 + 백그라운드 분류 큐에 추가
      (async () => {
        try {
          const {
            companyName,
            data,
            dataType,
            source,
            isNewCompany,
            existingCompanyId,
          } = message.payload as {
            companyName: string;
            data: string; // base64 이미지
            dataType: DataType;
            source: string;
            isNewCompany: boolean;
            existingCompanyId?: string;
          };

          // 회사 ID 결정
          let targetCompanyId: string;
          if (isNewCompany) {
            targetCompanyId = await createCompany(companyName);
          } else {
            if (!existingCompanyId) {
              throw new Error('기존 회사 ID가 필요합니다.');
            }
            targetCompanyId = existingCompanyId;
          }

          // 이미지 저장 (분류 대기 상태로)
          const response = await fetch(data);
          const blob = await response.blob();
          const extractedDataId = await saveImage(targetCompanyId, blob, dataType, source);

          // 즉시 응답 (사용자 대기 없음)
          sendResponse({ success: true, companyId: targetCompanyId, extractedDataId });

          // 백그라운드에서 RAG 추출 큐에 추가 (분류 → 텍스트 추출 → 임베딩)
          extractionQueue.enqueue(extractedDataId, dataType);
        } catch (error) {
          console.error('데이터 저장 실패:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true; // 비동기 응답

    // ============ 이미지 분류 관련 메시지 ============
    case 'GET_CLASSIFICATION_STATUS':
      // 분류 상태 조회
      (async () => {
        try {
          const { extractedDataId } = message.data;
          const data = await getExtractedData(extractedDataId);
          sendResponse({
            success: true,
            data: {
              status: data?.classificationStatus,
              subCategory: data?.subCategory,
            },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'RECLASSIFY_IMAGE':
      // 수동 재분류 요청
      (async () => {
        try {
          const { extractedDataId } = message.data;
          const result = await requestReclassification(extractedDataId);
          sendResponse({ success: result });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'MANUAL_CLASSIFY':
      // 수동 분류 (사용자가 직접 카테고리 선택)
      (async () => {
        try {
          const { extractedDataId, subCategory } = message.data as {
            extractedDataId: string;
            subCategory: ImageSubCategory;
          };
          await manualClassify(extractedDataId, subCategory);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'ANALYZE_BY_CATEGORY':
      // 카테고리별 분석 (v4.0: OCR + Text LLM)
      (async () => {
        try {
          const { extractedDataId } = message.data;

          // 이미지와 카테고리 정보 가져오기
          const extractedData = await getExtractedData(extractedDataId);
          if (!extractedData) {
            throw new Error('데이터를 찾을 수 없습니다.');
          }

          const subCategory = extractedData.subCategory || 'unknown';
          if (subCategory === 'pending') {
            throw new Error('아직 분류되지 않은 이미지입니다.');
          }

          const blob = await getImageBlob(extractedDataId);
          if (!blob) {
            throw new Error('이미지를 찾을 수 없습니다.');
          }

          // 1. Donut OCR로 텍스트 추출
          const ocrText = await recognizeText(blob);

          // 2. Text LLM으로 분석
          const prompt = buildAnalysisPrompt(subCategory);
          const result = await generateText(
            'You are a document analyst. Analyze the text and respond in JSON format with summary, keyPoints, and score (1-5).',
            `${prompt}\n\n텍스트:\n${ocrText}`,
            256
          );

          // JSON 파싱 (Qwen3 <think> 태그 제거)
          let parsedResult;
          try {
            let cleaned = result.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedResult = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('JSON을 찾을 수 없음');
            }
          } catch (parseError) {
            console.warn('JSON 파싱 실패, rawResponse로 대체:', parseError);
            parsedResult = {
              summary: result.replace(/<think>[\s\S]*?<\/think>/g, '').trim().substring(0, 200) || '분석 결과를 파싱할 수 없습니다.',
              keyPoints: [],
              score: 3,
              rawResponse: result,
            };
          }

          sendResponse({
            success: true,
            data: {
              category: subCategory,
              analysis: parsedResult,
              ocrText: ocrText.slice(0, 500),
            },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'GET_QUEUE_STATUS':
      // 분류 큐 상태 조회
      sendResponse({
        success: true,
        data: classificationQueue.getStatus(),
      });
      break;

    // ============ RAG 시스템 메시지 ============
    case 'GET_EXTRACTION_STATUS':
      // 추출 상태 조회 (RAG 파이프라인)
      (async () => {
        try {
          const { extractedDataId } = message.data;
          const data = await getExtractedData(extractedDataId);
          const textData = await getExtractedText(extractedDataId);
          sendResponse({
            success: true,
            data: {
              extractionStatus: data?.extractionStatus,
              subCategory: data?.subCategory,
              hasText: !!textData,
              textExtractedAt: data?.textExtractedAt,
              embeddedAt: data?.embeddedAt,
            },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'GET_EXTRACTION_QUEUE_STATUS':
      // RAG 추출 큐 상태 조회
      sendResponse({
        success: true,
        data: extractionQueue.getStatus(),
      });
      break;

    case 'RE_EXTRACT':
      // 재추출 요청
      (async () => {
        try {
          const { extractedDataId } = message.data;
          const result = await requestReExtraction(extractedDataId);
          sendResponse({ success: result });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'RAG_ANALYZE':
      // RAG 기반 종합 분석 (v4.0: Text LLM 사용)
      (async () => {
        try {
          const { companyId } = message.data;

          // 컨텍스트 수집
          const context = await gatherAnalysisContext(companyId);

          // 컨텍스트가 없으면 에러
          if (!context.financialContext && !context.reviewContext) {
            throw new Error('분석할 데이터가 없습니다. 먼저 데이터를 추출해주세요.');
          }

          // 분석 프롬프트 생성
          const prompt = buildRAGAnalysisPrompt(context);

          // Text LLM 분석
          const result = await generateText(
            'You are a company analyst. Analyze the provided data and respond in JSON format.',
            prompt,
            512
          );

          // JSON 파싱 (Qwen3 <think> 태그 제거)
          let parsedResult;
          try {
            let cleaned = result.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedResult = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('JSON을 찾을 수 없음');
            }
          } catch {
            parsedResult = {
              overallScore: 3,
              financialHealth: { score: 3, summary: '분석 결과를 파싱할 수 없습니다.', strengths: [], concerns: [] },
              employeeSentiment: { score: 3, summary: '분석 결과를 파싱할 수 없습니다.', positives: [], negatives: [] },
              recommendation: result.replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
            };
          }

          sendResponse({
            success: true,
            data: {
              analysis: parsedResult,
              context: {
                hasFinancial: !!context.financialContext,
                hasReview: !!context.reviewContext,
                numbersCount: context.relevantNumbers.length,
              },
            },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'RAG_QUERY':
      // RAG 커스텀 질문 (v4.0: Text LLM 사용)
      (async () => {
        try {
          const { companyId, query } = message.data;

          // 커스텀 프롬프트 생성
          const prompt = await buildCustomQueryPrompt(companyId, query);

          // Text LLM 응답
          const result = await generateText(
            'You are a helpful assistant. Answer the question based on the provided context. Respond in Korean.',
            prompt,
            256
          );

          // Qwen3 <think> 태그 제거
          const cleanedResult = result.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

          sendResponse({
            success: true,
            data: { answer: cleanedResult },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'CHECK_RAG_AVAILABILITY':
      // RAG 데이터 가용성 체크
      (async () => {
        try {
          const { companyId } = message.data;
          const availability = await checkContextAvailability(companyId);
          sendResponse({ success: true, data: availability });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    // ============ 테스트용 메시지 핸들러 ============
    case 'GET_EXTRACTED_DATA':
      // ExtractedData 조회 (테스트용)
      (async () => {
        try {
          const { extractedDataId } = message.data;
          const data = await getExtractedData(extractedDataId);
          sendResponse({ success: true, data });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'GET_EXTRACTED_TEXT':
      // ExtractedText 조회 (테스트용)
      (async () => {
        try {
          const { extractedDataId } = message.data;
          const { getExtractedText: fetchExtractedText } = await import('@/lib/storage');
          const text = await fetchExtractedText(extractedDataId);
          sendResponse({ success: true, text });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    default:
      sendResponse({ status: 'unknown_message' });
  }

  return true; // 비동기 응답 허용
});

// 설치 이벤트
chrome.runtime.onInstalled.addListener((details) => {
  console.log('AI 기업분석 설치됨:', details.reason);

  // 대기 중인 분류 작업 복구 (레거시)
  restorePendingClassifications().catch(console.error);

  // 대기 중인 RAG 추출 작업 복구
  restorePendingExtractions().catch(console.error);
});

// Service Worker 시작 이벤트
chrome.runtime.onStartup.addListener(() => {
  console.log('AI 기업분석 - Service Worker 시작됨');

  // 대기 중인 분류 작업 복구 (레거시)
  restorePendingClassifications().catch(console.error);

  // 대기 중인 RAG 추출 작업 복구
  restorePendingExtractions().catch(console.error);
});
