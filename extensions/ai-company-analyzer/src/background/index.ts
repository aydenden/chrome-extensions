// Service Worker 진입점
import { registerCaptureHandler } from './capture-handler';
import {
  initEngine,
  getEngineStatus,
  analyzeFinancials,
  analyzeReviews,
  analyzeGraphImage,
  analyzeImage,
  calculateTotalScore,
  disposeEngine,
} from './smolvlm-engine';
import {
  initEmbeddingEngine,
  getEmbeddingEngineStatus,
} from './embedding-engine';
import {
  getAllCompanies,
  createCompany,
  saveImage,
  getImageBlob,
  getExtractedData,
  manualClassify,
  getExtractedText,
  updateExtractionStatus,
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
import { searchByCompany, searchAll, getVectorStats } from '@/lib/vector-search';
import {
  gatherAnalysisContext,
  buildRAGAnalysisPrompt,
  buildCustomQueryPrompt,
  buildFinancialAnalysisPrompt,
  buildReviewAnalysisPrompt,
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
  // Offscreen Document 전용 메시지는 무시 (Offscreen이 직접 처리)
  if (message.target === 'offscreen') {
    return false;
  }

  console.log('Message received:', message);

  switch (message.type) {
    case 'PING':
      sendResponse({ status: 'pong' });
      break;

    // ============ SmolVLM 엔진 관련 메시지 ============
    case 'INIT_SMOLVLM':
      // SmolVLM 엔진 초기화
      (async () => {
        try {
          await initEngine((progress) => {
            // 진행률 브로드캐스트
            chrome.runtime.sendMessage({
              type: 'SMOLVLM_PROGRESS',
              data: progress,
            }).catch(() => {
              // 리스너가 없는 경우 무시
            });
          });
          sendResponse({ success: true, status: getEngineStatus() });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true; // 비동기 응답

    case 'GET_ENGINE_STATUS':
      // 엔진 상태 조회
      sendResponse({ success: true, status: getEngineStatus() });
      break;

    case 'ANALYZE_FINANCIALS':
      // 재무 이미지 분석
      (async () => {
        try {
          const { imageDataUrl } = message.data;
          const response = await fetch(imageDataUrl);
          const blob = await response.blob();
          const result = await analyzeFinancials(blob);
          sendResponse({ success: true, data: result });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true; // 비동기 응답

    case 'ANALYZE_REVIEWS':
      // 리뷰 이미지 분석
      (async () => {
        try {
          const { imageDataUrl } = message.data;
          const response = await fetch(imageDataUrl);
          const blob = await response.blob();
          const result = await analyzeReviews(blob);
          sendResponse({ success: true, data: result });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true; // 비동기 응답

    case 'ANALYZE_GRAPH_IMAGE':
      // 그래프 이미지 분석
      (async () => {
        try {
          const { imageDataUrl } = message.data;
          console.log('[분석] imageDataUrl:', imageDataUrl);

          const response = await fetch(imageDataUrl);
          const blob = await response.blob();
          console.log('[분석] blob 크기:', blob.size, 'bytes, 타입:', blob.type);

          const result = await analyzeGraphImage(blob);
          console.log('[분석] 분석 결과:', result);
          sendResponse({ success: true, data: result });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true; // 비동기 응답

    case 'ANALYZE_IMAGE':
      // 일반 이미지 분석 (커스텀 프롬프트)
      (async () => {
        try {
          const { imageDataUrl, prompt } = message.data;
          const response = await fetch(imageDataUrl);
          const blob = await response.blob();
          const result = await analyzeImage(blob, prompt);
          sendResponse({ success: true, data: { result } });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true; // 비동기 응답

    case 'CALCULATE_TOTAL_SCORE':
      // 종합 점수 계산
      try {
        const { financialScore, reviewScore, weights } = message.data;
        const totalScore = calculateTotalScore(financialScore, reviewScore, weights);
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
          await disposeEngine();
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true; // 비동기 응답

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
      // 카테고리별 프롬프트로 분석
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

          // 카테고리별 프롬프트로 분석
          const prompt = buildAnalysisPrompt(subCategory);
          const result = await analyzeImage(blob, prompt);

          // JSON 파싱 시도 (후처리 강화)
          let parsedResult;
          try {
            // 1. 코드블록 제거
            let cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

            // 2. JSON 객체 추출
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              cleaned = jsonMatch[0];
            }

            // 3. 불완전한 JSON 복구 시도
            const openBraces = (cleaned.match(/{/g) || []).length;
            const closeBraces = (cleaned.match(/}/g) || []).length;
            if (openBraces > closeBraces) {
              cleaned += '}'.repeat(openBraces - closeBraces);
            }

            // 4. 배열 괄호 복구
            const openBrackets = (cleaned.match(/\[/g) || []).length;
            const closeBrackets = (cleaned.match(/\]/g) || []).length;
            if (openBrackets > closeBrackets) {
              // 닫히지 않은 배열이 있으면 끝에 추가
              const lastBrace = cleaned.lastIndexOf('}');
              if (lastBrace > 0) {
                cleaned = cleaned.substring(0, lastBrace) + ']'.repeat(openBrackets - closeBrackets) + cleaned.substring(lastBrace);
              }
            }

            parsedResult = JSON.parse(cleaned);
          } catch (parseError) {
            console.warn('JSON 파싱 실패, rawResponse로 대체:', parseError);
            // 기본 구조로 대체
            parsedResult = {
              summary: result.substring(0, 200) || '분석 결과를 파싱할 수 없습니다.',
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

    case 'RAG_SEARCH':
      // 벡터 검색
      (async () => {
        try {
          const { companyId, query, options } = message.data;
          let results;
          if (companyId) {
            results = await searchByCompany(companyId, query, options);
          } else {
            results = await searchAll(query, options);
          }
          sendResponse({ success: true, data: results });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'RAG_ANALYZE':
      // RAG 기반 종합 분석
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

          // LLM 분석 (Vision 모델 사용, 이미지 없이 텍스트만)
          // Note: 실제로는 텍스트 전용 LLM을 사용하는 것이 더 효율적
          // 여기서는 기존 Vision 모델을 텍스트 분석에도 사용
          const result = await analyzeImage(new Blob(['']), prompt);

          // JSON 파싱
          let parsedResult;
          try {
            const cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
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
              recommendation: result,
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
      // RAG 커스텀 질문
      (async () => {
        try {
          const { companyId, query } = message.data;

          // 커스텀 프롬프트 생성
          const prompt = await buildCustomQueryPrompt(companyId, query);

          // LLM 응답
          const result = await analyzeImage(new Blob(['']), prompt);

          sendResponse({
            success: true,
            data: { answer: result },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'GET_VECTOR_STATS':
      // 벡터 통계 조회
      (async () => {
        try {
          const { companyId } = message.data || {};
          const stats = await getVectorStats(companyId);
          sendResponse({ success: true, data: stats });
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

    case 'INIT_EMBEDDING_ENGINE':
      // 임베딩 엔진 초기화
      (async () => {
        try {
          await initEmbeddingEngine((progress) => {
            chrome.runtime.sendMessage({
              type: 'EMBEDDING_PROGRESS',
              data: progress,
            }).catch(() => {});
          });
          sendResponse({ success: true, status: getEmbeddingEngineStatus() });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
          });
        }
      })();
      return true;

    case 'GET_EMBEDDING_ENGINE_STATUS':
      // 임베딩 엔진 상태 조회 (비동기)
      (async () => {
        try {
          const status = await getEmbeddingEngineStatus();
          sendResponse({ success: true, status });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '상태 조회 실패',
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

    case 'GET_VECTOR_INDEX':
      // VectorIndex 조회 (테스트용)
      (async () => {
        try {
          const { companyId } = message.data;
          const { getVectorIndexesByCompany } = await import('@/lib/storage');
          const vectors = await getVectorIndexesByCompany(companyId);
          sendResponse({ success: true, vectors });
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
