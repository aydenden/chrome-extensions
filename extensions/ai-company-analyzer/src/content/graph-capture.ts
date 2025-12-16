// 그래프 캡처 모듈
import { Canvg } from 'canvg';
import { showConfirmPopup } from './confirm-popup';

/**
 * 캡처 상태 인터페이스
 */
interface CaptureState {
  isActive: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isDragging: boolean;
  shadowRoot: ShadowRoot | null;
  overlay: HTMLDivElement | null;
  selectionBox: HTMLDivElement | null;
  messageBox: HTMLDivElement | null;
}

/**
 * 캡처 상태 초기화
 */
const state: CaptureState = {
  isActive: false,
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  isDragging: false,
  shadowRoot: null,
  overlay: null,
  selectionBox: null,
  messageBox: null,
};

/**
 * SVG 요소를 Canvas로 변환 후 Blob 반환
 */
export async function captureSvgElement(svgElement: SVGElement): Promise<Blob> {
  // SVG 직렬화
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);

  // SVG 크기 가져오기
  const bbox = svgElement.getBoundingClientRect();
  const width = bbox.width;
  const height = bbox.height;

  // devicePixelRatio 적용
  const dpr = window.devicePixelRatio || 1;

  // Canvas 생성
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context를 생성할 수 없습니다.');
  }

  // canvg로 SVG 렌더링
  const v = await Canvg.from(ctx, svgString, {
    scaleWidth: width * dpr,
    scaleHeight: height * dpr,
  });

  await v.render();

  // Canvas → Blob 변환
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Blob 변환 실패'));
      }
    }, 'image/png');
  });
}

/**
 * Shadow DOM에 스타일 추가
 */
function createStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .capture-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      cursor: crosshair;
      z-index: 2147483647;
      background: rgba(0, 0, 0, 0.1);
    }

    .selection-box {
      position: fixed;
      border: 2px dashed #4285f4;
      background: rgba(66, 133, 244, 0.1);
      pointer-events: none;
      z-index: 2147483647;
    }

    .message-box {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483648;
      pointer-events: none;
    }
  `;
  return style;
}

/**
 * Shadow DOM UI 생성
 */
function createCaptureUI(): void {
  // Shadow Host 생성
  const shadowHost = document.createElement('div');
  shadowHost.id = 'ai-company-analyzer-capture-ui';
  document.body.appendChild(shadowHost);

  // Shadow Root 생성
  state.shadowRoot = shadowHost.attachShadow({ mode: 'open' });

  // 스타일 추가
  const style = createStyles();
  state.shadowRoot.appendChild(style);

  // 오버레이 생성
  state.overlay = document.createElement('div');
  state.overlay.className = 'capture-overlay';
  state.shadowRoot.appendChild(state.overlay);

  // 선택 박스 생성
  state.selectionBox = document.createElement('div');
  state.selectionBox.className = 'selection-box';
  state.selectionBox.style.display = 'none';
  state.shadowRoot.appendChild(state.selectionBox);

  // 안내 메시지 생성
  state.messageBox = document.createElement('div');
  state.messageBox.className = 'message-box';
  state.messageBox.textContent = '캡처할 영역을 드래그하세요. ESC를 누르면 취소됩니다.';
  state.shadowRoot.appendChild(state.messageBox);
}

/**
 * Shadow DOM UI 제거
 */
function removeCaptureUI(): void {
  const shadowHost = document.getElementById('ai-company-analyzer-capture-ui');
  if (shadowHost) {
    shadowHost.remove();
  }

  state.shadowRoot = null;
  state.overlay = null;
  state.selectionBox = null;
  state.messageBox = null;
}

/**
 * 마우스 다운 핸들러
 */
function handleMouseDown(event: MouseEvent): void {
  if (!state.isActive || !state.overlay) return;

  state.isDragging = true;
  state.startX = event.clientX;
  state.startY = event.clientY;
  state.endX = event.clientX;
  state.endY = event.clientY;

  if (state.selectionBox) {
    state.selectionBox.style.display = 'block';
    updateSelectionBox();
  }
}

/**
 * 마우스 이동 핸들러
 */
function handleMouseMove(event: MouseEvent): void {
  if (!state.isActive || !state.isDragging) return;

  state.endX = event.clientX;
  state.endY = event.clientY;

  updateSelectionBox();
}

/**
 * 마우스 업 핸들러
 */
async function handleMouseUp(event: MouseEvent): Promise<void> {
  if (!state.isActive || !state.isDragging) return;

  state.endX = event.clientX;
  state.endY = event.clientY;
  state.isDragging = false;

  // 선택 영역 계산
  const x = Math.min(state.startX, state.endX);
  const y = Math.min(state.startY, state.endY);
  const width = Math.abs(state.endX - state.startX);
  const height = Math.abs(state.endY - state.startY);

  // 최소 크기 검증 (10px x 10px)
  if (width < 10 || height < 10) {
    console.warn('선택 영역이 너무 작습니다.');
    deactivateAreaCapture();
    return;
  }

  // devicePixelRatio 적용
  const dpr = window.devicePixelRatio || 1;

  // Background에 캡처 요청
  try {
    chrome.runtime.sendMessage({
      type: 'CAPTURE_AREA',
      area: {
        x: x * dpr,
        y: y * dpr,
        width: width * dpr,
        height: height * dpr,
      },
    });

    // UI 비활성화
    deactivateAreaCapture();
  } catch (error) {
    console.error('캡처 요청 실패:', error);
    deactivateAreaCapture();
  }
}

/**
 * 키보드 핸들러 (ESC 취소)
 */
function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && state.isActive) {
    console.log('캡처 취소됨');
    deactivateAreaCapture();
  }
}

/**
 * 선택 박스 업데이트
 */
function updateSelectionBox(): void {
  if (!state.selectionBox) return;

  const x = Math.min(state.startX, state.endX);
  const y = Math.min(state.startY, state.endY);
  const width = Math.abs(state.endX - state.startX);
  const height = Math.abs(state.endY - state.startY);

  state.selectionBox.style.left = `${x}px`;
  state.selectionBox.style.top = `${y}px`;
  state.selectionBox.style.width = `${width}px`;
  state.selectionBox.style.height = `${height}px`;
}

/**
 * 영역 선택 모드 활성화
 */
export function activateAreaCapture(): void {
  if (state.isActive) {
    console.warn('이미 캡처 모드가 활성화되어 있습니다.');
    return;
  }

  console.log('영역 선택 모드 활성화');
  state.isActive = true;

  // UI 생성
  createCaptureUI();

  // 이벤트 리스너 등록
  if (state.overlay) {
    state.overlay.addEventListener('mousedown', handleMouseDown);
    state.overlay.addEventListener('mousemove', handleMouseMove);
    state.overlay.addEventListener('mouseup', handleMouseUp);
  }

  document.addEventListener('keydown', handleKeyDown);
}

/**
 * 영역 선택 모드 비활성화
 */
export function deactivateAreaCapture(): void {
  if (!state.isActive) return;

  console.log('영역 선택 모드 비활성화');
  state.isActive = false;
  state.isDragging = false;

  // 이벤트 리스너 제거
  if (state.overlay) {
    state.overlay.removeEventListener('mousedown', handleMouseDown);
    state.overlay.removeEventListener('mousemove', handleMouseMove);
    state.overlay.removeEventListener('mouseup', handleMouseUp);
  }

  document.removeEventListener('keydown', handleKeyDown);

  // UI 제거
  removeCaptureUI();
}

/**
 * 메시지 리스너 등록
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTIVATE_AREA_CAPTURE') {
    console.log('영역 캡처 모드 활성화 요청 받음');
    activateAreaCapture();
    sendResponse({ status: 'area_capture_activated' });
    return true;
  }

  if (message.type === 'AREA_CAPTURED') {
    console.log('영역 캡처 완료:', message);

    // 캡처된 이미지 데이터를 Blob으로 변환
    if (message.data && typeof message.data === 'string') {
      fetch(message.data)
        .then((res) => res.blob())
        .then((blob) => {
          // 컨펌 팝업 표시
          showConfirmPopup({
            data: blob,
            source: window.location.href,
          });
          sendResponse({ status: 'received' });
        })
        .catch((err) => {
          console.error('Blob 변환 실패:', err);
          sendResponse({ status: 'error', error: err.message });
        });
      return true; // 비동기 응답
    }

    sendResponse({ status: 'received' });
    return true;
  }
});
