import { useEffect, useState, useCallback } from 'react';
import { detectSite } from '@/lib/sites';

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
  });

  useEffect(() => {
    initializePopup();
  }, []);

  const initializePopup = async () => {
    setState(s => ({ ...s, isLoading: true }));

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
        setState(s => ({ ...s, savedCompanies: response.companies.slice(0, 10) }));
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
    (value: string) => {
      let newMode: InputMode = 'manual';

      if (state.detectedCompany && value === state.detectedCompany) {
        newMode = 'detected';
      } else if (state.savedCompanies.some(c => c.name === value)) {
        newMode = 'saved';
      }

      setState(s => ({ ...s, companyInput: value, inputMode: newMode }));
    },
    [state.detectedCompany, state.savedCompanies]
  );

  const setError = useCallback((error: string) => {
    setState(s => ({ ...s, error }));
  }, []);

  const handleCapture = useCallback(async () => {
    if (!state.isSupported) return;

    const finalCompanyName = state.companyInput.trim();
    if (!finalCompanyName) {
      setState(s => ({ ...s, error: '회사명을 입력해주세요.' }));
      return false;
    }

    setState(s => ({ ...s, isCapturing: true, error: '' }));

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('활성 탭을 찾을 수 없습니다.');

      await chrome.tabs.sendMessage(tab.id, {
        type: 'TRIGGER_CAPTURE',
        payload: { companyName: finalCompanyName },
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
  }, [state.isSupported, state.companyInput]);

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
  };
}
