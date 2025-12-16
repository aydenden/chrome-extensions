import type { SiteConfig, AISettings, DataType } from '@/types/storage';

// 설정 저장
export async function saveSettings<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// 설정 조회
export async function getSettings<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key];
}

// 설정 삭제
export async function removeSettings(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

// 모든 설정 조회
export async function getAllSettings(): Promise<Record<string, unknown>> {
  return chrome.storage.local.get();
}

// 사이트 설정 조회
export async function getSiteConfigs(): Promise<SiteConfig[]> {
  const configs = await getSettings<SiteConfig[]>('siteConfigs');
  return configs || getDefaultSiteConfigs();
}

// 사이트 설정 저장
export async function saveSiteConfigs(configs: SiteConfig[]): Promise<void> {
  await saveSettings('siteConfigs', configs);
}

// AI 설정 조회
export async function getAISettings(): Promise<AISettings> {
  const settings = await getSettings<AISettings>('aiSettings');
  return settings || getDefaultAISettings();
}

// AI 설정 저장
export async function saveAISettings(settings: AISettings): Promise<void> {
  await saveSettings('aiSettings', settings);
}

// 기본 사이트 설정
function getDefaultSiteConfigs(): SiteConfig[] {
  return [
    {
      id: 'wanted',
      name: '원티드',
      urlPattern: 'https://www.wanted.co.kr/company/*',
      dataTypes: ['company_info'] as DataType[],
      extractionGuide: '회사 정보 페이지에서 기업 정보를 추출하세요',
    },
    {
      id: 'innoforest',
      name: '혁신의숲',
      urlPattern: 'https://www.innoforest.co.kr/*',
      dataTypes: ['finance_inno'] as DataType[],
      extractionGuide: '기업 정보 페이지에서 재무/고용 데이터를 추출하세요',
    },
    {
      id: 'dart',
      name: 'DART',
      urlPattern: 'https://dart.fss.or.kr/*',
      dataTypes: ['finance_dart'] as DataType[],
      extractionGuide: 'PDF 재무제표를 업로드하세요',
    },
    {
      id: 'smes',
      name: '중기벤처확인',
      urlPattern: 'https://sminfo.mss.go.kr/*',
      dataTypes: ['finance_smes'] as DataType[],
      extractionGuide: '대차대조표/손익계산서를 추출하세요',
    },
    {
      id: 'blind',
      name: '블라인드',
      urlPattern: 'https://www.teamblind.com/*',
      dataTypes: ['review_blind'] as DataType[],
      extractionGuide: '회사 리뷰를 추출하세요',
    },
    {
      id: 'jobplanet',
      name: '잡플래닛',
      urlPattern: 'https://www.jobplanet.co.kr/*',
      dataTypes: ['review_jobplanet'] as DataType[],
      extractionGuide: '회사 리뷰를 추출하세요',
    },
  ];
}

// 기본 AI 설정
function getDefaultAISettings(): AISettings {
  return {
    weights: {
      financial: 60,
      review: 40,
    },
    prompts: {
      companyExtraction: `다음 페이지 제목에서 회사명을 추출하세요. 회사명만 출력하고 다른 텍스트는 포함하지 마세요.`,
      financialAnalysis: `다음 재무 데이터를 분석하여 JSON 형식으로 응답하세요:
{
  "runway_months": number,
  "runway_confidence": "high" | "medium" | "low",
  "runway_reasoning": string,
  "risk_level": "high" | "medium" | "low",
  "risk_factors": string[]
}`,
      reviewAnalysis: `다음 리뷰들을 분석하여 JSON 형식으로 응답하세요:
{
  "positive_themes": string[],
  "negative_themes": string[],
  "summary": string
}`,
      totalScore: `다음 분석 결과를 바탕으로 1-5점 사이의 종합 점수를 매기세요. 숫자만 출력하세요.`,
    },
  };
}

// URL이 지원되는 사이트인지 확인
export async function isSupportedUrl(url: string): Promise<boolean> {
  const configs = await getSiteConfigs();
  return configs.some(config => {
    const pattern = config.urlPattern.replace('*', '.*');
    return new RegExp(pattern).test(url);
  });
}

// URL에 해당하는 사이트 설정 조회
export async function getSiteConfigByUrl(url: string): Promise<SiteConfig | undefined> {
  const configs = await getSiteConfigs();
  return configs.find(config => {
    const pattern = config.urlPattern.replace('*', '.*');
    return new RegExp(pattern).test(url);
  });
}
