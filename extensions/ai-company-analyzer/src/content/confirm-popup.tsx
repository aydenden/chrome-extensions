/**
 * 컨펌 팝업 컴포넌트
 * 데이터 추출 후 저장 확인을 위한 Shadow DOM 기반 모달
 */

import React, { useState, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { extractFromCurrentPage } from '@/lib/company-extractor';
import { detectCurrentSite, type SiteKey } from '@/lib/sites';
import type { Company, DataType } from '@/types/storage';

// Background에서 회사 목록 조회
async function fetchCompanies(): Promise<Company[]> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_COMPANIES' });
  if (!response.success) {
    throw new Error(response.error || '회사 목록 조회 실패');
  }
  return response.data;
}

// Background를 통해 이미지 데이터 저장
async function saveImageViaBackground(params: {
  companyName: string;
  imageData: string;
  dataType: DataType;
  source: string;
  isNewCompany: boolean;
  existingCompanyId?: string;
}): Promise<string> {
  const response = await chrome.runtime.sendMessage({
    type: 'SAVE_DATA',
    payload: {
      ...params,
      data: params.imageData,
      isImage: true,
    },
  });
  if (!response.success) {
    throw new Error(response.error || '데이터 저장 실패');
  }
  return response.companyId;
}

// ============================================================================
// 타입 정의
// ============================================================================

export interface ConfirmPopupData {
  /** 추출된 이미지 데이터 */
  data: Blob;
  /** 추출 URL */
  source: string;
}

interface ConfirmPopupProps {
  data: ConfirmPopupData;
  onClose: () => void;
  onSaved: () => void;
}

// ============================================================================
// 데이터 타입 옵션
// ============================================================================

const DATA_TYPE_OPTIONS: { value: DataType; label: string }[] = [
  { value: 'company_info', label: '기업 정보 (원티드)' },
  { value: 'finance_inno', label: '재무/고용 (혁신의숲)' },
  { value: 'finance_dart', label: '재무제표 (DART)' },
  { value: 'finance_smes', label: '재무현황 (중기부)' },
  { value: 'review_blind', label: '리뷰 (블라인드)' },
  { value: 'review_jobplanet', label: '리뷰 (잡플래닛)' },
];

// SiteKey → DataType 매핑
const SITE_TO_DATATYPE: Record<SiteKey, DataType> = {
  wanted: 'company_info',
  innoforest: 'finance_inno',
  dart: 'finance_dart',
  smes: 'finance_smes',
  blind: 'review_blind',
  jobplanet: 'review_jobplanet',
};

// ============================================================================
// 컨펌 팝업 컴포넌트
// ============================================================================

function ConfirmPopup({ data, onClose, onSaved }: ConfirmPopupProps) {
  // 상태 관리
  const [companyName, setCompanyName] = useState<string>('');
  const [autoDetected, setAutoDetected] = useState<boolean>(false);
  const [dataType, setDataType] = useState<DataType>('company_info');
  const [saveTarget, setSaveTarget] = useState<'new' | 'existing'>('new');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 초기화
  useEffect(() => {
    // 회사명 자동 감지 (비동기)
    (async () => {
      const extractedName = await extractFromCurrentPage();
      if (extractedName) {
        setCompanyName(extractedName);
        setAutoDetected(true);
      }
    })();

    // 기존 회사 목록 로드 (Background를 통해)
    fetchCompanies().then(setCompanies).catch(console.error);

    // URL에서 사이트 감지 → DataType 자동 설정
    const detectedSite = detectCurrentSite(data.source);
    if (detectedSite) {
      setDataType(SITE_TO_DATATYPE[detectedSite]);
    }

    // 이미지 미리보기 URL 생성
    const url = URL.createObjectURL(data.data);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [data]);

  // 저장 핸들러
  const handleSave = async () => {
    // 유효성 검증
    if (!companyName.trim()) {
      setError('회사명을 입력해주세요.');
      return;
    }

    if (saveTarget === 'existing' && !selectedCompanyId) {
      setError('기존 회사를 선택해주세요.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // 이미지 Blob → base64 변환
      const imageData = await blobToBase64(data.data);

      // Background를 통해 저장
      await saveImageViaBackground({
        companyName: companyName.trim(),
        imageData,
        dataType,
        source: data.source,
        isNewCompany: saveTarget === 'new',
        existingCompanyId: saveTarget === 'existing' ? selectedCompanyId : undefined,
      });

      onSaved();
      onClose();
    } catch (err) {
      console.error('저장 실패:', err);
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // Blob → Base64 변환 유틸리티
  async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="confirm-header">
          <h2>데이터 저장</h2>
          <button className="close-btn" onClick={onClose} aria-label="닫기">
            &times;
          </button>
        </div>

        {/* 미리보기 */}
        <div className="preview-section">
          <h3>미리보기</h3>
          {imagePreviewUrl && (
            <div className="image-preview">
              <img src={imagePreviewUrl} alt="캡처 이미지" />
            </div>
          )}
        </div>

        {/* 폼 */}
        <div className="form-section">
          {/* 회사명 */}
          <div className="form-group">
            <label htmlFor="company-name">
              회사명
              {autoDetected && <span className="auto-badge">자동 감지</span>}
            </label>
            <input
              id="company-name"
              type="text"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setAutoDetected(false);
              }}
              placeholder="회사명을 입력하세요"
              disabled={isSaving}
            />
          </div>

          {/* 데이터 타입 */}
          <div className="form-group">
            <label htmlFor="data-type">데이터 타입</label>
            <select
              id="data-type"
              value={dataType}
              onChange={(e) => setDataType(e.target.value as DataType)}
              disabled={isSaving}
            >
              {DATA_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 저장 대상 */}
          <div className="form-group">
            <label>저장 대상</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="save-target"
                  value="new"
                  checked={saveTarget === 'new'}
                  onChange={() => setSaveTarget('new')}
                  disabled={isSaving}
                />
                새 회사 생성
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="save-target"
                  value="existing"
                  checked={saveTarget === 'existing'}
                  onChange={() => setSaveTarget('existing')}
                  disabled={isSaving || companies.length === 0}
                />
                기존 회사에 추가 {companies.length === 0 && '(저장된 회사 없음)'}
              </label>
            </div>
          </div>

          {/* 기존 회사 선택 */}
          {saveTarget === 'existing' && (
            <div className="form-group">
              <label htmlFor="existing-company">기존 회사 선택</label>
              <select
                id="existing-company"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                disabled={isSaving}
              >
                <option value="">회사를 선택하세요</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && <div className="error-message">{error}</div>}
        </div>

        {/* 버튼 */}
        <div className="confirm-footer">
          <button className="btn btn-cancel" onClick={onClose} disabled={isSaving}>
            취소
          </button>
          <button className="btn btn-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 스타일
// ============================================================================

const POPUP_STYLES = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .confirm-modal {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .confirm-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #eee;
  }

  .confirm-header h2 {
    font-size: 18px;
    font-weight: 600;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    color: #999;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }

  .close-btn:hover {
    color: #333;
  }

  .preview-section {
    padding: 16px 20px;
    background: #f9f9f9;
    border-bottom: 1px solid #eee;
  }

  .preview-section h3 {
    font-size: 14px;
    font-weight: 500;
    color: #666;
    margin-bottom: 12px;
  }

  .image-preview {
    text-align: center;
  }

  .image-preview img {
    max-width: 100%;
    max-height: 200px;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  .form-section {
    padding: 20px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #333;
    margin-bottom: 6px;
  }

  .auto-badge {
    display: inline-block;
    background: #e3f2fd;
    color: #1565c0;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 8px;
    font-weight: 400;
  }

  .form-group input[type="text"],
  .form-group select {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    border: 1px solid #ddd;
    border-radius: 8px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .form-group input[type="text"]:focus,
  .form-group select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  }

  .form-group input:disabled,
  .form-group select:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #333;
    cursor: pointer;
  }

  .radio-label input[type="radio"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .error-message {
    background: #fef0f0;
    color: #c53030;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 13px;
    margin-top: 8px;
  }

  .confirm-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid #eee;
    background: #f9f9f9;
  }

  .btn {
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-cancel {
    background: white;
    border: 1px solid #ddd;
    color: #666;
  }

  .btn-cancel:hover:not(:disabled) {
    background: #f5f5f5;
  }

  .btn-save {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    color: white;
  }

  .btn-save:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    transform: translateY(-1px);
  }
`;

// ============================================================================
// Shadow DOM 마운트
// ============================================================================

const SHADOW_HOST_ID = 'ai-company-analyzer-confirm-popup';

let shadowRoot: ShadowRoot | null = null;
let reactRoot: Root | null = null;

/**
 * 컨펌 팝업을 표시합니다.
 */
export function showConfirmPopup(data: ConfirmPopupData): void {
  // 이미 표시 중이면 제거
  hideConfirmPopup();

  // Shadow Host 생성
  const host = document.createElement('div');
  host.id = SHADOW_HOST_ID;
  document.body.appendChild(host);

  // Shadow Root 생성 (closed 모드로 CSS 격리)
  shadowRoot = host.attachShadow({ mode: 'closed' });

  // 스타일 삽입
  const style = document.createElement('style');
  style.textContent = POPUP_STYLES;
  shadowRoot.appendChild(style);

  // React 마운트 컨테이너 생성
  const container = document.createElement('div');
  shadowRoot.appendChild(container);

  // React 렌더링
  reactRoot = createRoot(container);
  reactRoot.render(
    <ConfirmPopup
      data={data}
      onClose={hideConfirmPopup}
      onSaved={() => {
        console.log('데이터 저장 완료');
      }}
    />
  );
}

/**
 * 컨펌 팝업을 숨깁니다.
 */
export function hideConfirmPopup(): void {
  // React 언마운트
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }

  // Shadow Host 제거
  const host = document.getElementById(SHADOW_HOST_ID);
  if (host) {
    host.remove();
  }

  shadowRoot = null;
}

// ============================================================================
// 메시지 리스너
// ============================================================================

// SHOW_CONFIRM_POPUP 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_CONFIRM_POPUP') {
    const { data, source } = message.data;

    // base64 이미지 데이터를 Blob으로 변환
    if (typeof data === 'string') {
      fetch(data)
        .then((res) => res.blob())
        .then((blob) => {
          showConfirmPopup({ data: blob, source });
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error('Blob 변환 실패:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // 비동기 응답
    }
  }

  if (message.type === 'HIDE_CONFIRM_POPUP') {
    hideConfirmPopup();
    sendResponse({ success: true });
  }

  return false;
});
