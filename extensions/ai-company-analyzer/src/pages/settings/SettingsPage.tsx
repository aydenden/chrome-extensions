import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { SiteConfig, AISettings, DataType } from '@/types/storage';
import {
  getSiteConfigs,
  saveSiteConfigs,
  getAISettings,
  saveAISettings,
} from '@/lib/settings';
import { exportAllData, clearAllData } from '@/lib/storage';
import { db } from '@/lib/db';
import './settings.css';

type TabType = 'sites' | 'ai' | 'data';

// Data Types 목록
const DATA_TYPE_OPTIONS: { value: DataType; label: string }[] = [
  { value: 'company_info', label: '기업 기본정보' },
  { value: 'finance_inno', label: '재무/고용 (혁신의숲)' },
  { value: 'finance_dart', label: 'PDF 재무제표 (DART)' },
  { value: 'finance_smes', label: '대차대조표/손익 (중기벤처)' },
  { value: 'review_blind', label: '리뷰 (블라인드)' },
  { value: 'review_jobplanet', label: '리뷰 (잡플래닛)' },
];

// ============ Site Edit Modal ============
interface SiteEditModalProps {
  site: SiteConfig | null;
  isNew: boolean;
  onSave: (site: SiteConfig) => void;
  onCancel: () => void;
}

function SiteEditModal({ site, isNew, onSave, onCancel }: SiteEditModalProps) {
  const [formData, setFormData] = useState<SiteConfig>(
    site || {
      id: crypto.randomUUID(),
      name: '',
      urlPattern: 'https://',
      dataTypes: ['company_info'] as DataType[],
      extractionGuide: '',
    }
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDataTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value as DataType);
    setFormData((prev) => ({ ...prev, dataTypes: selected }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.urlPattern.trim()) {
      alert('사이트명과 URL 패턴은 필수입니다.');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isNew ? '사이트 추가' : '사이트 편집'}</h2>
          <button className="modal-close" onClick={onCancel}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">사이트명 *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="예: 원티드"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="urlPattern">URL 패턴 *</label>
            <input
              type="text"
              id="urlPattern"
              name="urlPattern"
              value={formData.urlPattern}
              onChange={handleChange}
              placeholder="예: https://www.wanted.co.kr/company/*"
              required
            />
            <span className="help-text">*를 와일드카드로 사용할 수 있습니다.</span>
          </div>

          <div className="form-group">
            <label htmlFor="dataTypes">데이터 타입</label>
            <select
              id="dataTypes"
              name="dataTypes"
              multiple
              value={formData.dataTypes}
              onChange={handleDataTypeChange}
              className="multi-select"
            >
              {DATA_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="help-text">Ctrl/Cmd 클릭으로 다중 선택</span>
          </div>

          <div className="form-group">
            <label htmlFor="extractionGuide">추출 가이드</label>
            <textarea
              id="extractionGuide"
              name="extractionGuide"
              value={formData.extractionGuide}
              onChange={handleChange}
              placeholder="데이터 추출 시 참고할 안내 문구"
              rows={3}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              취소
            </button>
            <button type="submit" className="btn btn-primary">
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ Site Settings Panel ============
interface SiteSettingsProps {
  sites: SiteConfig[];
  onUpdate: (sites: SiteConfig[]) => void;
}

function SiteSettings({ sites, onUpdate }: SiteSettingsProps) {
  const [editingSite, setEditingSite] = useState<SiteConfig | null>(null);
  const [isNewSite, setIsNewSite] = useState(false);

  const handleEdit = (site: SiteConfig) => {
    setEditingSite(site);
    setIsNewSite(false);
  };

  const handleAdd = () => {
    setEditingSite(null);
    setIsNewSite(true);
  };

  const handleSave = async (site: SiteConfig) => {
    let newSites: SiteConfig[];
    if (isNewSite) {
      newSites = [...sites, site];
    } else {
      newSites = sites.map((s) => (s.id === site.id ? site : s));
    }
    await saveSiteConfigs(newSites);
    onUpdate(newSites);
    setEditingSite(null);
    setIsNewSite(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 사이트 설정을 삭제하시겠습니까?')) return;
    const newSites = sites.filter((s) => s.id !== id);
    await saveSiteConfigs(newSites);
    onUpdate(newSites);
  };

  const handleReset = async () => {
    if (!confirm('기본 설정으로 초기화하시겠습니까? 모든 사이트 설정이 초기값으로 복원됩니다.')) return;
    await chrome.storage.local.remove('siteConfigs');
    const defaultSites = await getSiteConfigs();
    onUpdate(defaultSites);
  };

  const handleCancel = () => {
    setEditingSite(null);
    setIsNewSite(false);
  };

  return (
    <div className="settings-panel">
      <div className="panel-header">
        <h2>사이트 설정</h2>
        <div className="panel-actions">
          <button className="btn btn-secondary" onClick={handleReset}>
            기본값 초기화
          </button>
          <button className="btn btn-primary" onClick={handleAdd}>
            + 사이트 추가
          </button>
        </div>
      </div>

      <div className="site-list">
        {sites.map((site) => (
          <div key={site.id} className="site-item">
            <div className="site-info">
              <h3 className="site-name">{site.name}</h3>
              <p className="site-pattern">{site.urlPattern}</p>
              <div className="site-types">
                {site.dataTypes.map((type) => (
                  <span key={type} className="type-badge">
                    {DATA_TYPE_OPTIONS.find((o) => o.value === type)?.label || type}
                  </span>
                ))}
              </div>
            </div>
            <div className="site-actions">
              <button className="btn btn-icon" onClick={() => handleEdit(site)} title="편집">
                ✏️
              </button>
              <button
                className="btn btn-icon btn-danger"
                onClick={() => handleDelete(site.id)}
                title="삭제"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}

        {sites.length === 0 && (
          <div className="empty-state">
            <p>등록된 사이트가 없습니다.</p>
          </div>
        )}
      </div>

      {(editingSite !== null || isNewSite) && (
        <SiteEditModal
          site={editingSite}
          isNew={isNewSite}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

// ============ AI Settings Panel ============
interface AISettingsPanelProps {
  settings: AISettings;
  onUpdate: (settings: AISettings) => void;
}

function AISettingsPanel({ settings, onUpdate }: AISettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  const handleWeightChange = (financial: number) => {
    const newSettings = {
      ...localSettings,
      weights: {
        financial,
        review: 100 - financial,
      },
    };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handlePromptChange = (key: keyof AISettings['prompts'], value: string) => {
    const newSettings = {
      ...localSettings,
      prompts: {
        ...localSettings.prompts,
        [key]: value,
      },
    };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = async () => {
    await saveAISettings(localSettings);
    onUpdate(localSettings);
    setHasChanges(false);
    alert('AI 설정이 저장되었습니다.');
  };

  const handleReset = async () => {
    if (!confirm('AI 설정을 기본값으로 초기화하시겠습니까?')) return;
    await chrome.storage.local.remove('aiSettings');
    const defaultSettings = await getAISettings();
    setLocalSettings(defaultSettings);
    onUpdate(defaultSettings);
    setHasChanges(false);
  };

  return (
    <div className="settings-panel">
      <div className="panel-header">
        <h2>AI 설정</h2>
        <div className="panel-actions">
          <button className="btn btn-secondary" onClick={handleReset}>
            기본값 초기화
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!hasChanges}>
            저장
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>분석 가중치</h3>
        <div className="weight-slider-container">
          <div className="weight-labels">
            <span>재무 분석: {localSettings.weights.financial}%</span>
            <span>리뷰 분석: {localSettings.weights.review}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={localSettings.weights.financial}
            onChange={(e) => handleWeightChange(parseInt(e.target.value))}
            className="weight-slider"
          />
          <div className="weight-bar">
            <div
              className="weight-financial"
              style={{ width: `${localSettings.weights.financial}%` }}
            />
            <div
              className="weight-review"
              style={{ width: `${localSettings.weights.review}%` }}
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>프롬프트 설정</h3>

        <div className="form-group">
          <label htmlFor="companyExtraction">회사명 추출</label>
          <textarea
            id="companyExtraction"
            value={localSettings.prompts.companyExtraction}
            onChange={(e) => handlePromptChange('companyExtraction', e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="financialAnalysis">재무 분석</label>
          <textarea
            id="financialAnalysis"
            value={localSettings.prompts.financialAnalysis}
            onChange={(e) => handlePromptChange('financialAnalysis', e.target.value)}
            rows={6}
          />
        </div>

        <div className="form-group">
          <label htmlFor="reviewAnalysis">리뷰 분석</label>
          <textarea
            id="reviewAnalysis"
            value={localSettings.prompts.reviewAnalysis}
            onChange={(e) => handlePromptChange('reviewAnalysis', e.target.value)}
            rows={6}
          />
        </div>

        <div className="form-group">
          <label htmlFor="totalScore">종합 점수</label>
          <textarea
            id="totalScore"
            value={localSettings.prompts.totalScore}
            onChange={(e) => handlePromptChange('totalScore', e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {hasChanges && (
        <div className="unsaved-warning">
          저장하지 않은 변경사항이 있습니다.
        </div>
      )}
    </div>
  );
}

// ============ Data Management Panel ============
function DataManagement() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-company-analyzer-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('데이터가 내보내기되었습니다.');
    } catch (error) {
      console.error('Export error:', error);
      alert('내보내기 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 버전 확인
      if (!data.version || data.version !== 1) {
        throw new Error('지원하지 않는 파일 형식입니다.');
      }

      // 기존 데이터 확인
      const hasExisting = await db.companies.count();
      if (hasExisting > 0) {
        const overwrite = confirm(
          '기존 데이터가 있습니다. 덮어쓰시겠습니까?\n(취소를 누르면 기존 데이터에 추가됩니다)'
        );
        if (overwrite) {
          await clearAllData();
        }
      }

      // 데이터 가져오기
      await db.transaction(
        'rw',
        [db.companies, db.extractedData, db.binaryData, db.analysisResults],
        async () => {
          // 회사 추가
          if (data.companies?.length) {
            await db.companies.bulkPut(data.companies);
          }

          // 추출 데이터 추가
          if (data.extractedData?.length) {
            await db.extractedData.bulkPut(data.extractedData);
          }

          // 바이너리 데이터 추가 (base64 → Blob)
          if (data.binaryData?.length) {
            const binaryData = await Promise.all(
              data.binaryData.map(async (b: { id: string; mimeType: string; data: string }) => ({
                id: b.id,
                blob: await base64ToBlob(b.data),
                mimeType: b.mimeType,
              }))
            );
            await db.binaryData.bulkPut(binaryData);
          }

          // 분석 결과 추가
          if (data.analysisResults?.length) {
            await db.analysisResults.bulkPut(data.analysisResults);
          }
        }
      );

      alert('데이터를 성공적으로 가져왔습니다.');
    } catch (error) {
      console.error('Import error:', error);
      alert(`가져오기 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearAll = async () => {
    const firstConfirm = confirm(
      '모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.'
    );
    if (!firstConfirm) return;

    const secondConfirm = confirm(
      '정말로 삭제하시겠습니까?\n모든 회사 정보와 분석 결과가 영구적으로 삭제됩니다.'
    );
    if (!secondConfirm) return;

    try {
      await clearAllData();
      alert('모든 데이터가 삭제되었습니다.');
    } catch (error) {
      console.error('Clear all error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="settings-panel">
      <div className="panel-header">
        <h2>데이터 관리</h2>
      </div>

      <div className="data-management-section">
        <div className="data-action-card">
          <div className="action-icon">📤</div>
          <h3>데이터 내보내기</h3>
          <p>모든 회사 데이터와 분석 결과를 JSON 파일로 백업합니다.</p>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? '내보내는 중...' : '내보내기'}
          </button>
        </div>

        <div className="data-action-card">
          <div className="action-icon">📥</div>
          <h3>데이터 가져오기</h3>
          <p>백업한 JSON 파일에서 데이터를 복원합니다.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-primary"
            onClick={handleImportClick}
            disabled={isImporting}
          >
            {isImporting ? '가져오는 중...' : '가져오기'}
          </button>
        </div>

        <div className="data-action-card danger">
          <div className="action-icon">🗑️</div>
          <h3>모든 데이터 삭제</h3>
          <p>모든 회사 데이터와 분석 결과를 영구적으로 삭제합니다.</p>
          <button className="btn btn-danger" onClick={handleClearAll}>
            전체 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// Base64 → Blob 변환
async function base64ToBlob(base64: string): Promise<Blob> {
  const response = await fetch(base64);
  return response.blob();
}

// ============ Main Settings Page ============
function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('sites');
  const [siteConfigs, setSiteConfigs] = useState<SiteConfig[]>([]);
  const [aiSettings, setAISettings] = useState<AISettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [sites, ai] = await Promise.all([getSiteConfigs(), getAISettings()]);
      setSiteConfigs(sites);
      setAISettings(ai);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="settings-page">
        <div className="loading">설정을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <header className="page-header">
        <h1>설정</h1>
        <p className="subtitle">사이트 구성, AI 분석 옵션 및 데이터 관리</p>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'sites' ? 'active' : ''}`}
          onClick={() => setActiveTab('sites')}
        >
          🌐 사이트 설정
        </button>
        <button
          className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          🤖 AI 설정
        </button>
        <button
          className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          💾 데이터 관리
        </button>
      </nav>

      <main className="tab-content">
        {activeTab === 'sites' && (
          <SiteSettings sites={siteConfigs} onUpdate={setSiteConfigs} />
        )}
        {activeTab === 'ai' && aiSettings && (
          <AISettingsPanel settings={aiSettings} onUpdate={setAISettings} />
        )}
        {activeTab === 'data' && <DataManagement />}
      </main>

      <footer className="page-footer">
        <a href="list.html" className="footer-link">
          ← 회사 목록으로 돌아가기
        </a>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<SettingsPage />);
