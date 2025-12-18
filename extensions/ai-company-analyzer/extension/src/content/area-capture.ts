/**
 * 영역 선택 캡처 모듈
 * Shadow DOM 기반 오버레이로 사용자가 드래그해서 영역을 선택할 수 있게 합니다.
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

function createCaptureUI(): void {
  const shadowHost = document.createElement('div');
  shadowHost.id = 'ai-company-analyzer-capture-ui';
  document.body.appendChild(shadowHost);

  state.shadowRoot = shadowHost.attachShadow({ mode: 'open' });

  const style = createStyles();
  state.shadowRoot.appendChild(style);

  state.overlay = document.createElement('div');
  state.overlay.className = 'capture-overlay';
  state.shadowRoot.appendChild(state.overlay);

  state.selectionBox = document.createElement('div');
  state.selectionBox.className = 'selection-box';
  state.selectionBox.style.display = 'none';
  state.shadowRoot.appendChild(state.selectionBox);

  state.messageBox = document.createElement('div');
  state.messageBox.className = 'message-box';
  state.messageBox.textContent = '캡처할 영역을 드래그하세요. ESC를 누르면 취소됩니다.';
  state.shadowRoot.appendChild(state.messageBox);
}

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

function handleMouseMove(event: MouseEvent): void {
  if (!state.isActive || !state.isDragging) return;

  state.endX = event.clientX;
  state.endY = event.clientY;

  updateSelectionBox();
}

async function handleMouseUp(event: MouseEvent): Promise<void> {
  if (!state.isActive || !state.isDragging) return;

  state.endX = event.clientX;
  state.endY = event.clientY;
  state.isDragging = false;

  const x = Math.min(state.startX, state.endX);
  const y = Math.min(state.startY, state.endY);
  const width = Math.abs(state.endX - state.startX);
  const height = Math.abs(state.endY - state.startY);

  // 최소 크기 검증 (10px x 10px)
  if (width < 10 || height < 10) {
    console.warn('[Area Capture] 선택 영역이 너무 작습니다.');
    deactivateAreaCapture();
    return;
  }

  // devicePixelRatio 적용
  const dpr = window.devicePixelRatio || 1;

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

    deactivateAreaCapture();
  } catch (error) {
    console.error('[Area Capture] 캡처 요청 실패:', error);
    deactivateAreaCapture();
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && state.isActive) {
    console.log('[Area Capture] 캡처 취소됨');
    deactivateAreaCapture();
  }
}

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

export function activateAreaCapture(): void {
  if (state.isActive) {
    console.warn('[Area Capture] 이미 캡처 모드가 활성화되어 있습니다.');
    return;
  }

  console.log('[Area Capture] 영역 선택 모드 활성화');
  state.isActive = true;

  createCaptureUI();

  if (state.overlay) {
    state.overlay.addEventListener('mousedown', handleMouseDown);
    state.overlay.addEventListener('mousemove', handleMouseMove);
    state.overlay.addEventListener('mouseup', handleMouseUp);
  }

  document.addEventListener('keydown', handleKeyDown);
}

export function deactivateAreaCapture(): void {
  if (!state.isActive) return;

  console.log('[Area Capture] 영역 선택 모드 비활성화');
  state.isActive = false;
  state.isDragging = false;

  if (state.overlay) {
    state.overlay.removeEventListener('mousedown', handleMouseDown);
    state.overlay.removeEventListener('mousemove', handleMouseMove);
    state.overlay.removeEventListener('mouseup', handleMouseUp);
  }

  document.removeEventListener('keydown', handleKeyDown);

  removeCaptureUI();
}
