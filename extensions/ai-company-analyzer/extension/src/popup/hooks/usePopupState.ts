import { useEffect, useState, useCallback } from 'react';
import { detectSite } from '@/lib/sites';
import {
  getCaptureSettings,
  setCaptureSettings,
  getContinuousCaptureSession,
  startContinuousCaptureSession,
  endContinuousCaptureSession,
  type ContinuousCaptureSession,
} from '@/lib/capture-settings';

interface Company {
  id: string;
  name: string;
}

interface Stats {
  totalCompanies: number;
  totalImages: number;
  analyzedImages: number;
  storageUsed: number;
}

interface ScrapedData {
  companyName: string | null;
  url: string;
  siteType: string;
}

export type InputMode = 'detected' | 'manual' | 'saved';

interface PopupState {
  isLoading: boolean;
  isSupported: boolean;
  siteName: string;
  detectedCompany: string | null;
  savedCompanies: Company[];
  stats: Stats | null;
  companyInput: string;
  inputMode: InputMode;
  isCapturing: boolean;
  error: string;
  // 캡처 옵션
  quickCapture: boolean;
  continuousCapture: boolean;
  selectedCompanyId: string | undefined;
  captureCount: number;
}

export function usePopupState() {
  const [state, setState] = useState<PopupState>({
    isLoading: true,
    isSupported: false,
    siteName: '',
    detectedCompany: null,
    savedCompanies: [],
    stats: null,
    companyInput: '',
    inputMode: 'manual',
    isCapturing: false,
    error: '',
    // 캡처 옵션 초기값
    quickCapture: false,
    continuousCapture: false,
    selectedCompanyId: undefined,
    captureCount: 0,
  });

  useEffect(() => {
    initializePopup();
  }, []);

  const initializePopup = async () => {
    setState(s => ({ ...s, isLoading: true }));

    // 캡처 설정 로드
    const captureSettings = await getCaptureSettings();
    setState(s => ({
      ...s,
      quickCapture: captureSettings.quickCaptureEnabled,
      continuousCapture: captureSettings.continuousCaptureEnabled,
    }));

    // 연속 캡처 세션 복구
    const session = await getContinuousCaptureSession();
    if (session) {
      setState(s => ({
        ...s,
        continuousCapture: true,
        companyInput: session.companyName,
        selectedCompanyId: session.companyId,
        captureCount: session.captureCount,
        inputMode: 'saved',
      }));
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab?.id) {
      setState(s => ({ ...s, isLoading: false }));
      return;
    }

    const site = detectSite(tab.url);

    if (site) {
      setState(s => ({ ...s, isSupported: true, siteName: site.name }));

      // Get scraped data from content script
      try {
        const scrapedData = (await chrome.tabs.sendMessage(tab.id, {
          type: 'GET_PAGE_DATA',
        })) as ScrapedData | null;

        if (scrapedData?.companyName) {
          setState(s => ({
            ...s,
            detectedCompany: scrapedData.companyName,
            companyInput: scrapedData.companyName!,
            inputMode: 'detected',
          }));
        }
      } catch (e) {
        console.log('Could not get page data:', e);
      }
    } else {
      setState(s => ({
        ...s,
        isSupported: false,
        siteName: '지원하지 않는 사이트',
      }));
    }

    // Get saved companies
    chrome.runtime.sendMessage({ type: 'GET_COMPANIES_INTERNAL' }, response => {
      if (response?.success && response.companies) {
        const companies = response.companies.slice(0, 10);
        setState(s => {
          // 감지된 회사명과 저장된 회사 매칭
          const matchedCompany = s.detectedCompany
            ? companies.find((c: Company) => c.name === s.detectedCompany)
            : undefined;

          return {
            ...s,
            savedCompanies: companies,
            // 매칭된 회사가 있으면 ID 설정 및 inputMode를 'saved'로 변경
            selectedCompanyId: matchedCompany?.id ?? s.selectedCompanyId,
            inputMode: matchedCompany ? 'saved' : s.inputMode,
          };
        });
      }
    });

    // Get stats
    chrome.runtime.sendMessage({ type: 'GET_STATS_INTERNAL' }, response => {
      if (response?.success && response.stats) {
        setState(s => ({ ...s, stats: response.stats }));
      }
    });

    setState(s => ({ ...s, isLoading: false }));
  };

  const setCompanyInput = useCallback(
    (value: string, companyId?: string) => {
      let newMode: InputMode = 'manual';
      let selectedId: string | undefined = companyId;

      if (state.detectedCompany && value === state.detectedCompany) {
        newMode = 'detected';
      } else if (state.savedCompanies.some(c => c.name === value)) {
        newMode = 'saved';
        // 저장된 회사에서 ID 찾기
        if (!selectedId) {
          const found = state.savedCompanies.find(c => c.name === value);
          selectedId = found?.id;
        }
      }

      setState(s => ({
        ...s,
        companyInput: value,
        inputMode: newMode,
        selectedCompanyId: selectedId,
      }));
    },
    [state.detectedCompany, state.savedCompanies]
  );

  const setError = useCallback((error: string) => {
    setState(s => ({ ...s, error }));
  }, []);

  // 캡처 옵션 setter
  const setQuickCapture = useCallback(async (enabled: boolean) => {
    setState(s => ({ ...s, quickCapture: enabled }));
    await setCaptureSettings({ quickCaptureEnabled: enabled });
  }, []);

  const setContinuousCapture = useCallback(async (enabled: boolean) => {
    setState(s => ({ ...s, continuousCapture: enabled }));
    await setCaptureSettings({ continuousCaptureEnabled: enabled });
  }, []);

  const resetCaptureCount = useCallback(async () => {
    await endContinuousCaptureSession();
    setState(s => ({ ...s, captureCount: 0 }));
  }, []);

  // CAPTURE_COMPLETE 메시지 리스너 (연속 캡처용)
  useEffect(() => {
    const listener = (message: { type: string; captureCount?: number }) => {
      if (message.type === 'CAPTURE_COMPLETE') {
        setState(s => ({
          ...s,
          captureCount: message.captureCount ?? s.captureCount + 1,
          isCapturing: false,
        }));
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleCapture = useCallback(async () => {
    if (!state.isSupported) return;

    const finalCompanyName = state.companyInput.trim();
    if (!finalCompanyName) {
      setState(s => ({ ...s, error: '회사명을 입력해주세요.' }));
      return false;
    }

    // 빠른 캡처는 기존 회사(selectedCompanyId)가 있을 때만 가능
    const canQuickCapture = state.quickCapture && !!state.selectedCompanyId;

    setState(s => ({ ...s, isCapturing: true, error: '' }));

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('활성 탭을 찾을 수 없습니다.');

      // 연속 캡처 모드이고 세션이 없으면 새 세션 시작
      if (state.continuousCapture && state.selectedCompanyId) {
        const existingSession = await getContinuousCaptureSession();
        if (!existingSession) {
          await startContinuousCaptureSession(finalCompanyName, state.selectedCompanyId);
        }
      }

      await chrome.tabs.sendMessage(tab.id, {
        type: 'TRIGGER_CAPTURE',
        payload: {
          companyName: finalCompanyName,
          companyId: state.selectedCompanyId,
          quickCapture: canQuickCapture,
          continuousCapture: state.continuousCapture,
        },
      });

      return true;
    } catch (err) {
      setState(s => ({
        ...s,
        error: err instanceof Error ? err.message : '캡처에 실패했습니다.',
      }));
      return false;
    } finally {
      setState(s => ({ ...s, isCapturing: false }));
    }
  }, [
    state.isSupported,
    state.companyInput,
    state.quickCapture,
    state.continuousCapture,
    state.selectedCompanyId,
  ]);

  const openDashboard = useCallback(() => {
    chrome.tabs.create({
      url: 'https://nyh-workshop.github.io/ai-company-analyzer/',
    });
  }, []);

  return {
    ...state,
    setCompanyInput,
    setError,
    handleCapture,
    openDashboard,
    // 캡처 옵션 관련
    setQuickCapture,
    setContinuousCapture,
    resetCaptureCount,
  };
}
