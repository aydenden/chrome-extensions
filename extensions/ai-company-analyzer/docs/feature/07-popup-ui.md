# 07. 팝업 UI

## 개요
익스텐션 메인 팝업 UI 구현

## 선행 조건
- 02-data-storage 완료

## 기술 스택
| 분류 | 기술 |
|------|------|
| UI | React + TypeScript |
| 상태 관리 | React Hooks |
| 데이터 조회 | dexie-react-hooks |

---

## 화면 구성

```
┌─────────────────────────────┐
│ AI 기업분석                  │
├─────────────────────────────┤
│ 현재 사이트: 원티드 ✓        │
│ (또는: 지원하지 않는 사이트)  │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 📝 텍스트 추출          │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 📊 그래프 캡처          │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 📁 PDF 업로드           │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ 저장된 회사: 5개             │
│ → 회사 목록 보기             │
└─────────────────────────────┘
```

---

## 구현

### src/popup/Popup.tsx

```typescript
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { getSiteConfigs, SiteConfig } from '@/lib/settings';
import './popup.css';

function Popup() {
  const [currentSite, setCurrentSite] = useState<SiteConfig | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  // 저장된 회사 수 실시간 조회
  const companyCount = useLiveQuery(() => db.companies.count(), [], 0);

  // 현재 탭 정보 및 사이트 확인
  useEffect(() => {
    checkCurrentSite();
  }, []);

  const checkCurrentSite = async () => {
    // 현재 탭 URL 가져오기
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    setCurrentUrl(tab.url);

    // 지원 사이트 확인
    const configs = await getSiteConfigs();
    const matchedSite = configs.find(config => {
      const pattern = new RegExp(config.urlPattern.replace('*', '.*'));
      return pattern.test(tab.url!);
    });

    if (matchedSite) {
      setCurrentSite(matchedSite);
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  };

  // 텍스트 추출 모드 활성화
  const handleTextExtract = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_PICKER' });
      window.close();
    }
  };

  // 그래프 캡처 모드 활성화
  const handleGraphCapture = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_AREA_CAPTURE' });
      window.close();
    }
  };

  // PDF 업로드
  const handlePdfUpload = () => {
    // PDF 업로드 모달 또는 페이지로 이동
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/pdf-upload.html') });
  };

  // 회사 목록 페이지 열기
  const handleOpenList = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/list/list.html') });
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>AI 기업분석</h1>
      </header>

      <section className="site-info">
        {isSupported ? (
          <div className="site-supported">
            <span className="site-icon">✓</span>
            <span>현재 사이트: {currentSite?.name}</span>
          </div>
        ) : (
          <div className="site-unsupported">
            <span className="site-icon">✗</span>
            <span>지원하지 않는 사이트</span>
          </div>
        )}
      </section>

      <section className="actions">
        <button
          className="action-btn"
          onClick={handleTextExtract}
          disabled={!isSupported}
        >
          <span className="btn-icon">📝</span>
          <span className="btn-text">텍스트 추출</span>
        </button>

        <button
          className="action-btn"
          onClick={handleGraphCapture}
          disabled={!isSupported}
        >
          <span className="btn-icon">📊</span>
          <span className="btn-text">그래프 캡처</span>
        </button>

        <button
          className="action-btn"
          onClick={handlePdfUpload}
        >
          <span className="btn-icon">📁</span>
          <span className="btn-text">PDF 업로드</span>
        </button>
      </section>

      <footer className="popup-footer">
        <div className="company-count">
          저장된 회사: {companyCount}개
        </div>
        <button className="link-btn" onClick={handleOpenList}>
          회사 목록 보기 →
        </button>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
```

### src/popup/popup.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

.popup-container {
  padding: 16px;
}

.popup-header {
  margin-bottom: 16px;
}

.popup-header h1 {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.site-info {
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 16px;
}

.site-supported {
  color: #2e7d32;
  display: flex;
  align-items: center;
  gap: 8px;
}

.site-unsupported {
  color: #c62828;
  display: flex;
  align-items: center;
  gap: 8px;
}

.site-icon {
  font-weight: bold;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.action-btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #bdbdbd;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 20px;
}

.btn-text {
  font-size: 14px;
  font-weight: 500;
}

.popup-footer {
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.company-count {
  font-size: 13px;
  color: #666;
}

.link-btn {
  background: none;
  border: none;
  color: #1976d2;
  cursor: pointer;
  font-size: 13px;
}

.link-btn:hover {
  text-decoration: underline;
}
```

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/popup/Popup.tsx` | 메인 팝업 컴포넌트 |
| `src/popup/popup.css` | 팝업 스타일 |
| `src/popup/popup.html` | HTML 엔트리 |

---

## 참조 문서
- [spec/05-ui-structure.md](../spec/05-ui-structure.md) - UI 구조
