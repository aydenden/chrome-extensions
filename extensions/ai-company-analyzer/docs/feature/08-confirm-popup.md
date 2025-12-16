# 08. 컨펌 팝업

## 개요
데이터 추출 후 확인 및 저장 모달 구현

## 선행 조건
- 03-company-extraction 완료
- 04-element-picker 완료
- 05-graph-capture 완료
- 06-pdf-processing 완료

## 기술 스택
| 분류 | 기술 |
|------|------|
| UI | React + Shadow DOM |
| 데이터 | 추출된 텍스트/이미지 |

---

## 화면 구성

```
┌─────────────────────────────────────┐
│ 데이터 추출 완료                      │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 추출된 데이터 미리보기           │ │
│ │ (텍스트 또는 이미지)             │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ 회사명: [삼성전자        ] (자동감지) │
│                                     │
│ 데이터 타입: [기업 정보  ▼]          │
│                                     │
│ 저장 대상:                          │
│ ○ 새 회사로 저장                    │
│ ○ 기존 회사에 추가: [선택   ▼]       │
├─────────────────────────────────────┤
│     [취소]          [저장]           │
└─────────────────────────────────────┘
```

---

## 구현

### src/content/confirm-popup.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { extractCompanyName } from '@/lib/company-extractor';
import { createCompany, saveText, saveImage, getAllCompanies } from '@/lib/storage';
import type { Company, DataType } from '@/types/storage';

interface ConfirmPopupProps {
  type: 'text' | 'image';
  data: string | Blob;
  url: string;
  title: string;
  onClose: () => void;
}

// 데이터 타입 옵션
const DATA_TYPE_OPTIONS: { value: DataType; label: string }[] = [
  { value: 'company_info', label: '기업 정보 (원티드)' },
  { value: 'finance_inno', label: '재무/고용 (혁신의숲)' },
  { value: 'finance_dart', label: 'PDF 재무제표 (DART)' },
  { value: 'finance_smes', label: '재무 정보 (중기벤처)' },
  { value: 'review_blind', label: '리뷰 (블라인드)' },
  { value: 'review_jobplanet', label: '리뷰 (잡플래닛)' },
];

function ConfirmPopup({ type, data, url, title, onClose }: ConfirmPopupProps) {
  const [companyName, setCompanyName] = useState('');
  const [dataType, setDataType] = useState<DataType>('company_info');
  const [saveTarget, setSaveTarget] = useState<'new' | 'existing'>('new');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 초기화
  useEffect(() => {
    // 회사명 자동 추출
    const textContent = type === 'text' ? (data as string) : undefined;
    extractCompanyName(url, title, textContent).then((name) => {
      if (name) setCompanyName(name);
    });

    // 기존 회사 목록 로드
    getAllCompanies().then(setCompanies);

    // 이미지 미리보기 URL 생성
    if (type === 'image' && data instanceof Blob) {
      const url = URL.createObjectURL(data);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [type, data, url, title]);

  // 저장 처리
  const handleSave = async () => {
    if (!companyName.trim()) {
      alert('회사명을 입력해주세요.');
      return;
    }

    setIsSaving(true);

    try {
      let targetCompanyId: string;

      if (saveTarget === 'new') {
        // 새 회사 생성
        targetCompanyId = await createCompany(companyName.trim());
      } else {
        // 기존 회사 사용
        if (!selectedCompanyId) {
          alert('회사를 선택해주세요.');
          setIsSaving(false);
          return;
        }
        targetCompanyId = selectedCompanyId;
      }

      // 데이터 저장
      if (type === 'text') {
        await saveText(targetCompanyId, data as string, dataType, url);
      } else {
        await saveImage(targetCompanyId, data as Blob, dataType, url);
      }

      onClose();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="confirm-popup-overlay">
      <div className="confirm-popup">
        <header className="popup-header">
          <h2>데이터 추출 완료</h2>
        </header>

        {/* 미리보기 */}
        <section className="preview-section">
          {type === 'text' ? (
            <div className="text-preview">
              {(data as string).slice(0, 500)}
              {(data as string).length > 500 && '...'}
            </div>
          ) : (
            imagePreviewUrl && (
              <img
                src={imagePreviewUrl}
                alt="추출된 이미지"
                className="image-preview"
              />
            )
          )}
        </section>

        {/* 회사명 입력 */}
        <section className="form-section">
          <label>
            회사명
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="회사명 입력"
            />
            {companyName && <span className="auto-detected">(자동 감지)</span>}
          </label>
        </section>

        {/* 데이터 타입 선택 */}
        <section className="form-section">
          <label>
            데이터 타입
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value as DataType)}
            >
              {DATA_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* 저장 대상 선택 */}
        <section className="form-section">
          <label>저장 대상</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="saveTarget"
                checked={saveTarget === 'new'}
                onChange={() => setSaveTarget('new')}
              />
              새 회사로 저장
            </label>
            <label>
              <input
                type="radio"
                name="saveTarget"
                checked={saveTarget === 'existing'}
                onChange={() => setSaveTarget('existing')}
              />
              기존 회사에 추가
              {saveTarget === 'existing' && (
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                >
                  <option value="">선택...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
        </section>

        {/* 버튼 */}
        <footer className="popup-footer">
          <button className="btn-cancel" onClick={onClose} disabled={isSaving}>
            취소
          </button>
          <button className="btn-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ============ 마운트/언마운트 헬퍼 ============

let shadowHost: HTMLDivElement | null = null;
let root: Root | null = null;

export function showConfirmPopup(props: Omit<ConfirmPopupProps, 'onClose'>) {
  if (shadowHost) {
    hideConfirmPopup();
  }

  // Shadow DOM 생성
  shadowHost = document.createElement('div');
  shadowHost.id = 'ai-company-analyzer-confirm';
  document.body.appendChild(shadowHost);

  const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

  // 스타일 삽입
  const style = document.createElement('style');
  style.textContent = getConfirmPopupStyles();
  shadowRoot.appendChild(style);

  // React 컨테이너
  const container = document.createElement('div');
  shadowRoot.appendChild(container);

  // React 렌더링
  root = createRoot(container);
  root.render(
    <ConfirmPopup
      {...props}
      onClose={hideConfirmPopup}
    />
  );
}

export function hideConfirmPopup() {
  if (root) {
    root.unmount();
    root = null;
  }
  if (shadowHost) {
    shadowHost.remove();
    shadowHost = null;
  }
}

function getConfirmPopupStyles(): string {
  return `
    .confirm-popup-overlay {
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .confirm-popup {
      background: white;
      border-radius: 12px;
      width: 400px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    .popup-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
    }

    .popup-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .preview-section {
      padding: 16px 20px;
      background: #f5f5f5;
      max-height: 200px;
      overflow: auto;
    }

    .text-preview {
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .image-preview {
      max-width: 100%;
      border-radius: 4px;
    }

    .form-section {
      padding: 12px 20px;
    }

    .form-section label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #666;
      margin-bottom: 6px;
    }

    .form-section input[type="text"],
    .form-section select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
    }

    .auto-detected {
      font-size: 12px;
      color: #2e7d32;
      margin-left: 8px;
    }

    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .radio-group label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: normal;
    }

    .radio-group select {
      margin-left: 8px;
      width: auto;
    }

    .popup-footer {
      padding: 16px 20px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .btn-cancel,
    .btn-save {
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-cancel {
      background: #f5f5f5;
      border: 1px solid #ddd;
      color: #333;
    }

    .btn-cancel:hover:not(:disabled) {
      background: #e0e0e0;
    }

    .btn-save {
      background: #1976d2;
      border: none;
      color: white;
    }

    .btn-save:hover:not(:disabled) {
      background: #1565c0;
    }

    .btn-cancel:disabled,
    .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;
}
```

### 메시지 리스너 (Content Script)

```typescript
// src/content/index.ts에 추가
import { showConfirmPopup } from './confirm-popup';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_CONFIRM_POPUP') {
    showConfirmPopup({
      type: message.payload.type,
      data: message.payload.data,
      url: message.payload.url,
      title: message.payload.title,
    });
    sendResponse({ success: true });
  }
  return true;
});
```

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/content/confirm-popup.tsx` | 컨펌 팝업 컴포넌트 |

---

## 참조 문서
- [spec/02-data-extraction.md](../spec/02-data-extraction.md) - 데이터 추출 (컨펌 팝업 섹션)
