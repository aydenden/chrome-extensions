// 로컬 스토리지에서 회사 ID 목록을 가져오는 함수
function getStoredCompanyIds(): Promise<string[]> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["companyIds"], (result) => {
      resolve((result.companyIds as string[] | undefined) || []);
    });
  });
}

// 로컬 스토리지에 회사 ID를 추가하는 함수
function addCompanyId(companyId: string): Promise<void> {
  return new Promise((resolve) => {
    getStoredCompanyIds().then((companyIds) => {
      if (!companyIds.includes(companyId)) {
        companyIds.push(companyId);
        chrome.storage.sync.set({ companyIds }, () => {
          resolve();
        });
      } else {
        resolve(); // 이미 존재하는 경우에도 resolve 호출
      }
    });
  });
}

// 로컬 스토리지에서 회사 ID를 제거하는 함수
function removeCompanyId(companyId: string): Promise<void> {
  return new Promise((resolve) => {
    getStoredCompanyIds().then((companyIds) => {
      companyIds = companyIds.filter((id) => id !== companyId);
      chrome.storage.sync.set({ companyIds }, () => {
        resolve();
      });
    });
  });
}

// 로컬 스토리지에서 채용 ID 목록을 가져오는 함수
function getStoredPositionIds(): Promise<string[]> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["positionIds"], (result) => {
      resolve((result.positionIds as string[] | undefined) || []);
    });
  });
}

// 로컬 스토리지에 채용 ID를 추가하는 함수
function addPositionId(positionId: string): Promise<void> {
  return new Promise((resolve) => {
    getStoredPositionIds().then((positionIds) => {
      if (!positionIds.includes(positionId)) {
        positionIds.push(positionId);
        chrome.storage.sync.set({ positionIds }, () => {
          resolve();
        });
      } else {
        resolve(); // 이미 존재하는 경우에도 resolve 호출
      }
    });
  });
}

// 로컬 스토리지에서 채용 ID를 제거하는 함수
function removePositionId(positionId: string): Promise<void> {
  return new Promise((resolve) => {
    getStoredPositionIds().then((positionIds) => {
      positionIds = positionIds.filter((id) => id !== positionId);
      chrome.storage.sync.set({ positionIds }, () => {
        resolve();
      });
    });
  });
}

// 버튼의 텍스트를 업데이트하는 함수
function updateButtonText(
  button: HTMLButtonElement,
  id: string,
  type: "company" | "position"
): void {
  if (type === "company") {
    getStoredCompanyIds().then((companyIds) => {
      button.textContent = companyIds.includes(id)
        ? "관심 없음 제거"
        : "관심 없음 추가";
    });
  } else if (type === "position") {
    getStoredPositionIds().then((positionIds) => {
      button.textContent = positionIds.includes(id)
        ? "관심 없음 제거"
        : "관심 없음 추가";
    });
  }
}

// 버튼 클릭 이벤트 핸들러
function handleButtonClick(
  button: HTMLButtonElement,
  id: string,
  type: "company" | "position"
): void {
  if (type === "company") {
    getStoredCompanyIds().then((companyIds) => {
      if (companyIds.includes(id)) {
        removeCompanyId(id).then(() => {
          updateButtonText(button, id, type);
        });
      } else {
        addCompanyId(id).then(() => {
          updateButtonText(button, id, type);
        });
      }
    });
  } else if (type === "position") {
    getStoredPositionIds().then((positionIds) => {
      if (positionIds.includes(id)) {
        removePositionId(id).then(() => {
          updateButtonText(button, id, type);
        });
      } else {
        addPositionId(id).then(() => {
          updateButtonText(button, id, type);
        });
      }
    });
  }
}

// 버튼을 추가하는 함수
function addButton(id: string, type: "company" | "position"): void {
  const selector =
    type === "company"
      ? "#__next > div > div > aside"
      : "#__next > main > div > div > aside";
  const container = document.querySelector(selector);
  if (!container) return;

  let button = container.querySelector(
    "button#action-button"
  ) as HTMLButtonElement;
  if (!button) {
    button = document.createElement("button");
    button.id = "action-button";
    // @ts-ignore
    button.style = `width: 100%;
    padding: 0 20px;
    min-width: 64px;
    height: 40px;
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    background-color: #06f;
    border-radius: 12px;
    margin-top: 20px;`;
    container.appendChild(button);

    // 이벤트 리스너는 버튼을 새로 생성할 때만 추가
    button.addEventListener("click", () => handleButtonClick(button, id, type));
  }
  updateButtonText(button, id, type);
}

// 카드 엘리먼트를 흐리게 처리하는 함수
function updateCardStyles(): void {
  getStoredCompanyIds().then((companyIds) => {
    getStoredPositionIds().then((positionIds) => {
      const cards = document.querySelectorAll(
        "#__next > div > div > ul > li > div > a"
      );
      cards.forEach((card) => {
        // 새로운 구조: button 태그에서 company-id와 position-id를 가져옴
        const button = card.querySelector("button");
        let companyId = card.getAttribute("data-company-id");
        let positionId = card.getAttribute("data-position-id");

        // 기존 구조에서 찾지 못했을 경우, button에서 찾기
        if (!companyId || !positionId) {
          if (button) {
            companyId = companyId || button.getAttribute("data-company-id");
            positionId = positionId || button.getAttribute("data-position-id");
          }
        }

        if (!companyId || !positionId) return; // ID가 없는 경우는 무시
        if (
          companyIds.includes(companyId) ||
          positionIds.includes(positionId)
        ) {
          // @ts-ignore
          card.style.opacity = "0.5";
        } else {
          // @ts-ignore
          card.style.opacity = "1";
        }
      });
    });
  });
}

// 디바운스 함수
function debounce(func: Function, wait: number) {
  // @ts-ignore
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 페이지 로드 및 Next.js 페이지 전환을 감지하는 함수
function observePageChanges(): void {
  // 디바운스된 처리 함수
  const debouncedHandler = debounce(() => {
    const url = window.location.href;
    let match = url.match(/https:\/\/www\.wanted\.co\.kr\/company\/(\d+)/);
    if (match) {
      const companyId = match[1];
      addButton(companyId, "company");
    }
    match = url.match(/https:\/\/www\.wanted\.co\.kr\/wd\/(\d+)/);
    if (match) {
      const positionId = match[1];
      addButton(positionId, "position");
      checkAndAddCompletedApplication(positionId);
    }
    updateCardStyles();
  }, 100); // 100ms 디바운스

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        // 확장 프로그램이 추가한 버튼인지 확인하여 무한 루프 방지
        const hasExtensionButton = Array.from(mutation.addedNodes).some(
          (node) => node instanceof Element && node.id === "action-button"
        );

        if (hasExtensionButton) {
          return; // 확장 프로그램이 추가한 요소면 처리하지 않음
        }

        debouncedHandler();
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// "지원 완료" 버튼이 있는지 확인하고, 있으면 관심 없는 채용 데이터에 추가하는 함수
function checkAndAddCompletedApplication(positionId: string): void {
  const buttons = document.querySelectorAll(
    "#__next > main > div > div > aside button"
  );
  buttons.forEach((button) => {
    if (button.textContent === "지원완료") {
      addPositionId(positionId);
    }
  });
}

// 초기 로드 시 실행
window.onload = () => {
  observePageChanges();
  const url = window.location.href;
  let match = url.match(/https:\/\/www\.wanted\.co\.kr\/company\/(\d+)/);
  if (match) {
    const companyId = match[1];
    addButton(companyId, "company");
  }
  match = url.match(/https:\/\/www\.wanted\.co\.kr\/wd\/(\d+)/);
  if (match) {
    const positionId = match[1];
    addButton(positionId, "position");
  }
  updateCardStyles();
};
