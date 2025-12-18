# Feature 24: 설정 페이지

## 개요

SPA의 설정 페이지로 AI 엔진 설정, OCR 설정, 데이터 관리 기능을 제공합니다.

## 범위

- Settings 페이지 레이아웃
- AI 엔진 설정 (Qwen3 vs Ollama)
- OCR 언어 설정
- 데이터 초기화 기능
- 저장소 사용량 표시

## 의존성

- Feature 19: React Router 설정

## 구현 상세

### spa/src/pages/Settings.tsx

```tsx
import { useState } from 'react';
import { PageHeader } from '@/components/layout';
import { Button, Card, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStats } from '@/hooks/useStats';
import { getExtensionClient } from '@/lib/extension-client';

interface SettingsState {
  aiEngine: 'qwen3' | 'ollama';
  ollamaEndpoint: string;
  ocrLanguage: 'kor' | 'eng' | 'kor+eng';
}

const DEFAULT_SETTINGS: SettingsState = {
  aiEngine: 'qwen3',
  ollamaEndpoint: 'http://localhost:11434',
  ocrLanguage: 'kor+eng',
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>(() => {
    const saved = localStorage.getItem('ai-analyzer-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { data: stats, refetch: refetchStats } = useStats();
  const { showToast } = useToast();

  const handleSettingChange = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('ai-analyzer-settings', JSON.stringify(newSettings));
    showToast('설정이 저장되었습니다.', 'success');
  };

  const handleResetAllData = async () => {
    setIsResetting(true);
    try {
      const client = getExtensionClient();
      await client.send('RESET_ALL_DATA');
      await refetchStats();
      showToast('모든 데이터가 삭제되었습니다.', 'success');
      setShowResetModal(false);
    } catch (err) {
      showToast('데이터 삭제 실패', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <PageHeader title="설정" />

      <div className="editorial-grid">
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* AI 엔진 설정 */}
          <SettingsSection title="AI 엔진">
            <div className="space-y-4">
              <div>
                <label className="label block mb-2">AI 엔진 선택</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="aiEngine"
                      value="qwen3"
                      checked={settings.aiEngine === 'qwen3'}
                      onChange={e => handleSettingChange('aiEngine', 'qwen3')}
                      className="w-4 h-4"
                    />
                    <span>Qwen3 (WebGPU)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="aiEngine"
                      value="ollama"
                      checked={settings.aiEngine === 'ollama'}
                      onChange={e => handleSettingChange('aiEngine', 'ollama')}
                      className="w-4 h-4"
                    />
                    <span>Ollama (로컬 서버)</span>
                  </label>
                </div>
                <p className="text-ink-muted text-sm mt-2">
                  Qwen3는 브라우저에서 직접 실행됩니다. Ollama는 로컬 서버가 필요합니다.
                </p>
              </div>

              {settings.aiEngine === 'ollama' && (
                <div>
                  <label className="label block mb-2">Ollama Endpoint</label>
                  <input
                    type="url"
                    value={settings.ollamaEndpoint}
                    onChange={e => handleSettingChange('ollamaEndpoint', e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full px-4 py-2 border-2 border-ink bg-paper text-ink focus:outline-none"
                  />
                </div>
              )}
            </div>
          </SettingsSection>

          {/* OCR 설정 */}
          <SettingsSection title="OCR 설정">
            <div>
              <label className="label block mb-2">인식 언어</label>
              <select
                value={settings.ocrLanguage}
                onChange={e => handleSettingChange('ocrLanguage', e.target.value as SettingsState['ocrLanguage'])}
                className="px-4 py-2 border-2 border-ink bg-paper text-ink focus:outline-none"
              >
                <option value="kor">한국어</option>
                <option value="eng">영어</option>
                <option value="kor+eng">한국어 + 영어</option>
              </select>
              <p className="text-ink-muted text-sm mt-2">
                이미지에서 텍스트를 추출할 때 사용할 언어입니다.
              </p>
            </div>
          </SettingsSection>

          {/* 데이터 관리 */}
          <SettingsSection title="데이터 관리">
            <div className="space-y-4">
              {/* 저장소 사용량 */}
              {stats && (
                <div className="bg-surface-sunken p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <span className="label block mb-1">회사</span>
                      <span className="data-figure text-xl">{stats.totalCompanies}</span>
                    </div>
                    <div>
                      <span className="label block mb-1">이미지</span>
                      <span className="data-figure text-xl">{stats.totalImages}</span>
                    </div>
                    <div>
                      <span className="label block mb-1">용량</span>
                      <span className="data-figure text-xl">
                        {formatBytes(stats.storageUsed)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 초기화 버튼 */}
              <div className="pt-4 border-t border-border-subtle">
                <Button
                  variant="danger"
                  onClick={() => setShowResetModal(true)}
                >
                  모든 데이터 삭제
                </Button>
                <p className="text-ink-muted text-sm mt-2">
                  모든 회사, 이미지, 분석 결과가 영구적으로 삭제됩니다.
                </p>
              </div>
            </div>
          </SettingsSection>
        </div>

        {/* 사이드바: 도움말 */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="p-6 sticky top-24">
            <h3 className="headline text-lg mb-4">도움말</h3>
            <div className="space-y-4 text-sm text-ink-muted">
              <div>
                <h4 className="font-semibold text-ink mb-1">Qwen3 WebGPU</h4>
                <p>브라우저에서 직접 AI 모델을 실행합니다. GPU가 있으면 빠르게 처리됩니다.</p>
              </div>
              <div>
                <h4 className="font-semibold text-ink mb-1">Ollama</h4>
                <p>로컬에서 Ollama 서버를 실행해야 합니다. 더 큰 모델을 사용할 수 있습니다.</p>
              </div>
              <div>
                <h4 className="font-semibold text-ink mb-1">OCR</h4>
                <p>Tesseract.js를 사용하여 이미지에서 텍스트를 추출합니다.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 초기화 확인 모달 */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="데이터 초기화"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowResetModal(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={handleResetAllData}
              loading={isResetting}
            >
              모두 삭제
            </Button>
          </>
        }
      >
        <p className="text-ink">
          정말로 모든 데이터를 삭제하시겠습니까?
        </p>
        <p className="text-signal-negative font-semibold mt-2">
          이 작업은 되돌릴 수 없습니다!
        </p>
        <ul className="mt-4 text-sm text-ink-muted space-y-1">
          <li>• 모든 회사 정보</li>
          <li>• 모든 캡처된 이미지</li>
          <li>• 모든 AI 분석 결과</li>
        </ul>
      </Modal>
    </>
  );
}

// 섹션 컴포넌트
interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <Card className="p-6">
      <h2 className="headline text-xl mb-6">{title}</h2>
      {children}
    </Card>
  );
}

// 바이트 포맷
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
```

### spa/src/lib/settings.ts

```typescript
export interface AppSettings {
  aiEngine: 'qwen3' | 'ollama';
  ollamaEndpoint: string;
  ocrLanguage: 'kor' | 'eng' | 'kor+eng';
}

const STORAGE_KEY = 'ai-analyzer-settings';

const DEFAULT_SETTINGS: AppSettings = {
  aiEngine: 'qwen3',
  ollamaEndpoint: 'http://localhost:11434',
  ocrLanguage: 'kor+eng',
};

export function getSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
```

## 완료 기준

- [ ] Settings 페이지 레이아웃
- [ ] AI 엔진 선택: Qwen3 / Ollama
- [ ] Ollama endpoint 설정 (조건부 표시)
- [ ] OCR 언어 설정
- [ ] 저장소 사용량 표시
- [ ] 데이터 초기화: 확인 모달 후 삭제
- [ ] LocalStorage에 설정 저장
- [ ] 도움말 사이드바

## 참조 문서

- spec/06-page-layouts.md Section 5 (설정 페이지)
