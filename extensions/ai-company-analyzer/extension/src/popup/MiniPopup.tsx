import { useEffect, useState } from 'react';
import { detectSite } from '@/lib/sites';

interface Stats {
  totalCompanies: number;
  totalImages: number;
  analyzedImages: number;
  storageUsed: number;
}

function MiniPopup() {
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [siteName, setSiteName] = useState<string>('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // 현재 탭 정보 가져오기
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url) return;

      setCurrentUrl(tab.url);

      const site = detectSite(tab.url);
      if (site) {
        setIsSupported(true);
        setSiteName(site.name);
      } else {
        setIsSupported(false);
        setSiteName('지원하지 않는 사이트');
      }
    });

    // 통계 정보 가져오기
    chrome.runtime.sendMessage(
      { type: 'GET_STATS_INTERNAL' },
      (response) => {
        if (response?.success && response.stats) {
          setStats(response.stats);
        }
      }
    );
  }, []);

  const handleCapture = async () => {
    if (!isSupported) return;

    setIsCapturing(true);
    setError('');

    try {
      // Content Script에게 캡처 요청
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('활성 탭을 찾을 수 없습니다.');
      }

      await chrome.tabs.sendMessage(tab.id, {
        type: 'TRIGGER_CAPTURE',
      });

      // 성공 메시지 표시 후 팝업 닫기
      setTimeout(() => {
        window.close();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '캡처에 실패했습니다.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleOpenDashboard = () => {
    chrome.tabs.create({
      url: 'https://YOUR_GITHUB_USERNAME.github.io/ai-company-analyzer/',
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1 className="popup-title">AI Company Analyzer</h1>
      </header>

      <main className="popup-content">
        {error && <div className="error-message">{error}</div>}

        <div className="site-info">
          <div className="site-label">현재 사이트</div>
          <div className={`site-name ${isSupported ? 'supported' : 'unsupported'}`}>
            {siteName}
          </div>
        </div>

        <button
          className="capture-button"
          onClick={handleCapture}
          disabled={!isSupported || isCapturing}
        >
          {isCapturing ? '캡처 중...' : '화면 캡처'}
        </button>
      </main>

      <footer className="popup-footer">
        {stats ? (
          <>
            <div className="stats-row">
              <span className="stats-label">저장된 회사</span>
              <span className="stats-value">{stats.totalCompanies}개</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">저장 용량</span>
              <span className="stats-value">{formatBytes(stats.storageUsed)}</span>
            </div>
          </>
        ) : (
          <div className="loading-indicator">통계 로딩 중...</div>
        )}

        <a
          href="#"
          className="dashboard-link"
          onClick={(e) => {
            e.preventDefault();
            handleOpenDashboard();
          }}
        >
          대시보드 열기 →
        </a>
      </footer>
    </div>
  );
}

export default MiniPopup;
