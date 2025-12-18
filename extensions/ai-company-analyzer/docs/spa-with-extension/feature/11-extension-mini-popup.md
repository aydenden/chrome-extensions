# Feature 11: Extension Mini Popup UI

## 개요

Extension 아이콘 클릭 시 표시되는 미니 팝업 UI를 구현합니다.

## 범위

- MiniPopup.tsx
- 현재 사이트 감지 표시
- 스크린샷 캡처 버튼
- 대시보드 열기 링크

## 의존성

- Feature 10: Extension Capture Service

## 구현 상세

### extension/src/popup/index.html

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Company Analyzer</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="index.tsx"></script>
</body>
</html>
```

### extension/src/popup/popup.css

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Pretendard Variable', -apple-system, sans-serif;
  background: #F7F5F0;
  color: #0F0F0F;
  width: 320px;
  min-height: 180px;
}

.popup {
  display: flex;
  flex-direction: column;
}

.header {
  padding: 16px;
  border-bottom: 2px solid #0F0F0F;
}

.header h1 {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.content {
  padding: 16px;
  flex: 1;
}

.site-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.site-badge .indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #059669;
}

.site-badge .indicator.unsupported {
  background: #6B7280;
}

.site-badge .label {
  font-size: 13px;
  color: #3D3D3D;
}

.capture-btn {
  width: 100%;
  padding: 12px 16px;
  background: #0F0F0F;
  color: #F7F5F0;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.capture-btn:hover {
  background: #3D3D3D;
}

.capture-btn:disabled {
  background: #B0B0B0;
  cursor: not-allowed;
}

.footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(15, 15, 15, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats {
  font-size: 12px;
  color: #737373;
}

.dashboard-link {
  font-size: 12px;
  color: #0369A1;
  text-decoration: none;
  font-weight: 500;
}

.dashboard-link:hover {
  text-decoration: underline;
}
```

### extension/src/popup/index.tsx

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import MiniPopup from './MiniPopup';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MiniPopup />
  </React.StrictMode>
);
```

### extension/src/popup/MiniPopup.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { detectSite, type SiteConfig } from '@/lib/sites';

const SPA_URL = 'https://username.github.io/ai-company-analyzer/';

interface TabInfo {
  id: number;
  url: string;
  site: SiteConfig | null;
}

interface Stats {
  totalCompanies: number;
}

export default function MiniPopup() {
  const [tab, setTab] = useState<TabInfo | null>(null);
  const [stats, setStats] = useState<Stats>({ totalCompanies: 0 });
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    // 현재 탭 정보 가져오기
    chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
      if (activeTab?.id && activeTab?.url) {
        const site = detectSite(activeTab.url);
        setTab({
          id: activeTab.id,
          url: activeTab.url,
          site,
        });
      }
    });

    // 통계 가져오기
    chrome.runtime.sendMessage({ type: 'GET_STATS_INTERNAL' }, (response) => {
      if (response?.totalCompanies !== undefined) {
        setStats({ totalCompanies: response.totalCompanies });
      }
    });
  }, []);

  const handleCapture = async () => {
    if (!tab?.site) return;

    setIsCapturing(true);

    try {
      // Content Script에서 페이지 데이터 가져오기
      const pageData = await new Promise<any>((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' }, resolve);
      });

      // 스크린샷 캡처
      await chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT',
        payload: {
          companyName: pageData?.companyName || '알 수 없는 회사',
          companyUrl: tab.url,
          siteType: tab.site.type,
        },
      });

      // 통계 업데이트
      const newStats = await chrome.runtime.sendMessage({ type: 'GET_STATS_INTERNAL' });
      setStats({ totalCompanies: newStats.totalCompanies });
    } catch (error) {
      console.error('Capture error:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: SPA_URL });
  };

  return (
    <div className="popup">
      <header className="header">
        <h1>AI COMPANY ANALYZER</h1>
      </header>

      <main className="content">
        <div className="site-badge">
          <span className={`indicator ${tab?.site ? '' : 'unsupported'}`} />
          <span className="label">
            {tab?.site
              ? `${tab.site.name} 지원 사이트`
              : '지원하지 않는 사이트'}
          </span>
        </div>

        <button
          className="capture-btn"
          onClick={handleCapture}
          disabled={!tab?.site || isCapturing}
        >
          {isCapturing ? '캡처 중...' : '📷 스크린샷 캡처'}
        </button>
      </main>

      <footer className="footer">
        <span className="stats">{stats.totalCompanies}개 회사 저장됨</span>
        <a
          href="#"
          className="dashboard-link"
          onClick={(e) => {
            e.preventDefault();
            openDashboard();
          }}
        >
          대시보드 →
        </a>
      </footer>
    </div>
  );
}
```

### Service Worker 내부 메시지 핸들러

```typescript
// extension/src/background/index.ts

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATS_INTERNAL') {
    getStats().then(stats => {
      sendResponse(stats);
    });
    return true;
  }
  // ... 기존 핸들러
});
```

## 완료 기준

- [ ] 팝업 클릭 시 UI 표시
- [ ] 현재 사이트가 지원 사이트인지 감지 및 표시
- [ ] 지원 사이트에서 캡처 버튼 활성화
- [ ] 비지원 사이트에서 캡처 버튼 비활성화
- [ ] 캡처 버튼 클릭 시 스크린샷 저장
- [ ] 저장된 회사 수 표시
- [ ] 대시보드 링크 클릭 시 SPA 열기

## 참조 문서

- spec/06-page-layouts.md Section 6 (Mini Popup)
