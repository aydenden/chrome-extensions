interface CaptureOptionsProps {
  quickCapture: boolean;
  continuousCapture: boolean;
  canQuickCapture: boolean; // 기존 회사 선택 시에만 true
  onQuickCaptureChange: (enabled: boolean) => void;
  onContinuousCaptureChange: (enabled: boolean) => void;
}

export function CaptureOptions({
  quickCapture,
  continuousCapture,
  canQuickCapture,
  onQuickCaptureChange,
  onContinuousCaptureChange,
}: CaptureOptionsProps) {
  return (
    <div className="capture-options">
      <div className="options-header">
        <span className="options-label">Capture Mode</span>
        <span className="options-rule" />
      </div>

      <div className="options-list">
        <label
          className={`option-item ${!canQuickCapture ? 'option-disabled' : ''}`}
          title={
            !canQuickCapture
              ? '저장된 회사를 선택해야 빠른 캡처를 사용할 수 있습니다'
              : undefined
          }
        >
          <input
            type="checkbox"
            className="option-checkbox"
            checked={quickCapture}
            disabled={!canQuickCapture}
            onChange={e => onQuickCaptureChange(e.target.checked)}
          />
          <span className="option-check" />
          <span className="option-text">
            빠른 캡처
            <span className="option-desc">확인 생략</span>
          </span>
        </label>

        <label className="option-item">
          <input
            type="checkbox"
            className="option-checkbox"
            checked={continuousCapture}
            onChange={e => onContinuousCaptureChange(e.target.checked)}
          />
          <span className="option-check" />
          <span className="option-text">
            연속 캡처
            <span className="option-desc">팝업 유지</span>
          </span>
        </label>
      </div>
    </div>
  );
}
