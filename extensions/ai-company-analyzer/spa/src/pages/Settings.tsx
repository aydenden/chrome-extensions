import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout';
import { Button, Card, Modal, Spinner } from '@/components/ui';
import { PromptSettingsCard } from '@/components/settings';
import { useStats } from '@/hooks/useStats';
import { useOllama } from '@/contexts/OllamaContext';
import { getExtensionClient } from '@/lib/extension-client';
import { cn } from '@/lib/utils';

export default function Settings() {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { data: stats, refetch: refetchStats } = useStats();

  const {
    endpoint,
    setEndpoint,
    isConnected,
    isChecking,
    error,
    models,
    selectedModel,
    selectModel,
    isLoadingModels,
    checkConnection,
    fetchModels,
  } = useOllama();

  const [localEndpoint, setLocalEndpoint] = useState(endpoint);
  const [endpointError, setEndpointError] = useState<string | null>(null);

  // localhost 유효성 검사
  const validateEndpoint = useCallback((value: string): boolean => {
    try {
      const url = new URL(value);
      const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      if (!isLocalhost) {
        setEndpointError('localhost 또는 127.0.0.1만 지원합니다');
        return false;
      }
      setEndpointError(null);
      return true;
    } catch {
      setEndpointError('올바른 URL 형식이 아닙니다');
      return false;
    }
  }, []);

  // Extension과 설정 동기화
  const syncSettingsToExtension = useCallback(async (newEndpoint: string, newModel: string) => {
    try {
      const client = getExtensionClient();
      await client.send('SET_OLLAMA_SETTINGS', {
        endpoint: newEndpoint,
        model: newModel,
      });
    } catch (error) {
      console.error('Failed to sync settings to Extension:', error);
    }
  }, []);

  // 엔드포인트 저장
  const handleEndpointSave = () => {
    if (!validateEndpoint(localEndpoint)) return;
    setEndpoint(localEndpoint);
    checkConnection();
    // Extension에 저장 (현재 모델도 함께)
    if (selectedModel) {
      syncSettingsToExtension(localEndpoint, selectedModel);
    }
  };

  // 모델 선택 핸들러 (Extension 동기화 포함)
  const handleModelSelect = (modelName: string) => {
    selectModel(modelName);
    // Extension에 저장
    syncSettingsToExtension(endpoint, modelName);
  };

  // 초기 로드 시 Extension에서 설정 가져오기
  useEffect(() => {
    const loadSettingsFromExtension = async () => {
      try {
        const client = getExtensionClient();
        const settings = await client.send('GET_OLLAMA_SETTINGS');
        if (settings) {
          // Extension에 저장된 설정이 있으면 로드
          if (settings.endpoint && settings.endpoint !== endpoint) {
            setLocalEndpoint(settings.endpoint);
            setEndpoint(settings.endpoint);
          }
          if (settings.model && settings.model !== selectedModel) {
            selectModel(settings.model);
          }
        }
      } catch (error) {
        console.error('Failed to load settings from Extension:', error);
      }
    };
    loadSettingsFromExtension();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      // TODO: DELETE_ALL_DATA 메시지 타입 구현 필요
      // const client = getExtensionClient();
      // await client.send('DELETE_ALL_DATA');
      await refetchStats();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to delete data:', error);
      alert('데이터 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <>
      <PageHeader title="설정" subtitle="앱 설정을 관리합니다" />
      <div className="editorial-grid gap-6">
        {/* 메인 콘텐츠 영역 (8칼럼) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Ollama 연결 */}
          <Card className="p-6">
            <h2 className="headline text-xl mb-4">Ollama 연결</h2>
            <div className="space-y-4">
              {/* 엔드포인트 입력 */}
              <div>
                <label className="text-sm text-ink-muted">엔드포인트</label>
                <input
                  type="text"
                  value={localEndpoint}
                  onChange={(e) => setLocalEndpoint(e.target.value)}
                  onBlur={handleEndpointSave}
                  className={cn(
                    'w-full mt-1 px-3 py-2 border bg-surface-elevated',
                    'focus:outline-none focus:ring-2 focus:ring-ink',
                    (error || endpointError) ? 'border-signal-negative' : 'border-border-subtle'
                  )}
                  placeholder="http://localhost:11434"
                />
              </div>

              {/* 상태 표시 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-muted">상태:</span>
                  {isChecking ? (
                    <>
                      <Spinner size="sm" />
                      <span className="text-sm">확인 중...</span>
                    </>
                  ) : isConnected ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-signal-positive" />
                      <span className="text-sm text-signal-positive">연결됨</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-signal-negative" />
                      <span className="text-sm text-signal-negative">연결 안됨</span>
                    </>
                  )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={checkConnection}
                  disabled={isChecking}
                >
                  연결 테스트
                </Button>
              </div>

              {/* 에러 메시지 */}
              {(error || endpointError) && !isChecking && (
                <p className="text-sm text-signal-negative">{endpointError || error}</p>
              )}
            </div>
          </Card>

          {/* 모델 선택 */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="headline text-xl">모델 선택</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchModels}
                disabled={isLoadingModels || !isConnected}
              >
                {isLoadingModels ? <Spinner size="sm" /> : '새로고침'}
              </Button>
            </div>

            {!isConnected ? (
              <p className="text-center text-ink-muted py-8">
                Ollama에 연결하면 모델 목록이 표시됩니다
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-muted mb-4">
                  Vision 모델만 표시됩니다 (이미지 분석 지원)
                </p>

                {models.length === 0 ? (
                  <div className="text-center py-8 bg-surface-sunken">
                    <p className="text-ink-muted mb-2">Vision 모델이 설치되지 않았습니다</p>
                    <code className="text-sm bg-surface-elevated px-2 py-1">
                      ollama pull gemma3
                    </code>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {models.map((model) => (
                      <label
                        key={model.name}
                        className={cn(
                          'flex items-center p-3 border cursor-pointer transition-colors',
                          selectedModel === model.name
                            ? 'border-ink bg-surface-elevated'
                            : 'border-border-subtle hover:bg-surface-sunken'
                        )}
                      >
                        <input
                          type="radio"
                          name="model"
                          checked={selectedModel === model.name}
                          onChange={() => handleModelSelect(model.name)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <span className="font-semibold">{model.name}</span>
                          <p className="text-sm text-ink-muted">
                            {model.size && `${(model.size / (1024 ** 3)).toFixed(1)}GB`}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* AI 프롬프트 설정 */}
          <PromptSettingsCard />

          {/* 데이터 관리 */}
          <Card className="p-6">
            <h2 className="headline text-xl mb-4">데이터 관리</h2>
            <div className="space-y-4">
              {stats && (
                <div className="bg-surface-sunken p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">저장된 회사</span>
                    <span className="font-semibold">{stats.totalCompanies}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">저장된 이미지</span>
                    <span className="font-semibold">{stats.totalImages}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">사용 중인 용량</span>
                    <span className="font-semibold">{formatBytes(stats.storageUsed)}</span>
                  </div>
                </div>
              )}
              <Button
                variant="danger"
                onClick={() => setIsDeleteModalOpen(true)}
                className="w-full"
              >
                모든 데이터 삭제
              </Button>
              <p className="text-sm text-ink-muted">
                삭제된 데이터는 복구할 수 없습니다. 신중하게 선택하세요.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="모든 데이터 삭제"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              취소
            </Button>
            <Button variant="danger" onClick={handleDeleteAll} loading={isDeleting}>
              삭제
            </Button>
          </>
        }
      >
        <p className="text-ink-muted">
          저장된 모든 회사 정보와 이미지를 삭제합니다.
          <br />
          이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?
        </p>
      </Modal>
    </>
  );
}
