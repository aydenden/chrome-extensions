# 04. 요소 선택 모드

## 개요
Shadow DOM 기반 요소 선택 모드 구현 (텍스트 추출용)

## 선행 조건
- 02-data-storage 완료

## 기술 결정
| 항목 | 결정 | 이유 |
|------|------|------|
| 구현 방식 | 직접 구현 | 번들 크기 최소화, 커스터마이징 용이 |
| 스타일 격리 | Shadow DOM | 페이지 CSS 영향 방지 |
| 이벤트 처리 | capture 단계 | 페이지 이벤트 핸들러보다 먼저 실행 |

---

## 동작 방식

1. **활성화**: 팝업에서 "텍스트 추출" 버튼 클릭
2. **호버**: 마우스 이동 시 해당 요소 하이라이트
3. **선택**: 클릭으로 요소 선택 (Shift+클릭으로 다중 선택)
4. **완료**: 플로팅 버튼으로 완료/취소
5. **추출**: 선택된 요소들의 텍스트 추출

---

## 구현

### src/content/element-picker.ts

```typescript
interface PickerState {
  isActive: boolean;
  selectedElements: HTMLElement[];
  shadowHost: HTMLDivElement | null;
  shadowRoot: ShadowRoot | null;
  highlightOverlay: HTMLDivElement | null;
  floatingButtons: HTMLDivElement | null;
}

const state: PickerState = {
  isActive: false,
  selectedElements: [],
  shadowHost: null,
  shadowRoot: null,
  highlightOverlay: null,
  floatingButtons: null,
};

/**
 * 요소 선택 모드 활성화
 */
export function activatePicker(): void {
  if (state.isActive) return;

  state.isActive = true;
  state.selectedElements = [];

  createShadowDOM();
  attachEventListeners();
  showFloatingButtons();
}

/**
 * 요소 선택 모드 비활성화
 */
export function deactivatePicker(): void {
  if (!state.isActive) return;

  state.isActive = false;

  removeEventListeners();
  removeShadowDOM();

  state.selectedElements = [];
}

/**
 * Shadow DOM 생성 (스타일 격리)
 */
function createShadowDOM(): void {
  // 호스트 요소 생성
  state.shadowHost = document.createElement('div');
  state.shadowHost.id = 'ai-company-analyzer-picker';
  document.body.appendChild(state.shadowHost);

  // Shadow Root 생성
  state.shadowRoot = state.shadowHost.attachShadow({ mode: 'closed' });

  // 스타일 삽입
  const style = document.createElement('style');
  style.textContent = getPickerStyles();
  state.shadowRoot.appendChild(style);

  // 하이라이트 오버레이 생성
  state.highlightOverlay = document.createElement('div');
  state.highlightOverlay.className = 'highlight-overlay';
  state.shadowRoot.appendChild(state.highlightOverlay);

  // 플로팅 버튼 컨테이너 생성
  state.floatingButtons = document.createElement('div');
  state.floatingButtons.className = 'floating-buttons';
  state.floatingButtons.innerHTML = `
    <button class="btn-complete">완료 (${state.selectedElements.length}개)</button>
    <button class="btn-cancel">취소</button>
  `;
  state.shadowRoot.appendChild(state.floatingButtons);
}

/**
 * Shadow DOM 제거
 */
function removeShadowDOM(): void {
  if (state.shadowHost) {
    state.shadowHost.remove();
    state.shadowHost = null;
    state.shadowRoot = null;
    state.highlightOverlay = null;
    state.floatingButtons = null;
  }
}

/**
 * 이벤트 리스너 등록
 */
function attachEventListeners(): void {
  // capture: true로 페이지 이벤트보다 먼저 처리
  document.addEventListener('mousemove', handleMouseMove, { capture: true });
  document.addEventListener('click', handleClick, { capture: true });
  document.addEventListener('keydown', handleKeyDown, { capture: true });

  // 플로팅 버튼 이벤트
  const completeBtn = state.floatingButtons?.querySelector('.btn-complete');
  const cancelBtn = state.floatingButtons?.querySelector('.btn-cancel');

  completeBtn?.addEventListener('click', handleComplete);
  cancelBtn?.addEventListener('click', handleCancel);
}

/**
 * 이벤트 리스너 제거
 */
function removeEventListeners(): void {
  document.removeEventListener('mousemove', handleMouseMove, { capture: true });
  document.removeEventListener('click', handleClick, { capture: true });
  document.removeEventListener('keydown', handleKeyDown, { capture: true });
}

/**
 * 마우스 이동 핸들러 (호버 하이라이트)
 */
function handleMouseMove(event: MouseEvent): void {
  if (!state.isActive || !state.highlightOverlay) return;

  const target = event.target as HTMLElement;

  // Shadow DOM 내부 요소는 무시
  if (state.shadowHost?.contains(target)) return;

  // 하이라이트 위치 업데이트
  const rect = target.getBoundingClientRect();
  state.highlightOverlay.style.cssText = `
    display: block;
    top: ${rect.top + window.scrollY}px;
    left: ${rect.left + window.scrollX}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
  `;
}

/**
 * 클릭 핸들러 (요소 선택)
 */
function handleClick(event: MouseEvent): void {
  if (!state.isActive) return;

  const target = event.target as HTMLElement;

  // Shadow DOM 내부 클릭은 무시
  if (state.shadowHost?.contains(target)) return;

  // 이벤트 전파 중단 (페이지 동작 방지)
  event.preventDefault();
  event.stopPropagation();

  // Shift+클릭: 다중 선택
  if (event.shiftKey) {
    toggleElementSelection(target);
  } else {
    // 일반 클릭: 단일 선택 (기존 선택 유지)
    addElementSelection(target);
  }

  updateButtonCount();
}

/**
 * 키보드 핸들러
 */
function handleKeyDown(event: KeyboardEvent): void {
  if (!state.isActive) return;

  // ESC: 취소
  if (event.key === 'Escape') {
    event.preventDefault();
    handleCancel();
  }

  // Enter: 완료
  if (event.key === 'Enter') {
    event.preventDefault();
    handleComplete();
  }
}

/**
 * 요소 선택 추가
 */
function addElementSelection(element: HTMLElement): void {
  if (!state.selectedElements.includes(element)) {
    state.selectedElements.push(element);
    element.style.outline = '2px solid #4CAF50';
    element.style.outlineOffset = '2px';
  }
}

/**
 * 요소 선택 토글 (Shift+클릭)
 */
function toggleElementSelection(element: HTMLElement): void {
  const index = state.selectedElements.indexOf(element);

  if (index > -1) {
    // 선택 해제
    state.selectedElements.splice(index, 1);
    element.style.outline = '';
    element.style.outlineOffset = '';
  } else {
    // 선택 추가
    addElementSelection(element);
  }
}

/**
 * 버튼 카운트 업데이트
 */
function updateButtonCount(): void {
  const completeBtn = state.floatingButtons?.querySelector('.btn-complete');
  if (completeBtn) {
    completeBtn.textContent = `완료 (${state.selectedElements.length}개)`;
  }
}

/**
 * 완료 핸들러
 */
function handleComplete(): void {
  if (state.selectedElements.length === 0) {
    alert('선택된 요소가 없습니다.');
    return;
  }

  // 선택된 요소들의 텍스트 추출
  const texts = state.selectedElements.map(el => el.innerText.trim());
  const combinedText = texts.join('\n\n');

  // 선택 스타일 제거
  state.selectedElements.forEach(el => {
    el.style.outline = '';
    el.style.outlineOffset = '';
  });

  // Background로 메시지 전송
  chrome.runtime.sendMessage({
    type: 'TEXT_EXTRACTED',
    payload: {
      text: combinedText,
      url: window.location.href,
      title: document.title,
      elementCount: state.selectedElements.length,
    },
  });

  deactivatePicker();
}

/**
 * 취소 핸들러
 */
function handleCancel(): void {
  // 선택 스타일 제거
  state.selectedElements.forEach(el => {
    el.style.outline = '';
    el.style.outlineOffset = '';
  });

  deactivatePicker();
}

/**
 * 플로팅 버튼 표시
 */
function showFloatingButtons(): void {
  if (state.floatingButtons) {
    state.floatingButtons.style.display = 'flex';
  }
}

/**
 * 스타일 정의
 */
function getPickerStyles(): string {
  return `
    .highlight-overlay {
      position: absolute;
      pointer-events: none;
      background: rgba(66, 133, 244, 0.2);
      border: 2px dashed #4285f4;
      z-index: 999999;
      display: none;
    }

    .floating-buttons {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      gap: 8px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .floating-buttons button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-complete {
      background: #4CAF50;
      color: white;
    }

    .btn-complete:hover {
      background: #45a049;
    }

    .btn-cancel {
      background: #f5f5f5;
      color: #333;
    }

    .btn-cancel:hover {
      background: #e0e0e0;
    }
  `;
}

// 메시지 리스너 (팝업에서 활성화 요청)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTIVATE_PICKER') {
    activatePicker();
    sendResponse({ success: true });
  }
  return true;
});
```

---

## 메시지 통신

### 팝업 → Content Script (활성화)

```typescript
// popup에서
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id!, {
    type: 'ACTIVATE_PICKER',
  });
});
```

### Content Script → Background (데이터 전송)

```typescript
// element-picker.ts에서
chrome.runtime.sendMessage({
  type: 'TEXT_EXTRACTED',
  payload: {
    text: combinedText,
    url: window.location.href,
    title: document.title,
    elementCount: count,
  },
});
```

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/content/element-picker.ts` | 요소 선택 모드 구현 |

---

## 참조 문서
- [spec/02-data-extraction.md](../spec/02-data-extraction.md) - 데이터 추출
- [research/01-element-picker.md](../research/01-element-picker.md) - 요소 선택 기술 조사
