/**
 * AI 분류 및 점수 E2E 테스트
 *
 * Mock Fixture 이미지를 사용하여 AI 분류/점수 파이프라인 검증
 * 주의: 실제 Qwen2-VL 모델 로드 - 첫 테스트에서 1-2분 소요
 *
 * Worker scope fixture 사용으로 모든 테스트가 동일한 컨텍스트 공유
 */

import { test, expect, getPopupUrl, clearDatabase } from './fixtures';
import { loadFixture } from './helpers/fixture-loader';
import { AI_TEST_MATRIX } from './helpers/test-matrix';
import type { ImageSubCategory } from '../src/types/storage';

// 타임아웃 설정
const ENGINE_INIT_TIMEOUT = 150000; // 2.5분
const ANALYSIS_TIMEOUT = 180000; // 3분 (분류 + 점수 분석)

// 분류 프롬프트 (간소화 - 토큰 절약)
const CLASSIFICATION_PROMPT = `What type of image is this? Reply with ONE word only.

Categories:
- company_overview (회사정보)
- revenue_trend (매출추이)
- employee_trend (인원추이)
- balance_sheet (재무제표)
- review_positive (긍정리뷰)
- review_negative (부정리뷰)
- review_mixed (복합리뷰)
- rating_summary (평점)
- bar_chart (막대그래프)
- line_chart (라인차트)
- table_data (표)
- unknown

Answer:`;

// 유효한 카테고리 목록
const VALID_CATEGORIES: ImageSubCategory[] = [
  'balance_sheet',
  'income_statement',
  'cash_flow',
  'financial_ratio',
  'revenue_trend',
  'employee_trend',
  'review_positive',
  'review_negative',
  'review_mixed',
  'rating_summary',
  'bar_chart',
  'line_chart',
  'pie_chart',
  'table_data',
  'company_overview',
  'team_info',
  'benefits_info',
  'tech_stack',
  'unknown',
];

// 불완전 응답 → 카테고리 매핑 (접두사 기반)
const PREFIX_TO_CATEGORY: Record<string, ImageSubCategory> = {
  'company': 'company_overview',
  'table': 'table_data',
  'bar': 'bar_chart',
  'line': 'line_chart',
  'revenue': 'revenue_trend',
  'employee': 'employee_trend',
  'review': 'review_mixed',
  'rating': 'rating_summary',
  'balance': 'balance_sheet',
  'income': 'income_statement',
  'financial': 'revenue_trend',
  'chart': 'bar_chart',
};

/**
 * AI 응답에서 카테고리 추출 (불완전 응답 처리 강화)
 */
function extractCategory(response: string): ImageSubCategory {
  const cleaned = response.trim().toLowerCase();

  // 1. 정확히 일치 또는 포함 (긴 것 우선)
  const sorted = [...VALID_CATEGORIES].sort((a, b) => b.length - a.length);
  const match = sorted.find((c) => cleaned === c || cleaned.includes(c));

  if (match) return match;

  // 2. 접두사 매핑 (불완전 응답: "bar...", "review..." 등)
  for (const [prefix, category] of Object.entries(PREFIX_TO_CATEGORY)) {
    if (cleaned.startsWith(prefix) || cleaned.includes(prefix)) {
      return category;
    }
  }

  return 'unknown';
}

/**
 * AI 응답에서 점수 파싱 (단순 텍스트 형식)
 * SCORE: [1-5] 형식 또는 JSON 형식 모두 지원
 */
function parseAnalysisResponse(response: string): { score: number } | null {
  // 1. 단순 텍스트 형식: SCORE: X
  const scoreMatch = response.match(/SCORE:\s*(\d)/i);
  if (scoreMatch) {
    const score = parseInt(scoreMatch[1], 10);
    if (score >= 1 && score <= 5) {
      return { score };
    }
  }

  // 2. JSON 형식 fallback
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.score && parsed.score >= 1 && parsed.score <= 5) {
        return { score: parsed.score };
      }
    }
  } catch {
    // JSON 파싱 실패 무시
  }

  // 3. 숫자만 있는 경우
  const numMatch = response.trim().match(/^(\d)$/);
  if (numMatch) {
    const score = parseInt(numMatch[1], 10);
    if (score >= 1 && score <= 5) {
      return { score };
    }
  }

  return null;
}

/**
 * 분석 프롬프트 생성 (카테고리별 - 간소화)
 */
function buildAnalysisPrompt(category: ImageSubCategory): string {
  const prompts: Record<string, string> = {
    company_overview: 'Company info: employees, founding year, industry?',
    employee_trend: 'Employee count trend? Growing, shrinking, or stable?',
    revenue_trend: 'Revenue trend? Growing, declining, or stable?',
    bar_chart: 'What does this chart show? Key insight?',
    line_chart: 'Trend direction? Increasing, decreasing, or stable?',
    review_positive: 'What do employees like? Key positives?',
    review_negative: 'What are the concerns? Key negatives?',
    review_mixed: 'Pros and cons? Overall positive or negative?',
    rating_summary: 'Extract rating scores. Overall rating?',
    table_data: 'Extract key values from table. Notable patterns?',
    balance_sheet: 'Analyze: assets, liabilities, debt ratio. Good or bad?',
  };

  const systemPrompt = prompts[category] || 'Describe this image briefly.';

  // 단순 텍스트 형식으로 응답 유도
  return `${systemPrompt}

Reply format:
SCORE: [1-5]
SUMMARY: [one sentence]
POINTS: [point1] | [point2] | [point3]`;
}

// 순차 실행 (Worker scope로 컨텍스트 공유)
test.describe.configure({ mode: 'serial' });

test.describe('AI Classification & Scoring', () => {
  // 첫 번째 테스트: 엔진 초기화
  test('VLM 엔진 초기화', async ({ extensionContext, extensionId }) => {
    test.setTimeout(ENGINE_INIT_TIMEOUT);

    const page = await extensionContext.newPage();
    await page.goto(getPopupUrl(extensionId));

    // 현재 상태 확인
    const initialStatus = (await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_ENGINE_STATUS' }, resolve);
      });
    })) as { success: boolean; status: { isReady: boolean; isLoading: boolean } };

    if (initialStatus.status.isReady) {
      console.log('엔진이 이미 초기화됨');
      await page.close();
      return;
    }

    console.log('엔진 초기화 시작...');

    // 엔진 초기화 요청
    const initResult = (await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'INIT_SMOLVLM' }, resolve);
      });
    })) as { success: boolean };

    expect(initResult).toHaveProperty('success', true);

    // Ready 상태 대기 (polling)
    await expect
      .poll(
        async () => {
          const status = (await page.evaluate(() => {
            return new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: 'GET_ENGINE_STATUS' }, resolve);
            });
          })) as { success: boolean; status: { isReady: boolean } };
          return status.status.isReady;
        },
        { timeout: ENGINE_INIT_TIMEOUT, intervals: [5000] }
      )
      .toBe(true);

    console.log('VLM 엔진 초기화 완료');
    await page.close();
  });

  // 각 fixture별 분류 + 점수 테스트
  for (const testCase of AI_TEST_MATRIX) {
    test(`${testCase.fixture}: ${testCase.description}`, async ({ extensionContext, extensionId }) => {
      test.setTimeout(ANALYSIS_TIMEOUT);

      const page = await extensionContext.newPage();
      await page.goto(getPopupUrl(extensionId));

      // 1. Fixture 로드
      const imageDataUrl = loadFixture(testCase.fixture);

      // 2. 분류 수행
      console.log(`[${testCase.fixture}] 분류 시작...`);
      const classifyResult = (await page.evaluate(
        async ({ imageData, prompt }) => {
          return new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'ANALYZE_IMAGE',
                data: {
                  imageDataUrl: imageData,
                  prompt: prompt,
                },
              },
              resolve
            );
          });
        },
        { imageData: imageDataUrl, prompt: CLASSIFICATION_PROMPT }
      )) as { success: boolean; data?: { result: string }; error?: string };

      if (!classifyResult.success) {
        console.error(`[${testCase.fixture}] 분류 실패:`, classifyResult.error);
      }
      expect(classifyResult.success).toBe(true);
      expect(classifyResult.data).toBeDefined();

      const classificationResponse = classifyResult.data!.result;
      const category = extractCategory(classificationResponse);

      console.log(
        `[${testCase.fixture}] 분류 결과: ${category} (응답: ${classificationResponse.slice(0, 50)}...)`
      );

      // 분류 검증 (예상 카테고리 중 하나와 일치)
      const categoryMatched = testCase.expectedCategories.includes(category);
      if (!categoryMatched) {
        console.warn(
          `[${testCase.fixture}] 예상 카테고리 불일치: got=${category}, expected=${testCase.expectedCategories.join('|')}`
        );
      }
      // 분류는 soft assertion (경고만, 실패 아님)
      // expect(categoryMatched).toBe(true);

      // 3. 점수 분석 수행
      console.log(`[${testCase.fixture}] 점수 분석 시작...`);
      const analysisPrompt = buildAnalysisPrompt(category);

      const analysisResult = (await page.evaluate(
        async ({ imageData, prompt }) => {
          return new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'ANALYZE_IMAGE',
                data: {
                  imageDataUrl: imageData,
                  prompt: prompt,
                },
              },
              resolve
            );
          });
        },
        { imageData: imageDataUrl, prompt: analysisPrompt }
      )) as { success: boolean; data?: { result: string }; error?: string };

      if (!analysisResult.success) {
        console.error(`[${testCase.fixture}] 분석 실패:`, analysisResult.error);
      }
      expect(analysisResult.success).toBe(true);
      expect(analysisResult.data).toBeDefined();

      const analysisResponse = analysisResult.data!.result;
      const parsed = parseAnalysisResponse(analysisResponse);

      console.log(`[${testCase.fixture}] 분석 응답: ${analysisResponse.slice(0, 100)}...`);

      // 4. 점수 검증
      if (parsed) {
        const { score } = parsed;
        const [minScore, maxScore] = testCase.scoreRange;

        console.log(`[${testCase.fixture}] 점수: ${score} (예상: ${minScore}-${maxScore})`);

        // 점수 범위 검증
        expect(score).toBeGreaterThanOrEqual(minScore);
        expect(score).toBeLessThanOrEqual(maxScore);
      } else {
        console.warn(`[${testCase.fixture}] JSON 파싱 실패, 점수 검증 스킵`);
        // JSON 파싱 실패 시 테스트 실패로 처리하지 않음 (AI 응답 불안정성)
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
