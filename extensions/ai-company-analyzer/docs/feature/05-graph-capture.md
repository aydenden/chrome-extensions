# 05. 그래프 캡처

## 개요
canvg (SVG) + captureVisibleTab (영역) 기반 그래프 캡처 구현

## 선행 조건
- 02-data-storage 완료

## 기술 스택
| 분류 | 기술 | 용도 |
|------|------|------|
| SVG 캡처 | canvg v4.0.3 | SVG → Canvas 변환 |
| 영역 캡처 | chrome.tabs.captureVisibleTab | 브라우저 렌더링 캡처 |
| 영역 선택 | 직접 구현 | 크로스헤어 드래그 UI |

---

## 캡처 방식

### 1. SVG 그래프 캡처 (canvg)
원티드, 혁신의숲 등의 SVG 차트 캡처

### 2. 영역 선택 캡처 (captureVisibleTab)
일반 그래프, 테이블 등 영역 캡처

---

## 구현

### src/content/graph-capture.ts

```typescript
import { Canvg } from 'canvg';

interface CaptureState {
  isActive: boolean;
  startX: number;
  startY: number;
  shadowHost: HTMLDivElement | null;
  shadowRoot: ShadowRoot | null;
  selectionBox: HTMLDivElement | null;
  crosshair: HTMLDivElement | null;
}

const state: CaptureState = {
  isActive: false,
  startX: 0,
  startY: 0,
  shadowHost: null,
  shadowRoot: null,
  selectionBox: null,
  crosshair: null,
};

/**
 * SVG 요소를 이미지로 변환
 */
export async function captureSvgElement(svgElement: SVGElement): Promise<Blob> {
  // SVG를 문자열로 직렬화
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);

  // Canvas 생성
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // SVG 크기 가져오기
  const bbox = svgElement.getBoundingClientRect();
  canvas.width = bbox.width * window.devicePixelRatio;
  canvas.height = bbox.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // canvg로 SVG → Canvas 렌더링
  const canvgInstance = await Canvg.from(ctx, svgString, {
    ignoreMouse: true,
    ignoreAnimation: true,
    ignoreDimensions: true,
    scaleWidth: bbox.width,
    scaleHeight: bbox.height,
  });

  await canvgInstance.render();

  // Canvas → Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas to Blob 변환 실패'));
      }
    }, 'image/png');
  });
}

/**
 * 영역 선택 캡처 모드 활성화
 */
export function activateAreaCapture(): void {
  if (state.isActive) return;

  state.isActive = true;

  createCaptureUI();
  attachCaptureEvents();
}

/**
 * 영역 선택 캡처 모드 비활성화
 */
export function deactivateAreaCapture(): void {
  if (!state.isActive) return;

  state.isActive = false;

  removeCaptureEvents();
  removeCaptureUI();
}

/**
 * 캡처 UI 생성
 */
function createCaptureUI(): void {
  state.shadowHost = document.createElement('div');
  state.shadowHost.id = 'ai-company-analyzer-capture';
  document.body.appendChild(state.shadowHost);

  state.shadowRoot = state.shadowHost.attachShadow({ mode: 'closed' });

  // 스타일
  const style = document.createElement('style');
  style.textContent = getCaptureStyles();
  state.shadowRoot.appendChild(style);

  // 크로스헤어 커서 오버레이
  state.crosshair = document.createElement('div');
  state.crosshair.className = 'crosshair-overlay';
  state.shadowRoot.appendChild(state.crosshair);

  // 선택 영역 박스
  state.selectionBox = document.createElement('div');
  state.selectionBox.className = 'selection-box';
  state.shadowRoot.appendChild(state.selectionBox);

  // 안내 메시지
  const guide = document.createElement('div');
  guide.className = 'capture-guide';
  guide.textContent = '캡처할 영역을 드래그하세요 (ESC: 취소)';
  state.shadowRoot.appendChild(guide);
}

/**
 * 캡처 UI 제거
 */
function removeCaptureUI(): void {
  if (state.shadowHost) {
    state.shadowHost.remove();
    state.shadowHost = null;
    state.shadowRoot = null;
    state.selectionBox = null;
    state.crosshair = null;
  }
}

/**
 * 캡처 이벤트 등록
 */
function attachCaptureEvents(): void {
  document.addEventListener('mousedown', handleMouseDown, { capture: true });
  document.addEventListener('mousemove', handleMouseMove, { capture: true });
  document.addEventListener('mouseup', handleMouseUp, { capture: true });
  document.addEventListener('keydown', handleKeyDown, { capture: true });
}

/**
 * 캡처 이벤트 제거
 */
function removeCaptureEvents(): void {
  document.removeEventListener('mousedown', handleMouseDown, { capture: true });
  document.removeEventListener('mousemove', handleMouseMove, { capture: true });
  document.removeEventListener('mouseup', handleMouseUp, { capture: true });
  document.removeEventListener('keydown', handleKeyDown, { capture: true });
}

/**
 * 마우스 다운 핸들러 (드래그 시작)
 */
function handleMouseDown(event: MouseEvent): void {
  if (!state.isActive) return;

  event.preventDefault();
  event.stopPropagation();

  state.startX = event.clientX;
  state.startY = event.clientY;

  if (state.selectionBox) {
    state.selectionBox.style.display = 'block';
    state.selectionBox.style.left = `${state.startX}px`;
    state.selectionBox.style.top = `${state.startY}px`;
    state.selectionBox.style.width = '0';
    state.selectionBox.style.height = '0';
  }
}

/**
 * 마우스 이동 핸들러 (드래그 중)
 */
function handleMouseMove(event: MouseEvent): void {
  if (!state.isActive || !state.selectionBox) return;

  const currentX = event.clientX;
  const currentY = event.clientY;

  const left = Math.min(state.startX, currentX);
  const top = Math.min(state.startY, currentY);
  const width = Math.abs(currentX - state.startX);
  const height = Math.abs(currentY - state.startY);

  state.selectionBox.style.left = `${left}px`;
  state.selectionBox.style.top = `${top}px`;
  state.selectionBox.style.width = `${width}px`;
  state.selectionBox.style.height = `${height}px`;
}

/**
 * 마우스 업 핸들러 (드래그 완료)
 */
async function handleMouseUp(event: MouseEvent): Promise<void> {
  if (!state.isActive || !state.selectionBox) return;

  event.preventDefault();
  event.stopPropagation();

  const rect = state.selectionBox.getBoundingClientRect();

  // 최소 크기 체크
  if (rect.width < 10 || rect.height < 10) {
    state.selectionBox.style.display = 'none';
    return;
  }

  // UI 숨기기 (캡처에 포함되지 않도록)
  state.selectionBox.style.display = 'none';
  if (state.crosshair) state.crosshair.style.display = 'none';

  // 캡처 요청 (Background로)
  chrome.runtime.sendMessage({
    type: 'CAPTURE_AREA',
    payload: {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      devicePixelRatio: window.devicePixelRatio,
    },
  });

  deactivateAreaCapture();
}

/**
 * 키보드 핸들러
 */
function handleKeyDown(event: KeyboardEvent): void {
  if (!state.isActive) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    deactivateAreaCapture();
  }
}

/**
 * 스타일 정의
 */
function getCaptureStyles(): string {
  return `
    .crosshair-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      cursor: crosshair;
      z-index: 999998;
    }

    .selection-box {
      position: fixed;
      border: 2px dashed #4285f4;
      background: rgba(66, 133, 244, 0.1);
      z-index: 999999;
      display: none;
    }

    .capture-guide {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 999999;
    }
  `;
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTIVATE_AREA_CAPTURE') {
    activateAreaCapture();
    sendResponse({ success: true });
  }
  return true;
});
```

### src/background/capture-handler.ts

```typescript
/**
 * 영역 캡처 처리 (Background Service Worker)
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_AREA') {
    handleAreaCapture(message.payload, sender.tab!.id!);
  }
  return true;
});

async function handleAreaCapture(
  payload: { x: number; y: number; width: number; height: number; devicePixelRatio: number },
  tabId: number
): Promise<void> {
  try {
    // 현재 탭 캡처
    const dataUrl = await chrome.tabs.captureVisibleTab({
      format: 'png',
    });

    // 영역 크롭
    const croppedBlob = await cropImage(
      dataUrl,
      payload.x,
      payload.y,
      payload.width,
      payload.height,
      payload.devicePixelRatio
    );

    // Content Script로 결과 전송
    chrome.tabs.sendMessage(tabId, {
      type: 'AREA_CAPTURED',
      payload: {
        blob: croppedBlob,
        url: (await chrome.tabs.get(tabId)).url,
      },
    });
  } catch (error) {
    console.error('영역 캡처 실패:', error);
  }
}

/**
 * 이미지 크롭
 */
async function cropImage(
  dataUrl: string,
  x: number,
  y: number,
  width: number,
  height: number,
  dpr: number
): Promise<Blob> {
  // OffscreenCanvas 사용 (Service Worker에서)
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(width * dpr, height * dpr);
  const ctx = canvas.getContext('2d')!;

  // 크롭 영역 그리기
  ctx.drawImage(
    imageBitmap,
    x * dpr,        // 소스 x
    y * dpr,        // 소스 y
    width * dpr,    // 소스 width
    height * dpr,   // 소스 height
    0,              // 대상 x
    0,              // 대상 y
    width * dpr,    // 대상 width
    height * dpr    // 대상 height
  );

  return canvas.convertToBlob({ type: 'image/png' });
}
```

---

## 메시지 흐름

```
1. 팝업 → Content Script: ACTIVATE_AREA_CAPTURE
2. Content Script: 영역 선택 UI 표시
3. 사용자: 드래그로 영역 선택
4. Content Script → Background: CAPTURE_AREA (좌표 정보)
5. Background: captureVisibleTab + 크롭
6. Background → Content Script: AREA_CAPTURED (Blob)
7. Content Script → Background: 저장 요청
```

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/content/graph-capture.ts` | 영역 선택 UI + SVG 캡처 |
| `src/background/capture-handler.ts` | captureVisibleTab 처리 |

---

## 참조 문서
- [spec/02-data-extraction.md](../spec/02-data-extraction.md) - 데이터 추출
- [research/02-graph-capture.md](../research/02-graph-capture.md) - 그래프 캡처 기술 조사
