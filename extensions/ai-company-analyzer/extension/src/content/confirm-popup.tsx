import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { DataType } from '@shared/constants/categories';
import type { Company } from '@/lib/db';

interface ConfirmPopupProps {
  imageDataUrl: string;
  detectedCompanyName: string;
  companyUrl: string;
  siteType: DataType;
  siteName: string;
  onSave: (result: SaveResult) => void;
  onCancel: () => void;
}

export interface SaveResult {
  companyName: string;
  saveTarget: 'new' | 'existing';
  existingCompanyId?: string;
}

const ConfirmPopup: React.FC<ConfirmPopupProps> = ({
  imageDataUrl,
  detectedCompanyName,
  companyUrl,
  siteType,
  siteName,
  onSave,
  onCancel,
}) => {
  const [companyName, setCompanyName] = useState(detectedCompanyName);
  const [saveTarget, setSaveTarget] = useState<'new' | 'existing'>('new');
  const [existingCompanyId, setExistingCompanyId] = useState<string>('');
  const [existingCompanies, setExistingCompanies] = useState<Company[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 기존 회사 목록 가져오기
    chrome.runtime.sendMessage({ type: 'GET_COMPANIES_INTERNAL' }, (response) => {
      if (response?.success && response.companies) {
        setExistingCompanies(response.companies);
      }
    });
  }, []);

  const handleSave = () => {
    if (saveTarget === 'new' && !companyName.trim()) {
      alert('회사명을 입력해주세요.');
      return;
    }
    if (saveTarget === 'existing' && !existingCompanyId) {
      alert('기존 회사를 선택해주세요.');
      return;
    }

    setIsSaving(true);
    onSave({
      companyName: companyName.trim(),
      saveTarget,
      existingCompanyId: saveTarget === 'existing' ? existingCompanyId : undefined,
    });
  };

  return (
    <div className="aca-overlay">
      <div className="aca-modal">
        <h2 className="aca-title">캡처 저장 확인</h2>

        <div className="aca-section">
          <h3 className="aca-label">미리보기</h3>
          <img src={imageDataUrl} alt="캡처 미리보기" className="aca-preview-image" />
        </div>

        <div className="aca-section">
          <h3 className="aca-label">데이터 타입</h3>
          <div className="aca-readonly-field">
            {siteName} ({siteType})
          </div>
        </div>

        <div className="aca-section">
          <h3 className="aca-label">저장 대상</h3>
          <div className="aca-radio-group">
            <label className="aca-radio-label">
              <input
                type="radio"
                name="saveTarget"
                value="new"
                checked={saveTarget === 'new'}
                onChange={(e) => setSaveTarget(e.target.value as 'new')}
              />
              새 회사 생성
            </label>
            <label className="aca-radio-label">
              <input
                type="radio"
                name="saveTarget"
                value="existing"
                checked={saveTarget === 'existing'}
                onChange={(e) => setSaveTarget(e.target.value as 'existing')}
                disabled={existingCompanies.length === 0}
              />
              기존 회사에 추가
              {existingCompanies.length === 0 && (
                <span className="aca-hint"> (기존 회사가 없습니다)</span>
              )}
            </label>
          </div>
        </div>

        {saveTarget === 'new' ? (
          <div className="aca-section">
            <h3 className="aca-label">회사명</h3>
            <div className="aca-input-wrapper">
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="aca-input"
                placeholder="회사명을 입력하세요"
              />
              {detectedCompanyName && (
                <span className="aca-badge">자동 감지됨</span>
              )}
            </div>
          </div>
        ) : (
          <div className="aca-section">
            <h3 className="aca-label">기존 회사 선택</h3>
            <select
              value={existingCompanyId}
              onChange={(e) => setExistingCompanyId(e.target.value)}
              className="aca-select"
            >
              <option value="">선택하세요</option>
              {existingCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="aca-url-info">
          <strong>URL:</strong> {companyUrl}
        </div>

        <div className="aca-actions">
          <button
            onClick={onCancel}
            className="aca-btn aca-btn-secondary"
            disabled={isSaving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="aca-btn aca-btn-primary"
            disabled={isSaving}
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

function injectStyles(): void {
  if (document.getElementById('aca-confirm-popup-styles')) return;

  const style = document.createElement('style');
  style.id = 'aca-confirm-popup-styles';
  style.textContent = `
    .aca-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 15, 15, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .aca-modal {
      background: #F7F5F0;
      border: 2px solid #0F0F0F;
      border-radius: 0;
      padding: 32px;
      max-width: 600px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 8px 8px 0 rgba(15, 15, 15, 0.3);
    }

    .aca-title {
      margin: 0 0 24px 0;
      font-size: 24px;
      font-weight: 700;
      color: #0F0F0F;
      border-bottom: 2px solid #0F0F0F;
      padding-bottom: 12px;
    }

    .aca-section {
      margin-bottom: 24px;
    }

    .aca-label {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 600;
      color: #0F0F0F;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .aca-preview-image {
      max-height: 200px;
      max-width: 100%;
      border: 2px solid #0F0F0F;
      display: block;
    }

    .aca-readonly-field {
      padding: 12px;
      background: #EBEBEB;
      border: 2px solid #0F0F0F;
      font-size: 14px;
      color: #0F0F0F;
    }

    .aca-radio-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .aca-radio-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #0F0F0F;
      cursor: pointer;
    }

    .aca-radio-label input[type="radio"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .aca-radio-label input[type="radio"]:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .aca-hint {
      color: #666;
      font-size: 12px;
    }

    .aca-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .aca-input {
      flex: 1;
      padding: 12px;
      border: 2px solid #0F0F0F;
      background: #FFF;
      font-size: 14px;
      color: #0F0F0F;
      font-family: inherit;
    }

    .aca-input:focus {
      outline: none;
      border-color: #0F0F0F;
      box-shadow: 0 0 0 2px rgba(15, 15, 15, 0.1);
    }

    .aca-badge {
      padding: 4px 8px;
      background: #0F0F0F;
      color: #F7F5F0;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .aca-select {
      width: 100%;
      padding: 12px;
      border: 2px solid #0F0F0F;
      background: #FFF;
      font-size: 14px;
      color: #0F0F0F;
      font-family: inherit;
      cursor: pointer;
    }

    .aca-select:focus {
      outline: none;
      border-color: #0F0F0F;
      box-shadow: 0 0 0 2px rgba(15, 15, 15, 0.1);
    }

    .aca-url-info {
      margin-bottom: 24px;
      padding: 12px;
      background: #EBEBEB;
      border: 2px solid #0F0F0F;
      font-size: 12px;
      color: #0F0F0F;
      word-break: break-all;
    }

    .aca-url-info strong {
      font-weight: 600;
    }

    .aca-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .aca-btn {
      padding: 12px 24px;
      border: 2px solid #0F0F0F;
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .aca-btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .aca-btn-primary {
      background: #0F0F0F;
      color: #F7F5F0;
    }

    .aca-btn-primary:hover:not(:disabled) {
      background: #2F2F2F;
      transform: translateY(-2px);
      box-shadow: 4px 4px 0 rgba(15, 15, 15, 0.2);
    }

    .aca-btn-secondary {
      background: #F7F5F0;
      color: #0F0F0F;
    }

    .aca-btn-secondary:hover:not(:disabled) {
      background: #EBEBEB;
      transform: translateY(-2px);
      box-shadow: 4px 4px 0 rgba(15, 15, 15, 0.2);
    }
  `;
  document.head.appendChild(style);
}

export function showConfirmPopup(options: {
  imageDataUrl: string;
  detectedCompanyName: string;
  companyUrl: string;
  siteType: DataType;
  siteName: string;
}): Promise<SaveResult | null> {
  return new Promise((resolve) => {
    injectStyles();

    const container = document.createElement('div');
    container.id = 'aca-confirm-popup-root';
    document.body.appendChild(container);

    const root = createRoot(container);

    const cleanup = () => {
      root.unmount();
      container.remove();
    };

    const handleSave = (result: SaveResult) => {
      cleanup();
      resolve(result);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    root.render(
      <ConfirmPopup
        imageDataUrl={options.imageDataUrl}
        detectedCompanyName={options.detectedCompanyName}
        companyUrl={options.companyUrl}
        siteType={options.siteType}
        siteName={options.siteName}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  });
}
