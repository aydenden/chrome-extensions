# 메시지 전달 (Message Passing)

## 목차
- [메시지 전달이란?](#메시지-전달이란)
- [일회성 메시지](#일회성-메시지)
- [장기 연결](#장기-연결)
- [외부 통신](#외부-통신)
- [Native Messaging](#native-messaging)
- [베스트 프랙티스](#베스트-프랙티스)

## 메시지 전달이란?

크롬 익스텐션의 여러 컴포넌트(Service Worker, Content Script, Popup 등)는 서로 격리되어 있어 직접 함수를 호출할 수 없습니다. 대신 **메시지 전달 API**를 사용하여 통신합니다.

### 통신이 필요한 경우

```
┌────────────────────────────────────────┐
│       Chrome Extension                  │
│                                         │
│  ┌──────────────┐    ┌──────────────┐ │
│  │   Service    │◄──►│    Popup     │ │
│  │   Worker     │    │              │ │
│  └───────┬──────┘    └──────────────┘ │
│          │                              │
│          │ Messages                     │
│          ▼                              │
│  ┌──────────────┐                      │
│  │   Content    │                      │
│  │   Script     │                      │
│  └──────────────┘                      │
│                                         │
└─────────────────────────────────────────┘
```

## 일회성 메시지

간단한 요청-응답 패턴에 사용합니다.

### Content Script → Service Worker

```javascript
// Content Script에서 전송
chrome.runtime.sendMessage(
  { action: "getData", userId: 123 },
  (response) => {
    console.log("Response:", response);
  }
);

// 또는 Promise 방식
const response = await chrome.runtime.sendMessage({
  action: "getData",
  userId: 123
});
console.log("Response:", response);
```

```javascript
// Service Worker에서 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Sender:", sender.tab?.url);

  if (request.action === "getData") {
    // 동기 응답
    sendResponse({ data: "Here's your data" });
  }

  // 비동기 응답을 위해서는 반드시 true 반환
  return true;
});
```

### Service Worker → Content Script

```javascript
// Service Worker에서 특정 탭에 전송
chrome.tabs.sendMessage(
  tabId,
  { action: "updateUI", data: newData },
  (response) => {
    console.log("Response from content script:", response);
  }
);

// 활성 탭에 전송
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, { action: "highlight" });
});
```

```javascript
// Content Script에서 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateUI") {
    updateInterface(request.data);
    sendResponse({ success: true });
  }
});
```

### Popup ↔ Service Worker

```javascript
// Popup에서 Service Worker로
chrome.runtime.sendMessage(
  { action: "getSettings" },
  (response) => {
    displaySettings(response.settings);
  }
);

// Service Worker에서 수신은 동일
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSettings") {
    const settings = loadSettings();
    sendResponse({ settings });
  }
});
```

### 비동기 응답 패턴

```javascript
// ❌ 작동 안 함: Promise를 반환해도 응답 안 됨
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  const data = await fetchData();
  sendResponse({ data }); // 이미 채널이 닫힘!
});

// ✅ 방법 1: true 반환
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchData") {
    fetchData().then(data => {
      sendResponse({ data });
    });
    return true; // 비동기 응답을 위해 필수!
  }
});

// ✅ 방법 2: Promise 반환 (Chrome 99+)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  return fetchData().then(data => {
    return { data }; // Promise를 반환
  });
});
```

## 장기 연결

여러 메시지를 주고받아야 할 때 사용합니다.

### Content Script → Service Worker

```javascript
// Content Script에서 연결 생성
const port = chrome.runtime.connect({ name: "my-channel" });

// 메시지 전송
port.postMessage({ type: "init", data: "Hello" });

// 메시지 수신
port.onMessage.addListener((message) => {
  console.log("Received:", message);
});

// 연결 종료 감지
port.onDisconnect.addListener(() => {
  console.log("Disconnected");
});
```

```javascript
// Service Worker에서 연결 수신
chrome.runtime.onConnect.addListener((port) => {
  console.log("Connected:", port.name);

  port.onMessage.addListener((message) => {
    console.log("Received:", message);

    // 응답 전송
    port.postMessage({ type: "response", data: "Hi back!" });
  });

  port.onDisconnect.addListener(() => {
    console.log("Port disconnected");
  });
});
```

### Service Worker → Content Script

```javascript
// Service Worker에서 특정 탭에 연결
chrome.tabs.query({ active: true }, (tabs) => {
  const port = chrome.tabs.connect(tabs[0].id, { name: "data-channel" });

  port.postMessage({ action: "start" });

  port.onMessage.addListener((message) => {
    console.log("From content script:", message);
  });
});
```

```javascript
// Content Script에서 수신
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "data-channel") {
    port.onMessage.addListener((message) => {
      if (message.action === "start") {
        // 처리
        port.postMessage({ status: "started" });
      }
    });
  }
});
```

### 실시간 스트리밍 예제

```javascript
// Service Worker: 주기적으로 데이터 전송
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "live-data") {
    const interval = setInterval(() => {
      port.postMessage({
        timestamp: Date.now(),
        data: Math.random()
      });
    }, 1000);

    port.onDisconnect.addListener(() => {
      clearInterval(interval);
    });
  }
});

// Content Script: 실시간 데이터 수신
const port = chrome.runtime.connect({ name: "live-data" });
port.onMessage.addListener((message) => {
  updateChart(message.data);
});
```

## 외부 통신

### 다른 익스텐션과 통신

```javascript
// 발신 (다른 익스텐션 ID 필요)
const otherExtensionId = "abcdefghijklmnopqrstuvwxyz";

chrome.runtime.sendMessage(
  otherExtensionId,
  { action: "getData" },
  (response) => {
    if (response) {
      console.log("Response from other extension:", response);
    }
  }
);
```

```javascript
// 수신 (manifest.json에 externally_connectable 설정 필요)
{
  "externally_connectable": {
    "ids": ["sender_extension_id"],
    "matches": ["https://example.com/*"]
  }
}

// 외부 메시지 수신
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log("From extension:", sender.id);
  sendResponse({ received: true });
});
```

### 웹 페이지와 통신

```javascript
// 웹 페이지에서 익스텐션으로 메시지 전송
// (manifest.json의 externally_connectable에 도메인 등록 필요)
chrome.runtime.sendMessage(
  "extension_id",
  { action: "ping" },
  (response) => {
    console.log("Response from extension:", response);
  }
);
```

## Native Messaging

익스텐션과 네이티브 애플리케이션 간 통신 (고급)

```javascript
// Native 앱과 연결
const port = chrome.runtime.connectNative("com.my.application");

port.postMessage({ command: "start" });

port.onMessage.addListener((message) => {
  console.log("From native app:", message);
});

port.onDisconnect.addListener(() => {
  console.log("Disconnected from native app");
  console.log(chrome.runtime.lastError);
});
```

## 베스트 프랙티스

### 1. 메시지 타입 정의

```typescript
// types.ts
export type MessageType =
  | { action: "getData"; userId: number }
  | { action: "updateUI"; data: any }
  | { action: "deleteItem"; itemId: string };

export type MessageResponse =
  | { success: true; data: any }
  | { success: false; error: string };

// background.ts
chrome.runtime.onMessage.addListener(
  (request: MessageType, sender, sendResponse: (response: MessageResponse) => void) => {
    switch (request.action) {
      case "getData":
        getData(request.userId).then(data => {
          sendResponse({ success: true, data });
        });
        return true;

      case "deleteItem":
        deleteItem(request.itemId).then(() => {
          sendResponse({ success: true, data: null });
        });
        return true;
    }
  }
);
```

### 2. 에러 처리

```javascript
async function sendMessageSafely(message) {
  try {
    const response = await chrome.runtime.sendMessage(message);
    return { success: true, data: response };
  } catch (error) {
    if (error.message.includes("Extension context invalidated")) {
      console.error("Extension was reloaded");
    } else if (error.message.includes("Receiving end does not exist")) {
      console.error("No listener found");
    }
    return { success: false, error: error.message };
  }
}
```

### 3. Timeout 처리

```javascript
function sendMessageWithTimeout(message, timeout = 5000) {
  return Promise.race([
    chrome.runtime.sendMessage(message),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeout)
    )
  ]);
}

// 사용
try {
  const response = await sendMessageWithTimeout({ action: "getData" }, 3000);
} catch (error) {
  console.error("Request timed out or failed:", error);
}
```

### 4. 중앙화된 메시지 핸들러

```javascript
// messageHandler.ts
const handlers = {
  async getData(userId) {
    return await fetchUserData(userId);
  },

  async saveSettings(settings) {
    await chrome.storage.sync.set({ settings });
    return { success: true };
  },

  async deleteItem(itemId) {
    // ...
    return { deleted: true };
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = handlers[request.action];

  if (handler) {
    handler(request.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 비동기 응답
  } else {
    sendResponse({ success: false, error: "Unknown action" });
  }
});
```

### 5. 보안 검증

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. 출처 확인
  if (!sender.tab) {
    console.error("Message not from content script");
    return;
  }

  // 2. URL 확인
  const url = new URL(sender.tab.url);
  if (url.hostname !== "www.wanted.co.kr") {
    console.error("Unauthorized origin");
    return;
  }

  // 3. 데이터 검증
  if (typeof request.action !== "string") {
    sendResponse({ error: "Invalid action type" });
    return;
  }

  // 처리
  handleMessage(request, sendResponse);
  return true;
});
```

### 6. 디버깅 로깅

```javascript
function logMessage(direction, message, sender) {
  console.log(`[${direction}]`, {
    action: message.action,
    data: message.data,
    from: sender?.tab?.url || sender?.id || "unknown",
    timestamp: new Date().toISOString()
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logMessage("RECEIVED", request, sender);

  // 처리...

  const response = { success: true };
  logMessage("SENDING", response, sender);
  sendResponse(response);
});
```

## 현재 프로젝트에 적용하기

현재 프로젝트는 Content Script만 사용하므로 메시지 전달이 필요 없지만, 향후 확장을 위해:

### Popup 추가 시

```javascript
// popup.js
document.getElementById("clearBtn").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ action: "clearAll" });

  if (response.success) {
    alert("모든 필터가 제거되었습니다");
  }
});

// content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "clearAll") {
    chrome.storage.sync.clear(() => {
      sendResponse({ success: true });
      // UI 업데이트
      location.reload();
    });
    return true;
  }
});
```

### Service Worker 추가 시

```javascript
// background.js (Service Worker)
chrome.storage.onChanged.addListener((changes, area) => {
  // 모든 원티드 탭에 변경사항 알림
  chrome.tabs.query({ url: "https://www.wanted.co.kr/*" }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: "storageChanged",
        changes
      });
    });
  });
});

// content script
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "storageChanged") {
    // 변경사항에 따라 UI 업데이트
    updateUI(request.changes);
  }
});
```

## 참고 자료

- [Chrome for Developers - Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)

## 다음 단계

- **[MutationObserver](./05-mutation-observer.md)** - DOM 변경 감지
- **[아키텍처 패턴](./06-architecture-patterns.md)** - 전체 구조 설계
