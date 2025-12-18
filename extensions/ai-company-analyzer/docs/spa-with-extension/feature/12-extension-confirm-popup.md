# Feature 12: 캡처 저장 확인 팝업

## 개요

영역 캡처 후 표시되는 저장 확인 팝업을 구현합니다. Content Script 내에서 렌더링됩니다.

## 범위

- ConfirmPopup.tsx (Content Script 내 렌더링)
- 이미지 미리보기
- 회사명 입력/자동 감지
- 새 회사/기존 회사 선택

## 의존성

- Feature 11: Extension Mini Popup

## 구현 상세

### extension/src/content/confirm-popup.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { DataType } from '@shared/constants/categories';

interface Company {
  id: string;
  name: string;
}

interface ConfirmPopupProps {
  imageDataUrl: string;
  detectedCompanyName: string | null;
  companyUrl: string;
  siteType: DataType;
  siteName: string;
  onSave: (data: {
    companyName: string;
    existingCompanyId?: string;
  }) => void;
  onCancel: () => void;
}

function ConfirmPopup({
  imageDataUrl,
  detectedCompanyName,
  companyUrl,
  siteType,
  siteName,
  onSave,
  onCancel,
}: ConfirmPopupProps) {
  const [companyName, setCompanyName] = useState(detectedCompanyName || '');
  const [saveTarget, setSaveTarget] = useState<'new' | 'existing'>('new');
  const [existingCompanyId, setExistingCompanyId] = useState<string>('');
  const [existingCompanies, setExistingCompanies] = useState<Company[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 기존 회사 목록 가져오기
    chrome.runtime.sendMessage({ type: 'GET_COMPANIES_INTERNAL' }, (response) => {
      if (response?.companies) {
        setExistingCompanies(response.companies);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (saveTarget === 'new') {
        onSave({ companyName });
      } else {
        onSave({ companyName, existingCompanyId });
      }
    } catch (error) {
      console.error('Save error:', error);
      setIsSaving(false);
    }
  };

  return (
    <div className="aca-overlay">
      <div className="aca-modal">
        <header className="aca-modal-header">
          <h2>데이터 저장</h2>
          <button className="aca-close-btn" onClick={onCancel}>×</button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="aca-modal-body">
            {/* 이미지 미리보기 */}
            <div className="aca-preview">
              <img src={imageDataUrl} alt="캡처 미리보기" />
            </div>

            {/* 데이터 타입 */}
            <div className="aca-field">
              <label>데이터 타입</label>
              <div className="aca-input-readonly">
                {siteName} ({siteType})
              </div>
            </div>

            {/* 저장 대상 선택 */}
            <div className="aca-field">
              <label>저장 대상</label>
              <div className="aca-radio-group">
                <label>
                  <input
                    type="radio"
                    name="saveTarget"
                    value="new"
                    checked={saveTarget === 'new'}
                    onChange={() => setSaveTarget('new')}
                  />
                  새 회사 생성
                </label>
                <label>
                  <input
                    type="radio"
                    name="saveTarget"
                    value="existing"
                    checked={saveTarget === 'existing'}
                    onChange={() => setSaveTarget('existing')}
                    disabled={existingCompanies.length === 0}
                  />
                  기존 회사에 추가
                </label>
              </div>
            </div>

            {/* 새 회사 - 회사명 입력 */}
            {saveTarget === 'new' && (
              <div className="aca-field">
                <label>
                  회사명
                  {detectedCompanyName && (
                    <span className="aca-badge">자동 감지</span>
                  )}
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="회사명 입력"
                  required
                />
              </div>
            )}

            {/* 기존 회사 선택 */}
            {saveTarget === 'existing' && (
              <div className="aca-field">
                <label>회사 선택</label>
                <select
                  value={existingCompanyId}
                  onChange={(e) => setExistingCompanyId(e.target.value)}
                  required
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
          </div>

          <footer className="aca-modal-footer">
            <button type="button" onClick={onCancel} className="aca-btn-secondary">
              취소
            </button>
            <button
              type="submit"
              className="aca-btn-primary"
              disabled={isSaving || (saveTarget === 'new' && !companyName)}
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

/** 확인 팝업 표시 함수 */
export function showConfirmPopup(options: {
  imageDataUrl: string;
  detectedCompanyName: string | null;
  companyUrl: string;
  siteType: DataType;
  siteName: string;
}): Promise<{ companyName: string; existingCompanyId?: string } | null> {
  return new Promise((resolve) => {
    // 컨테이너 생성
    const container = document.createElement('div');
    container.id = 'aca-confirm-popup-container';
    document.body.appendChild(container);

    // 스타일 주입
    injectStyles();

    const root = createRoot(container);

    const cleanup = () => {
      root.unmount();
      container.remove();
    };

    root.render(
      <ConfirmPopup
        {...options}
        onSave={(data) => {
          cleanup();
          resolve(data);
        }}
        onCancel={() => {
          cleanup();
          resolve(null);
        }}
      />
    );
  });
}

/** 스타일 주입 */
function injectStyles() {
  if (document.getElementById('aca-confirm-popup-styles')) return;

  const style = document.createElement('style');
  style.id = 'aca-confirm-popup-styles';
  style.textContent = `
    .aca-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
    }
    .aca-modal {
      background: #F7F5F0;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }
    .aca-modal-header {
      padding: 16px;
      border-bottom: 2px solid #0F0F0F;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .aca-modal-header h2 {
      font-size: 16px;
      font-weight: 800;
      margin: 0;
    }
    .aca-close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #737373;
    }
    .aca-modal-body {
      padding: 16px;
    }
    .aca-preview {
      margin-bottom: 16px;
      border: 1px solid rgba(15, 15, 15, 0.1);
    }
    .aca-preview img {
      width: 100%;
      max-height: 200px;
      object-fit: contain;
    }
    .aca-field {
      margin-bottom: 16px;
    }
    .aca-field label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #3D3D3D;
      margin-bottom: 4px;
    }
    .aca-field input[type="text"],
    .aca-field select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid rgba(15, 15, 15, 0.2);
      background: white;
      font-size: 14px;
    }
    .aca-input-readonly {
      padding: 10px 12px;
      background: #E7E5E0;
      font-size: 14px;
      color: #3D3D3D;
    }
    .aca-radio-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .aca-radio-group label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: normal;
      cursor: pointer;
    }
    .aca-badge {
      font-size: 10px;
      background: #059669;
      color: white;
      padding: 2px 6px;
      margin-left: 8px;
    }
    .aca-modal-footer {
      padding: 16px;
      border-top: 1px solid rgba(15, 15, 15, 0.08);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .aca-btn-primary, .aca-btn-secondary {
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .aca-btn-primary {
      background: #0F0F0F;
      color: white;
      border: 2px solid #0F0F0F;
    }
    .aca-btn-secondary {
      background: transparent;
      color: #0F0F0F;
      border: 2px solid #0F0F0F;
    }
    .aca-btn-primary:disabled {
      background: #B0B0B0;
      border-color: #B0B0B0;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
}

export default ConfirmPopup;
```

### Content Script에서 사용

```typescript
// extension/src/content/index.ts

import { showConfirmPopup } from './confirm-popup';
import { scrapeCurrentPage } from './scraper';
import { detectSite } from '@/lib/sites';

// 영역 캡처 후 확인 팝업 표시
async function handleRegionCapture(dataUrl: string) {
  const site = detectSite(window.location.href);
  if (!site) return;

  const pageData = scrapeCurrentPage();

  const result = await showConfirmPopup({
    imageDataUrl: dataUrl,
    detectedCompanyName: pageData?.companyName || null,
    companyUrl: window.location.href,
    siteType: site.type,
    siteName: site.name,
  });

  if (result) {
    // Service Worker로 저장 요청
    chrome.runtime.sendMessage({
      type: 'CAPTURE_REGION',
      payload: {
        dataUrl,
        companyName: result.companyName,
        companyUrl: window.location.href,
        siteType: site.type,
        existingCompanyId: result.existingCompanyId,
      },
    });
  }
}
```

## 완료 기준

- [ ] 캡처 후 확인 팝업 표시
- [ ] 캡처된 이미지 미리보기 표시
- [ ] 자동 감지된 회사명 표시 (있는 경우)
- [ ] 새 회사/기존 회사 선택 가능
- [ ] 기존 회사 목록 드롭다운 표시
- [ ] 저장 버튼 클릭 시 Service Worker로 전송
- [ ] 취소 버튼 클릭 시 팝업 닫힘

## 참조 문서

- spec/06-page-layouts.md Section 7 (Confirm Popup)
