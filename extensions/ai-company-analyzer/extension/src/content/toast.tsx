/**
 * 토스트 알림 컴포넌트
 * Shadow DOM 기반으로 호스트 페이지 스타일과 격리
 */

type ToastType = 'success' | 'error' | 'info';

const TOAST_CONTAINER_ID = 'aca-toast-container';

const styles = `
  .toast-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: rgba(15, 15, 15, 0.95);
    color: #F7F5F0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif;
    font-size: 14px;
    font-weight: 500;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease-out;
    pointer-events: auto;
  }

  .toast.success {
    border-left: 3px solid #2D5A27;
  }

  .toast.error {
    border-left: 3px solid #9B2C2C;
  }

  .toast.info {
    border-left: 3px solid #6B6B6B;
  }

  .toast.fade-out {
    animation: fadeOut 0.2s ease-out forwards;
  }

  .toast-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .toast-message {
    line-height: 1.4;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-10px);
    }
  }
`;

function getOrCreateContainer(): ShadowRoot {
  let container = document.getElementById(TOAST_CONTAINER_ID);

  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    document.body.appendChild(container);

    const shadow = container.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = styles;
    shadow.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.className = 'toast-container';
    shadow.appendChild(wrapper);

    return shadow;
  }

  return container.shadowRoot as ShadowRoot;
}

function getIcon(type: ToastType): string {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'info':
    default:
      return 'ℹ';
  }
}

export function showToast(
  message: string,
  type: ToastType = 'success',
  duration: number = 2000
): void {
  const shadow = getOrCreateContainer();
  const wrapper = shadow.querySelector('.toast-container');

  if (!wrapper) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${getIcon(type)}</span>
    <span class="toast-message">${message}</span>
  `;

  wrapper.appendChild(toast);

  // 자동 제거
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();

      // 더 이상 토스트가 없으면 컨테이너도 제거
      if (wrapper.children.length === 0) {
        const container = document.getElementById(TOAST_CONTAINER_ID);
        container?.remove();
      }
    }, 200);
  }, duration);
}
