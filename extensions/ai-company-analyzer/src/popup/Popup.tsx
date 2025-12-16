import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useLiveQuery } from 'dexie-react-hooks';
import './popup.css';
import { db } from '@/lib/db';
import { SUPPORTED_SITES, detectCurrentSite, type SiteKey } from '@/lib/sites';

function Popup() {
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [currentSite, setCurrentSite] = useState<SiteKey | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [showPdfUpload, setShowPdfUpload] = useState<boolean>(false);

  // Dexie useLiveQuery로 실시간 회사 수 조회
  const companyCount = useLiveQuery(() => db.companies.count(), [], 0);

  // 현재 탭 URL 감지
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        const url = tabs[0].url;
        setCurrentUrl(url);

        const site = detectCurrentSite(url);
        setCurrentSite(site);
        setIsSupported(site !== null);
      }
    });
  }, []);

  // 그래프 캡처 버튼 핸들러
  const handleGraphCapture = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_CAPTURE' }, (response) => {
      console.log('그래프 캡처 모드 활성화:', response);
    });

    window.close();
  };

  // PDF 업로드 버튼 핸들러
  const handlePdfUpload = () => {
    setShowPdfUpload(!showPdfUpload);
  };

  // 회사 목록 페이지 열기
  const handleOpenList = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dist/src/pages/list/list.html') });
  };

  // 설정 페이지 열기
  const handleOpenSettings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dist/src/pages/settings/settings.html') });
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>AI 기업분석</h1>
      </header>

      <main className="popup-content">
        {/* 사이트 정보 섹션 */}
        <div className="site-info">
          {isSupported && currentSite ? (
            <>
              <div className="site-badge supported">
                <span className="badge-dot"></span>
                <span className="badge-text">{SUPPORTED_SITES[currentSite].name}</span>
              </div>
              <p className="site-status">지원하는 사이트입니다</p>
            </>
          ) : (
            <>
              <div className="site-badge unsupported">
                <span className="badge-dot"></span>
                <span className="badge-text">미지원 사이트</span>
              </div>
              <p className="site-status">데이터 추출을 사용할 수 없습니다</p>
            </>
          )}
        </div>

        {/* 액션 버튼 섹션 */}
        <div className="action-buttons">
          <button
            className="action-btn"
            onClick={handleGraphCapture}
            disabled={!isSupported}
            title={isSupported ? "페이지에서 영역을 캡처합니다" : "지원하지 않는 사이트입니다"}
          >
            <span className="btn-icon">📸</span>
            <span className="btn-text">이미지 캡처</span>
          </button>

          <button
            className="action-btn"
            onClick={handlePdfUpload}
            title="PDF 파일을 업로드합니다"
          >
            <span className="btn-icon">📄</span>
            <span className="btn-text">PDF 업로드</span>
          </button>
        </div>

        {/* PDF 업로드 섹션 (토글) */}
        {showPdfUpload && (
          <div className="pdf-upload-section">
            <p className="upload-placeholder">PDF 업로드 기능은 준비 중입니다.</p>
          </div>
        )}

        {/* 통계 정보 */}
        <div className="stats-section">
          <div className="stat-item">
            <span className="stat-label">저장된 회사</span>
            <span className="stat-value">{companyCount}개</span>
          </div>
        </div>
      </main>

      <footer className="popup-footer">
        <button className="footer-link" onClick={handleOpenList}>
          회사 목록 보기
        </button>
        <span className="footer-divider">|</span>
        <button className="footer-link" onClick={handleOpenSettings}>
          설정
        </button>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
