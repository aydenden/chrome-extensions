// 화면 캡처 핸들러 모듈

/**
 * 캡처 영역 인터페이스
 */
interface CaptureArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 이미지 크롭 함수 (Service Worker 호환 - createImageBitmap 사용)
 */
async function cropImage(
  imageDataUrl: string,
  area: CaptureArea
): Promise<Blob> {
  // Data URL → Blob 변환
  const response = await fetch(imageDataUrl);
  const blob = await response.blob();

  // createImageBitmap 사용 (Service Worker에서 사용 가능)
  const imageBitmap = await createImageBitmap(blob);

  // OffscreenCanvas 생성
  const canvas = new OffscreenCanvas(area.width, area.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('OffscreenCanvas context를 생성할 수 없습니다.');
  }

  // 크롭된 영역 그리기
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

  // ImageBitmap 정리
  imageBitmap.close();

  // Blob 변환
  return canvas.convertToBlob({ type: 'image/png' });
}

/**
 * Blob을 Base64 Data URL로 변환 (Service Worker 안전)
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Uint8Array를 base64로 변환
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);

  return `data:${blob.type};base64,${base64}`;
}

/**
 * CAPTURE_AREA 처리 함수 (async)
 */
async function handleCaptureArea(
  message: { area: CaptureArea },
  sender: chrome.runtime.MessageSender
): Promise<{ status: string; error?: string }> {
  console.log('CAPTURE_AREA 메시지 받음:', message);

  try {
    // 요청을 보낸 탭 확인
    if (!sender.tab?.id || !sender.tab.windowId) {
      throw new Error('탭 정보를 찾을 수 없습니다.');
    }

    const tabId = sender.tab.id;
    const windowId = sender.tab.windowId;

    // 전체 화면 캡처
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    console.log('화면 캡처 완료, 크롭 시작');

    // 이미지 크롭
    const croppedBlob = await cropImage(dataUrl, message.area);

    // Blob → Base64 변환 (FileReader 콜백 대신 arrayBuffer 사용)
    const base64data = await blobToBase64(croppedBlob);
    console.log('Base64 변환 완료, 길이:', base64data.length);

    // Content Script로 결과 전송
    await chrome.tabs.sendMessage(tabId, {
      type: 'AREA_CAPTURED',
      data: base64data,
      area: message.area,
    });

    console.log('캡처된 이미지 전송 완료');
    return { status: 'capture_completed' };
  } catch (error) {
    console.error('캡처 처리 중 오류:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

/**
 * CAPTURE_AREA 메시지 핸들러 등록
 */
export function registerCaptureHandler(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'CAPTURE_AREA') {
      return false;
    }

    // 동기적으로 true 반환, 비동기 처리는 내부에서
    handleCaptureArea(message, sender).then(sendResponse);
    return true; // 동기적으로 반환해야 sendResponse가 유효
  });

  console.log('캡처 핸들러 등록 완료');
}
