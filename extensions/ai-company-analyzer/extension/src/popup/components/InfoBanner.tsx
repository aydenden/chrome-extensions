export function InfoBanner() {
  return (
    <div className="info-banner">
      <div className="banner-row">
        <span className="banner-icon">🔒</span>
        <span className="banner-text">수동 추출 · 서버 전송 없음</span>
      </div>
      <div className="banner-row">
        <span className="banner-icon">🦙</span>
        <span className="banner-text">
          수집한 데이터를 <strong>Ollama</strong>로 분석해보세요
        </span>
      </div>
    </div>
  );
}
