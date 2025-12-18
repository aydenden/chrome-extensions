// Service Worker 진입점
import { db } from '@/lib/db';
import { getStats, getAllCompanies } from '@/lib/storage';
import { initExternalApi } from './external-api';
import { captureAndSave, captureRegion, captureFullScreen } from './capture-service';

console.log('AI Company Analyzer Extension loaded');
console.log('DB initialized:', db.name);

// Initialize External API
initExternalApi();

// ============================================================================
// 이미지 crop 유틸리티 함수
// ============================================================================

interface CaptureArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function cropImage(imageDataUrl: string, area: CaptureArea): Promise<Blob> {
  const response = await fetch(imageDataUrl);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(area.width, area.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('OffscreenCanvas context를 생성할 수 없습니다.');
  }

  ctx.drawImage(
    imageBitmap,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height
  );

  imageBitmap.close();

  return canvas.convertToBlob({ type: 'image/png' });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);

  return `data:${blob.type};base64,${base64}`;
}

async function handleCaptureArea(
  message: { area: CaptureArea },
  sender: chrome.runtime.MessageSender
): Promise<{ status: string; error?: string }> {
  console.log('[Background] CAPTURE_AREA 메시지 받음:', message);

  try {
    if (!sender.tab?.id || !sender.tab.windowId) {
      throw new Error('탭 정보를 찾을 수 없습니다.');
    }

    const tabId = sender.tab.id;
    const windowId = sender.tab.windowId;

    const dataUrl = await captureFullScreen(windowId);
    console.log('[Background] 화면 캡처 완료, 크롭 시작');

    const croppedBlob = await cropImage(dataUrl, message.area);
    const base64data = await blobToBase64(croppedBlob);
    console.log('[Background] Base64 변환 완료, 길이:', base64data.length);

    await chrome.tabs.sendMessage(tabId, {
      type: 'AREA_CAPTURED',
      data: base64data,
      area: message.area,
    });

    console.log('[Background] 캡처된 이미지 전송 완료');
    return { status: 'capture_completed' };
  } catch (error) {
    console.error('[Background] 캡처 처리 중 오류:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

// ============================================================================
// 내부 메시지 핸들러 (Content Script → Service Worker)
// ============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_SCREENSHOT') {
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    if (!tabId || !windowId) {
      sendResponse({ success: false, error: 'No tab ID or window ID' });
      return true;
    }
    captureAndSave({
      tabId,
      windowId,
      companyName: message.payload.companyName,
      companyUrl: message.payload.companyUrl,
      siteType: message.payload.siteType,
      existingCompanyId: message.payload.existingCompanyId,
    }).then(sendResponse);
    return true;
  }

  if (message.type === 'CAPTURE_REGION') {
    captureRegion({
      dataUrl: message.payload.dataUrl,
      companyName: message.payload.companyName,
      companyUrl: message.payload.companyUrl,
      siteType: message.payload.siteType,
      existingCompanyId: message.payload.existingCompanyId,
    }).then(sendResponse);
    return true;
  }

  if (message.type === 'CAPTURE_AREA') {
    handleCaptureArea(message, sender).then(sendResponse);
    return true;
  }

  if (message.type === 'GET_STATS_INTERNAL') {
    getStats()
      .then((stats) => {
        sendResponse({ success: true, stats });
      })
      .catch((error) => {
        console.error('[Background] GET_STATS_INTERNAL error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'GET_COMPANIES_INTERNAL') {
    getAllCompanies()
      .then((companies) => {
        sendResponse({ success: true, companies });
      })
      .catch((error) => {
        console.error('[Background] GET_COMPANIES_INTERNAL error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  return false;
});

export {};
