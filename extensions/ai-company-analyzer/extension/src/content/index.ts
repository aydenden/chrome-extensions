import { scrapeCurrentPage, observePageChanges, type ScrapedData } from './scraper';
import { detectSite } from '@/lib/sites';
import { showConfirmPopup } from './confirm-popup';
import { activateAreaCapture } from './area-capture';
import { showToast } from './toast';

function sendScrapedData(data: ScrapedData): void {
  chrome.runtime.sendMessage({ type: 'PAGE_SCRAPED', payload: data });
}

// 캡처 컨텍스트: TRIGGER_CAPTURE에서 받은 정보 저장
interface CaptureContext {
  companyName: string;
  companyId?: string;
  quickCapture: boolean;
  continuousCapture: boolean;
}

// === 공통 유틸리티 함수들 ===
const CONTEXT_STORAGE_KEY = 'captureContext';
let captureContext: CaptureContext | null = null;

// Context 저장 (메모리 + Storage)
async function setCaptureContext(context: CaptureContext): Promise<void> {
  captureContext = context;
  await chrome.storage.local.set({ [CONTEXT_STORAGE_KEY]: context });
}

// Context 조회 (메모리 우선, Storage 폴백)
async function getCaptureContext(): Promise<CaptureContext | null> {
  if (captureContext) return captureContext;
  const result = await chrome.storage.local.get(CONTEXT_STORAGE_KEY);
  return result[CONTEXT_STORAGE_KEY] ?? null;
}

// Context 초기화
async function clearCaptureContext(): Promise<void> {
  captureContext = null;
  await chrome.storage.local.remove(CONTEXT_STORAGE_KEY);
}

// 캡처 완료 후 공통 처리 (연속 캡처 지원)
async function handlePostCapture(context: CaptureContext | null): Promise<void> {
  showToast('캡처 저장 완료');

  if (context?.continuousCapture) {
    const captureCount = await incrementSessionCaptureCount();
    chrome.runtime.sendMessage({ type: 'CAPTURE_COMPLETE', captureCount });

    // 연속 캡처: 영역 선택 모드 재활성화
    setTimeout(() => activateAreaCapture(), 300);
  }
}

// 연속 캡처 세션 카운터 증가 (chrome.storage.local 직접 사용)
const SESSION_KEY = 'continuousCaptureSession';

async function incrementSessionCaptureCount(): Promise<number> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  const session = result[SESSION_KEY];

  if (!session || !session.active) {
    return 0;
  }

  const updatedSession = {
    ...session,
    captureCount: session.captureCount + 1,
  };
  await chrome.storage.local.set({ [SESSION_KEY]: updatedSession });
  return updatedSession.captureCount;
}

// 빠른 캡처: 확인 팝업 없이 바로 저장
async function handleQuickCapture(
  imageDataUrl: string,
  context: CaptureContext
): Promise<void> {
  const scrapedData = scrapeCurrentPage();
  if (!scrapedData) {
    showToast('페이지 정보를 찾을 수 없습니다', 'error');
    return;
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'CAPTURE_REGION',
        payload: {
          dataUrl: imageDataUrl,
          companyName: context.companyName,
          companyUrl: scrapedData.url,
          siteType: scrapedData.siteType,
          existingCompanyId: context.companyId,
        },
      },
      async (response) => {
        if (response?.success) {
          console.log('[AI Company Analyzer] Quick capture saved');
          await handlePostCapture(context);  // 공통 함수 사용
          resolve();
        } else {
          console.error('[AI Company Analyzer] Quick capture failed:', response?.error);
          showToast(`저장 실패: ${response?.error || '알 수 없는 오류'}`, 'error');
          reject(new Error(response?.error));
        }
      }
    );
  });
}

// 일반 캡처: 확인 팝업 표시
async function handleRegionCapture(imageDataUrl: string): Promise<void> {
  const site = detectSite(window.location.href);
  if (!site) {
    console.error('[AI Company Analyzer] Not a supported site');
    return;
  }

  const scrapedData = scrapeCurrentPage();
  if (!scrapedData || !scrapedData.companyName) {
    alert('회사 정보를 찾을 수 없습니다.');
    return;
  }

  const context = await getCaptureContext();

  const result = await showConfirmPopup({
    imageDataUrl,
    detectedCompanyName: context?.companyName || scrapedData.companyName,
    companyUrl: scrapedData.url,
    siteType: scrapedData.siteType,
    siteName: site.name,
  });

  if (!result) {
    console.log('[AI Company Analyzer] Capture cancelled by user');
    return;
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'CAPTURE_REGION',
        payload: {
          dataUrl: imageDataUrl,
          companyName: result.companyName,
          companyUrl: scrapedData.url,
          siteType: scrapedData.siteType,
          existingCompanyId: result.existingCompanyId,
        },
      },
      async (response) => {
        if (response?.success) {
          console.log('[AI Company Analyzer] Region captured successfully');
          await handlePostCapture(context);  // 공통 함수 사용
          resolve();
        } else {
          console.error('[AI Company Analyzer] Failed to capture region:', response?.error);
          alert(`캡처 저장 실패: ${response?.error || '알 수 없는 오류'}`);
          reject(new Error(response?.error));
        }
      }
    );
  });
}

function init(): void {
  const site = detectSite(window.location.href);
  if (!site) {
    console.log('[AI Company Analyzer] Not a supported site');
    return;
  }
  console.log(`[AI Company Analyzer] Detected: ${site.name}`);
  observePageChanges(sendScrapedData);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_PAGE_DATA') {
      const data = scrapeCurrentPage();
      sendResponse(data);
      return true;
    }

    if (message.type === 'TRIGGER_CAPTURE') {
      console.log('[AI Company Analyzer] 영역 선택 캡처 모드 활성화');

      // 캡처 컨텍스트 저장 (async)
      const payload = message.payload || {};
      (async () => {
        await setCaptureContext({
          companyName: payload.companyName || '',
          companyId: payload.companyId,
          quickCapture: payload.quickCapture || false,
          continuousCapture: payload.continuousCapture || false,
        });

        activateAreaCapture();
        sendResponse({ success: true, status: 'area_capture_activated' });
      })();
      return true;
    }

    if (message.type === 'AREA_CAPTURED') {
      // async 처리
      (async () => {
        const context = await getCaptureContext();

        // 디버깅 로그
        console.log('[AI Company Analyzer] Context:', {
          exists: !!context,
          quickCapture: context?.quickCapture,
          companyId: context?.companyId,
          continuousCapture: context?.continuousCapture,
        });

        try {
          // 빠른 캡처 또는 연속 캡처 모드: 확인 팝업 스킵
          if ((context?.quickCapture || context?.continuousCapture) && context.companyId) {
            console.log('[AI Company Analyzer] 빠른/연속 캡처 모드: 확인 팝업 스킵');
            await handleQuickCapture(message.data, context);
          } else {
            // 일반 캡처: 확인 팝업 표시
            console.log('[AI Company Analyzer] 영역 캡처 완료, Confirm Popup 표시');
            await handleRegionCapture(message.data);
          }
          sendResponse({ success: true });
        } catch (error) {
          console.error('[AI Company Analyzer] 캡처 처리 오류:', error);
          sendResponse({ success: false, error: (error as Error).message });
        }
      })();
      return true;
    }

    if (message.type === 'CAPTURE_REGION_START') {
      handleRegionCapture(message.payload.imageDataUrl)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('[AI Company Analyzer] handleRegionCapture error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }

    return false;
  });
}

init();
