import { scrapeCurrentPage, observePageChanges, type ScrapedData } from './scraper';
import { detectSite } from '@/lib/sites';
import { showConfirmPopup } from './confirm-popup';
import { activateAreaCapture } from './area-capture';

function sendScrapedData(data: ScrapedData): void {
  chrome.runtime.sendMessage({ type: 'PAGE_SCRAPED', payload: data });
}

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

  const result = await showConfirmPopup({
    imageDataUrl,
    detectedCompanyName: scrapedData.companyName,
    companyUrl: scrapedData.url,
    siteType: scrapedData.siteType,
    siteName: site.name,
  });

  if (!result) {
    console.log('[AI Company Analyzer] Capture cancelled by user');
    return;
  }

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
    (response) => {
      if (response?.success) {
        console.log('[AI Company Analyzer] Region captured successfully');
      } else {
        console.error('[AI Company Analyzer] Failed to capture region:', response?.error);
        alert(`캡처 저장 실패: ${response?.error || '알 수 없는 오류'}`);
      }
    }
  );
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
      activateAreaCapture();
      sendResponse({ success: true, status: 'area_capture_activated' });
      return true;
    }

    if (message.type === 'AREA_CAPTURED') {
      console.log('[AI Company Analyzer] 영역 캡처 완료, Confirm Popup 표시');
      handleRegionCapture(message.data)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('[AI Company Analyzer] AREA_CAPTURED 처리 오류:', error);
          sendResponse({ success: false, error: error.message });
        });
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
