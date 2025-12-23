import { usePopupState } from './hooks/usePopupState';
import { CompanyInput } from './components/CompanyInput';
import { CaptureOptions } from './components/CaptureOptions';
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
    // 캡처 옵션
    quickCapture,
    continuousCapture,
    selectedCompanyId,
    captureCount,
    setCompanyInput,
    handleCapture,
    openDashboard,
    setQuickCapture,
    setContinuousCapture,
    resetCaptureCount,
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
    if (success && !continuousCapture) {
      // 연속 캡처 모드가 아닐 때만 팝업 닫기
      setTimeout(() => window.close(), 500);
    }
  };

  const onFinishContinuousCapture = () => {
    resetCaptureCount();
    window.close();
  };

  // 빠른 캡처는 기존 회사가 선택되어 있을 때만 가능
  const canQuickCapture = !!selectedCompanyId;

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

        {/* Capture Options - 지원 사이트에서만 표시 */}
        {isSupported && (
          <CaptureOptions
            quickCapture={quickCapture}
            continuousCapture={continuousCapture}
            canQuickCapture={canQuickCapture}
            onQuickCaptureChange={setQuickCapture}
            onContinuousCaptureChange={setContinuousCapture}
          />
        )}

        {/* Continuous Capture Status */}
        {continuousCapture && captureCount > 0 && (
          <div className="continuous-status">
            <div className="status-info">
              <span className="status-pulse" />
              <span className="status-counter">
                <span className="count">{captureCount}</span>개 캡처됨
              </span>
            </div>
            <button className="finish-button" onClick={onFinishContinuousCapture}>
              완료
            </button>
          </div>
        )}

        {/* Capture Button */}
        <button
          className="capture-button"
          onClick={onCapture}
          disabled={!isSupported || isCapturing || !companyInput.trim()}
        >
          <span className="button-text">
            {isCapturing
              ? '캡처 중...'
              : continuousCapture && captureCount > 0
                ? '다음 캡처'
                : '화면 캡처'}
          </span>
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
