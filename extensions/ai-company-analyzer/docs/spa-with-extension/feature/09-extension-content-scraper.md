# Feature 09: Content Script DOM 스크래핑

## 개요

지원 사이트에서 회사 정보를 자동으로 추출하는 Content Script를 구현합니다.

## 범위

- 사이트별 회사 정보 추출 (sites.ts)
- 회사명 자동 감지
- 메타데이터 추출 (industry, employeeCount 등)

## 의존성

- Feature 04: Extension DB Setup

## 구현 상세

### extension/src/lib/sites.ts

```typescript
import type { DataType } from '@shared/constants/categories';

/** 사이트 정의 */
export interface SiteConfig {
  type: DataType;
  name: string;
  urlPattern: RegExp;
  selectors: {
    companyName?: string;
    industry?: string;
    employeeCount?: string;
    foundedYear?: string;
  };
}

/** 지원 사이트 목록 */
export const SITES: SiteConfig[] = [
  {
    type: 'WANTED',
    name: '원티드',
    urlPattern: /wanted\.co\.kr\/company\/\d+/,
    selectors: {
      companyName: 'h1.company-name, [class*="CompanyName"]',
      industry: '[class*="industry"], [data-testid="industry"]',
      employeeCount: '[class*="employee"], [data-testid="employee-count"]',
    },
  },
  {
    type: 'JOBPLANET',
    name: '잡플래닛',
    urlPattern: /jobplanet\.co\.kr\/companies\/.+/,
    selectors: {
      companyName: 'h1.company_name, .company-header h1',
      industry: '.industry_text, [class*="industry"]',
      employeeCount: '.employee_count, [class*="employee"]',
      foundedYear: '.founded_year, [class*="founded"]',
    },
  },
  {
    type: 'INNOFOREST',
    name: '혁신의숲',
    urlPattern: /innoforest\.co\.kr\/company\/.+/,
    selectors: {
      companyName: 'h1.company-title, .company-name',
      foundedYear: '.founded-info',
    },
  },
  {
    type: 'DART',
    name: 'DART',
    urlPattern: /dart\.fss\.or\.kr/,
    selectors: {
      companyName: '.company-title',
    },
  },
  {
    type: 'BLIND',
    name: '블라인드',
    urlPattern: /teamblind\.com\/company\/.+/,
    selectors: {
      companyName: 'h1.company-name',
    },
  },
];

/** URL로 사이트 감지 */
export function detectSite(url: string): SiteConfig | null {
  for (const site of SITES) {
    if (site.urlPattern.test(url)) {
      return site;
    }
  }
  return null;
}

/** 현재 페이지가 지원 사이트인지 확인 */
export function isSupportedSite(url: string): boolean {
  return detectSite(url) !== null;
}
```

### extension/src/content/scraper.ts

```typescript
import { detectSite, type SiteConfig } from '@/lib/sites';

export interface ScrapedData {
  companyName: string | null;
  industry?: string;
  employeeCount?: string;
  foundedYear?: string;
  url: string;
  siteType: string;
}

/** DOM에서 텍스트 추출 */
function extractText(selector: string): string | null {
  const element = document.querySelector(selector);
  return element?.textContent?.trim() || null;
}

/** 여러 셀렉터 시도 */
function extractTextMulti(selectorStr: string): string | null {
  const selectors = selectorStr.split(',').map(s => s.trim());
  for (const selector of selectors) {
    const text = extractText(selector);
    if (text) return text;
  }
  return null;
}

/** 회사명 추출 (폴백 전략) */
function extractCompanyName(site: SiteConfig): string | null {
  // 1. 사이트별 셀렉터 사용
  if (site.selectors.companyName) {
    const name = extractTextMulti(site.selectors.companyName);
    if (name) return name;
  }

  // 2. 일반적인 패턴 시도
  const generalSelectors = [
    'h1',
    '[class*="company"][class*="name"]',
    '[class*="Company"][class*="Name"]',
    'meta[property="og:site_name"]',
  ];

  for (const selector of generalSelectors) {
    if (selector.startsWith('meta')) {
      const meta = document.querySelector(selector) as HTMLMetaElement;
      if (meta?.content) return meta.content;
    } else {
      const text = extractText(selector);
      if (text) return text;
    }
  }

  // 3. 페이지 타이틀에서 추출
  const title = document.title;
  // "회사명 - 원티드" 같은 패턴
  const match = title.match(/^(.+?)\s*[-|·]\s*/);
  if (match) return match[1];

  return null;
}

/** 현재 페이지 데이터 스크래핑 */
export function scrapeCurrentPage(): ScrapedData | null {
  const url = window.location.href;
  const site = detectSite(url);

  if (!site) return null;

  const data: ScrapedData = {
    companyName: extractCompanyName(site),
    url,
    siteType: site.type,
  };

  // 추가 메타데이터 추출
  if (site.selectors.industry) {
    data.industry = extractTextMulti(site.selectors.industry) || undefined;
  }
  if (site.selectors.employeeCount) {
    data.employeeCount = extractTextMulti(site.selectors.employeeCount) || undefined;
  }
  if (site.selectors.foundedYear) {
    data.foundedYear = extractTextMulti(site.selectors.foundedYear) || undefined;
  }

  return data;
}

/** 페이지 변경 감지 및 자동 스크래핑 */
export function observePageChanges(callback: (data: ScrapedData) => void): void {
  // MutationObserver로 SPA 네비게이션 감지
  let lastUrl = window.location.href;

  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      const data = scrapeCurrentPage();
      if (data) callback(data);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 초기 실행
  const data = scrapeCurrentPage();
  if (data) callback(data);
}
```

### extension/src/content/index.ts

```typescript
import { scrapeCurrentPage, observePageChanges, type ScrapedData } from './scraper';
import { detectSite } from '@/lib/sites';

/** 스크래핑 데이터를 Service Worker로 전송 */
function sendScrapedData(data: ScrapedData): void {
  chrome.runtime.sendMessage({
    type: 'PAGE_SCRAPED',
    payload: data,
  });
}

/** Content Script 초기화 */
function init(): void {
  const site = detectSite(window.location.href);

  if (!site) {
    console.log('[AI Company Analyzer] Not a supported site');
    return;
  }

  console.log(`[AI Company Analyzer] Detected: ${site.name}`);

  // 페이지 변경 감지
  observePageChanges(sendScrapedData);

  // 메시지 리스너
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_PAGE_DATA') {
      const data = scrapeCurrentPage();
      sendResponse(data);
    }
    return true;
  });
}

// 초기화 실행
init();
```

## 완료 기준

- [ ] 원티드에서 회사명 자동 추출
- [ ] 잡플래닛에서 회사명, 업종, 직원수 추출
- [ ] 혁신의숲에서 회사명 추출
- [ ] 페이지 변경(SPA 네비게이션) 감지
- [ ] Service Worker로 스크래핑 데이터 전송

## 참조 문서

- spec/04-data-flow.md Section 2 (데이터 수집 상세)
