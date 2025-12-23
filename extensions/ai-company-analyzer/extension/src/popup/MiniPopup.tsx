import { usePopupState } from './hooks/usePopupState';
import { CompanyInput } from './components/CompanyInput';
import { SupportedSitesList } from './components/SupportedSitesList';
import { InfoBanner } from './components/InfoBanner';

function MiniPopup() {
  const {
    isLoading,
    isSupported,
    siteName,
    detectedCompany,
    savedCompanies,
    stats,
    companyInput,
    inputMode,
    isCapturing,
    error,
    setCompanyInput,
    handleCapture,
    openDashboard,
  } = usePopupState();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const onCapture = async () => {
    const success = await handleCapture();
    if (success) {
      setTimeout(() => window.close(), 500);
    }
  };

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <div className="header-rule" />
        <h1 className="popup-title">AI Company Analyzer</h1>
        <div className="header-rule" />
      </header>

      <main className="popup-content">
        {error && (
          <div className="error-message">
            <span className="error-icon">!</span>
            {error}
          </div>
        )}

        {/* Source Section */}
        <section className="section">
          <div className="section-label">Source</div>
          <div className="source-row">
            <span className={`status-dot ${isSupported ? 'active' : 'inactive'}`} />
            <span className={`site-name ${isSupported ? '' : 'unsupported'}`}>{siteName}</span>
          </div>
          {!isSupported && <SupportedSitesList />}
        </section>

        {/* Company Section - 지원 사이트에서만 표시 */}
        {isSupported && (
          <section className="section">
            <div className="section-header">
              <span className="section-label">Company</span>
              <span className="section-rule" />
            </div>

            <CompanyInput
              value={companyInput}
              onChange={setCompanyInput}
              detectedCompany={detectedCompany}
              savedCompanies={savedCompanies}
              inputMode={inputMode}
              disabled={!isSupported}
              isLoading={isLoading}
            />
          </section>
        )}

        {/* Capture Button */}
        <button
          className="capture-button"
          onClick={onCapture}
          disabled={!isSupported || isCapturing || !companyInput.trim()}
        >
          <span className="button-text">{isCapturing ? '캡처 중...' : '화면 캡처'}</span>
          <span className="button-arrow">→</span>
        </button>
      </main>

      <InfoBanner />

      {/* Footer */}
      <footer className="popup-footer">
        {stats && (
          <div className="stats-inline">
            <span>{stats.totalCompanies} companies</span>
            <span className="stats-dot">·</span>
            <span>{formatBytes(stats.storageUsed)}</span>
          </div>
        )}
        <a
          href="#"
          className="dashboard-link"
          onClick={e => {
            e.preventDefault();
            openDashboard();
          }}
        >
          Open Dashboard <span className="link-arrow">→</span>
        </a>
      </footer>
    </div>
  );
}

export default MiniPopup;
