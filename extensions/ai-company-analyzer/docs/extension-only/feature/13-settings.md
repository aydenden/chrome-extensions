# 13. 설정 페이지

## 개요
사이트 설정 및 AI 설정 관리 페이지 구현

## 선행 조건
- 전체 기능 완료

## 기술 스택
| 분류 | 기술 |
|------|------|
| UI | React + TypeScript |
| 저장 | chrome.storage.local |

---

## 화면 구성

```
┌─────────────────────────────────────────────────────────────┐
│ 설정                                                        │
├─────────────────────────────────────────────────────────────┤
│ [사이트 설정] [AI 설정] [데이터 관리]                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 사이트 설정                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 원티드                                          [편집]  │ │
│ │ URL: https://www.wanted.co.kr/company/*                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 혁신의숲                                        [편집]  │ │
│ │ URL: https://www.innoforest.co.kr/*                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ...                                                         │
│                                                             │
│ [+ 사이트 추가]                    [기본값으로 초기화]       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ AI 설정                                                     │
│                                                             │
│ 가중치                                                      │
│ 재무 분석: [====60%====]                                    │
│ 리뷰 분석: [====40%====]                                    │
│                                                             │
│ 프롬프트 설정                                               │
│ [재무 분석 프롬프트]                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ {financial_data}를 분석해...                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 데이터 관리                                                 │
│                                                             │
│ [데이터 내보내기 (JSON)]                                    │
│ [데이터 가져오기]                                           │
│ [전체 데이터 삭제]                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 구현

### src/pages/settings/SettingsPage.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  getSiteConfigs,
  getAISettings,
  saveSettings,
  SiteConfig,
  AISettings,
} from '@/lib/settings';
import { exportAllData, clearAllData } from '@/lib/storage';
import './settings.css';

type Tab = 'sites' | 'ai' | 'data';

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sites');
  const [siteConfigs, setSiteConfigs] = useState<SiteConfig[]>([]);
  const [aiSettings, setAISettings] = useState<AISettings | null>(null);
  const [editingSite, setEditingSite] = useState<SiteConfig | null>(null);

  // 설정 로드
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const sites = await getSiteConfigs();
    const ai = await getAISettings();
    setSiteConfigs(sites);
    setAISettings(ai);
  };

  return (
    <div className="settings-page">
      <header className="page-header">
        <h1>설정</h1>
      </header>

      <nav className="tab-nav">
        <button
          className={activeTab === 'sites' ? 'active' : ''}
          onClick={() => setActiveTab('sites')}
        >
          사이트 설정
        </button>
        <button
          className={activeTab === 'ai' ? 'active' : ''}
          onClick={() => setActiveTab('ai')}
        >
          AI 설정
        </button>
        <button
          className={activeTab === 'data' ? 'active' : ''}
          onClick={() => setActiveTab('data')}
        >
          데이터 관리
        </button>
      </nav>

      <main className="tab-content">
        {activeTab === 'sites' && (
          <SiteSettings
            configs={siteConfigs}
            onUpdate={setSiteConfigs}
            editingSite={editingSite}
            onEditSite={setEditingSite}
          />
        )}
        {activeTab === 'ai' && aiSettings && (
          <AISettingsPanel
            settings={aiSettings}
            onUpdate={setAISettings}
          />
        )}
        {activeTab === 'data' && <DataManagement />}
      </main>
    </div>
  );
}

// ============ 사이트 설정 ============

function SiteSettings({
  configs,
  onUpdate,
  editingSite,
  onEditSite,
}: {
  configs: SiteConfig[];
  onUpdate: (configs: SiteConfig[]) => void;
  editingSite: SiteConfig | null;
  onEditSite: (site: SiteConfig | null) => void;
}) {
  const handleSave = async (site: SiteConfig) => {
    const newConfigs = configs.map((c) => (c.id === site.id ? site : c));
    onUpdate(newConfigs);
    await saveSettings('siteConfigs', newConfigs);
    onEditSite(null);
  };

  const handleDelete = async (siteId: string) => {
    if (!confirm('이 사이트 설정을 삭제하시겠습니까?')) return;
    const newConfigs = configs.filter((c) => c.id !== siteId);
    onUpdate(newConfigs);
    await saveSettings('siteConfigs', newConfigs);
  };

  const handleAdd = () => {
    onEditSite({
      id: crypto.randomUUID(),
      name: '',
      urlPattern: '',
      dataTypes: [],
      extractionGuide: '',
    });
  };

  const handleReset = async () => {
    if (!confirm('사이트 설정을 기본값으로 초기화하시겠습니까?')) return;
    await chrome.storage.local.remove('siteConfigs');
    await loadSettings();
  };

  return (
    <div className="site-settings">
      <div className="site-list">
        {configs.map((config) => (
          <div key={config.id} className="site-item">
            <div className="site-info">
              <h3>{config.name}</h3>
              <p className="url-pattern">{config.urlPattern}</p>
            </div>
            <div className="site-actions">
              <button onClick={() => onEditSite(config)}>편집</button>
              <button onClick={() => handleDelete(config.id)}>삭제</button>
            </div>
          </div>
        ))}
      </div>

      <div className="site-actions-bottom">
        <button className="btn-add" onClick={handleAdd}>
          + 사이트 추가
        </button>
        <button className="btn-reset" onClick={handleReset}>
          기본값으로 초기화
        </button>
      </div>

      {editingSite && (
        <SiteEditModal
          site={editingSite}
          onSave={handleSave}
          onClose={() => onEditSite(null)}
        />
      )}
    </div>
  );
}

// 사이트 편집 모달
function SiteEditModal({
  site,
  onSave,
  onClose,
}: {
  site: SiteConfig;
  onSave: (site: SiteConfig) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(site);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>사이트 편집</h3>
        <div className="form-group">
          <label>사이트명</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>URL 패턴</label>
          <input
            value={form.urlPattern}
            onChange={(e) => setForm({ ...form, urlPattern: e.target.value })}
            placeholder="https://example.com/*"
          />
        </div>
        <div className="form-group">
          <label>추출 가이드</label>
          <textarea
            value={form.extractionGuide}
            onChange={(e) => setForm({ ...form, extractionGuide: e.target.value })}
          />
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>취소</button>
          <button onClick={() => onSave(form)}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ============ AI 설정 ============

function AISettingsPanel({
  settings,
  onUpdate,
}: {
  settings: AISettings;
  onUpdate: (settings: AISettings) => void;
}) {
  const handleWeightChange = async (financial: number) => {
    const newSettings = {
      ...settings,
      weights: { financial, review: 100 - financial },
    };
    onUpdate(newSettings);
    await saveSettings('aiSettings', newSettings);
  };

  const handlePromptChange = async (key: keyof AISettings['prompts'], value: string) => {
    const newSettings = {
      ...settings,
      prompts: { ...settings.prompts, [key]: value },
    };
    onUpdate(newSettings);
    await saveSettings('aiSettings', newSettings);
  };

  return (
    <div className="ai-settings">
      <section className="weights-section">
        <h3>가중치</h3>
        <div className="weight-slider">
          <label>재무 분석: {settings.weights.financial}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.weights.financial}
            onChange={(e) => handleWeightChange(parseInt(e.target.value))}
          />
        </div>
        <div className="weight-slider">
          <label>리뷰 분석: {settings.weights.review}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.weights.review}
            disabled
          />
        </div>
      </section>

      <section className="prompts-section">
        <h3>프롬프트 설정</h3>
        {Object.entries(settings.prompts).map(([key, value]) => (
          <div key={key} className="prompt-item">
            <label>{getPromptLabel(key)}</label>
            <textarea
              value={value}
              onChange={(e) => handlePromptChange(key as any, e.target.value)}
              rows={4}
            />
          </div>
        ))}
      </section>
    </div>
  );
}

function getPromptLabel(key: string): string {
  const labels: Record<string, string> = {
    companyExtraction: '회사명 추출',
    financialAnalysis: '재무 분석',
    reviewAnalysis: '리뷰 분석',
    totalScore: '종합 점수',
  };
  return labels[key] || key;
}

// ============ 데이터 관리 ============

function DataManagement() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-company-analyzer-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('내보내기 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // TODO: 데이터 가져오기 구현
      alert('가져오기 기능은 준비 중입니다.');
    } catch (error) {
      alert('파일을 읽는 중 오류가 발생했습니다.');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('정말 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    if (!confirm('마지막 확인: 모든 회사 데이터와 분석 결과가 삭제됩니다.')) {
      return;
    }

    try {
      await clearAllData();
      alert('모든 데이터가 삭제되었습니다.');
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="data-management">
      <div className="data-actions">
        <button onClick={handleExport} disabled={isExporting}>
          {isExporting ? '내보내는 중...' : '데이터 내보내기 (JSON)'}
        </button>

        <label className="import-btn">
          데이터 가져오기
          <input
            type="file"
            accept="application/json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </label>

        <button className="btn-danger" onClick={handleClearAll}>
          전체 데이터 삭제
        </button>
      </div>
    </div>
  );
}

// 렌더링
const root = createRoot(document.getElementById('root')!);
root.render(<SettingsPage />);
```

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/pages/settings/SettingsPage.tsx` | 설정 페이지 컴포넌트 |
| `src/pages/settings/settings.css` | 스타일 |
| `src/pages/settings/settings.html` | HTML 엔트리 |

---

## 참조 문서
- [spec/06-settings.md](../spec/06-settings.md) - 설정 기능
