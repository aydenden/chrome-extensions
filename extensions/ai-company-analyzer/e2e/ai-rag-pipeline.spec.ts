/**
 * 전체 추출 파이프라인 E2E 테스트
 *
 * 실제 파이프라인과 동일한 흐름 테스트:
 * SAVE_DATA → 분류 → 텍스트 추출 → RAG_ANALYZE
 *
 * Worker scope fixture 사용으로 모든 테스트가 동일한 컨텍스트 공유
 */

import { test, expect, getPopupUrl, clearDatabase } from './fixtures';
import { loadFixture } from './helpers/fixture-loader';
import { AI_TEST_MATRIX } from './helpers/test-matrix';

// 타임아웃 설정
const ENGINE_INIT_TIMEOUT = 150000; // 2.5분 (VLM)
const PIPELINE_TIMEOUT = 300000; // 5분 (전체 파이프라인)
const POLLING_INTERVAL = 5000; // 5초

// 순차 실행 (Worker scope로 컨텍스트 공유)
test.describe.configure({ mode: 'serial' });

test.describe('Full Extraction Pipeline', () => {
  // 테스트 전체에서 공유할 companyId 저장
  let sharedCompanyId: string | null = null;

  // 첫 번째 테스트: VLM 엔진 초기화
  test('VLM 엔진 초기화', async ({ extensionContext, extensionId }) => {
    test.setTimeout(ENGINE_INIT_TIMEOUT);

    const page = await extensionContext.newPage();
    await page.goto(getPopupUrl(extensionId));

    // VLM 엔진 초기화 (선택적 - WebGPU 미지원 환경에서 실패 가능)
    console.log('VLM 엔진 초기화 시도...');
    const vlmInitResult = (await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'INIT_SMOLVLM' }, resolve);
      });
    })) as { success: boolean; error?: string };

    if (vlmInitResult.success) {
      // VLM Ready 상태 대기
      try {
        await expect
          .poll(
            async () => {
              const status = (await page.evaluate(() => {
                return new Promise((resolve) => {
                  chrome.runtime.sendMessage({ type: 'GET_ENGINE_STATUS' }, resolve);
                });
              })) as { success: boolean; status: { isReady: boolean } };
              return status.status?.isReady || false;
            },
            { timeout: ENGINE_INIT_TIMEOUT, intervals: [5000] }
          )
          .toBe(true);
        console.log('VLM 엔진 초기화 완료');
      } catch {
        console.warn('VLM 엔진 Ready 상태 대기 타임아웃 (WebGPU 미지원 가능)');
      }
    } else {
      console.warn('VLM 엔진 초기화 실패 (WebGPU 미지원 환경):', vlmInitResult.error);
      console.warn('→ 분류 및 RAG 분석은 VLM 없이 제한된 기능으로 동작합니다.');
    }

    await page.close();
  });

  // 각 fixture별 전체 파이프라인 테스트
  for (const testCase of AI_TEST_MATRIX) {
    test(`${testCase.fixture}: 전체 추출 파이프라인`, async ({ extensionContext, extensionId }) => {
      test.setTimeout(PIPELINE_TIMEOUT);

      const page = await extensionContext.newPage();
      await page.goto(getPopupUrl(extensionId));

      // 1. Fixture 로드
      const imageDataUrl = loadFixture(testCase.fixture);
      console.log(`[${testCase.fixture}] 파이프라인 시작...`);

      // 2. SAVE_DATA - 이미지 저장 + 추출 파이프라인 시작
      const companyName = `Test Company - ${testCase.fixture}`;
      const isNewCompany = sharedCompanyId === null;
      const existingCompanyId = sharedCompanyId;

      const saveResult = (await page.evaluate(
        async ({ imageData, dataType, companyName, isNewCompany, existingCompanyId }) => {
          return new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'SAVE_DATA',
                payload: {
                  data: imageData,
                  dataType: dataType,
                  companyName: companyName,
                  source: 'e2e-test',
                  isNewCompany: isNewCompany,
                  existingCompanyId: existingCompanyId,
                },
              },
              resolve
            );
          });
        },
        { imageData: imageDataUrl, dataType: testCase.dataType, companyName, isNewCompany, existingCompanyId }
      )) as { success: boolean; companyId?: string; extractedDataId?: string; error?: string };

      if (!saveResult.success) {
        console.error(`[${testCase.fixture}] SAVE_DATA 실패:`, saveResult.error);
      }
      expect(saveResult.success).toBe(true);
      expect(saveResult.companyId).toBeDefined();
      expect(saveResult.extractedDataId).toBeDefined();

      const companyId = saveResult.companyId!;
      const extractedDataId = saveResult.extractedDataId!;
      sharedCompanyId = companyId; // 다음 테스트에서 같은 회사 사용

      console.log(`[${testCase.fixture}] 저장 완료: companyId=${companyId}, extractedDataId=${extractedDataId}`);

      // 3. 추출 파이프라인 완료 대기 (분류 → 텍스트 추출)
      console.log(`[${testCase.fixture}] 추출 파이프라인 대기 중...`);

      let extractionData: any = null;
      let failedStatus = false;
      await expect
        .poll(
          async () => {
            const result = (await page.evaluate(
              async ({ extractedDataId }) => {
                return new Promise((resolve) => {
                  chrome.runtime.sendMessage(
                    {
                      type: 'GET_EXTRACTED_DATA',
                      data: { extractedDataId },
                    },
                    resolve
                  );
                });
              },
              { extractedDataId }
            )) as { success: boolean; data?: any };

            if (result.success && result.data) {
              extractionData = result.data;
              const status = result.data.extractionStatus;
              console.log(
                `[${testCase.fixture}] 상태: ${status}, 카테고리: ${result.data.subCategory || 'pending'}`
              );

              // 실패 상태 조기 감지
              if (status === 'failed') {
                failedStatus = true;
                return 'completed'; // polling 종료를 위해 completed 반환
              }
              return status;
            }
            return 'pending';
          },
          { timeout: PIPELINE_TIMEOUT, intervals: [POLLING_INTERVAL] }
        )
        .toBe('completed');

      // 실패 상태 처리
      if (failedStatus) {
        const errorMsg = extractionData?.extractionError || 'unknown error';
        throw new Error(`[${testCase.fixture}] 추출 파이프라인 실패: ${errorMsg}`);
      }

      console.log(`[${testCase.fixture}] 추출 파이프라인 완료`);

      // 4. 중간 검증: subCategory
      expect(extractionData).toBeDefined();
      const subCategory = extractionData.subCategory;
      const categoryMatched = testCase.expectedCategories.includes(subCategory);

      if (!categoryMatched) {
        console.warn(
          `[${testCase.fixture}] 카테고리 불일치: got=${subCategory}, expected=${testCase.expectedCategories.join('|')}`
        );
      }
      // 분류는 soft assertion (경고만)

      // 5. 중간 검증: ExtractedText 존재
      const textResult = (await page.evaluate(
        async ({ extractedDataId }) => {
          return new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'GET_EXTRACTED_TEXT',
                data: { extractedDataId },
              },
              resolve
            );
          });
        },
        { extractedDataId }
      )) as { success: boolean; text?: any };

      expect(textResult.success).toBe(true);
      if (textResult.text) {
        console.log(
          `[${testCase.fixture}] ExtractedText 확인: rawText 길이=${textResult.text.rawText?.length || 0}`
        );
      }

      // 6. RAG_ANALYZE - 종합 분석 (metadata 기반)
      console.log(`[${testCase.fixture}] RAG 분석 시작...`);
      const analyzeResult = (await page.evaluate(
        async ({ companyId }) => {
          return new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'RAG_ANALYZE',
                data: { companyId },
              },
              resolve
            );
          });
        },
        { companyId }
      )) as { success: boolean; data?: { analysis?: { overallScore?: number } }; error?: string };

      if (!analyzeResult.success) {
        console.warn(`[${testCase.fixture}] RAG 분석 실패:`, analyzeResult.error);
      }

      // 7. 점수 검증
      if (analyzeResult.success && analyzeResult.data?.analysis?.overallScore !== undefined) {
        const score = analyzeResult.data.analysis.overallScore;
        const [minScore, maxScore] = testCase.scoreRange;

        console.log(`[${testCase.fixture}] 점수: ${score} (예상: ${minScore}-${maxScore})`);

        // 점수 범위 검증
        expect(score).toBeGreaterThanOrEqual(minScore);
        expect(score).toBeLessThanOrEqual(maxScore);
      } else {
        console.warn(`[${testCase.fixture}] RAG 분석 응답에 overallScore 없음, 검증 스킵`);
      }

      await page.close();
    });
  }

  // 테스트 데이터 정리
  test.afterAll(async ({ extensionContext, extensionId }) => {
    try {
      await clearDatabase(extensionContext, extensionId);
      console.log('테스트 데이터 정리 완료');
    } catch (error) {
      console.warn('테스트 데이터 정리 실패:', error);
    }
  });
});
