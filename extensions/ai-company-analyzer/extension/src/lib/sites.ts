import type { DataType } from '@shared/constants/categories';

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

export const SITES: SiteConfig[] = [
  {
    type: 'WANTED',
    name: '원티드',
    urlPattern: /(www\.)?wanted\.co\.kr\/company\/\d+/,
    selectors: {
      companyName: 'h1.company-name, [class*="CompanyName"]',
      industry: '[class*="industry"], [data-testid="industry"]',
      employeeCount: '[class*="employee"], [data-testid="employee-count"]',
    },
  },
  {
    type: 'JOBPLANET',
    name: '잡플래닛',
    urlPattern: /(www\.)?jobplanet\.co\.kr\/companies\/.+/,
    selectors: {
      companyName: 'h1.company_name, .company-header h1',
      industry: '.industry_text',
      employeeCount: '.employee_count',
      foundedYear: '.founded_year',
    },
  },
  {
    type: 'INNOFOREST',
    name: '혁신의숲',
    urlPattern: /(www\.)?innoforest\.co\.kr\/company\/.+/,
    selectors: {
      companyName: 'h1.company-title, .company-name',
      foundedYear: '.founded-info',
    },
  },
  {
    type: 'DART',
    name: 'DART',
    urlPattern: /dart\.fss\.or\.kr/,
    selectors: { companyName: '.company-title' },
  },
  {
    type: 'BLIND',
    name: '블라인드',
    urlPattern: /(www\.)?teamblind\.com\/company\/.+/,
    selectors: { companyName: 'h1.company-name' },
  },
  {
    type: 'SMES',
    name: '벤처확인시스템',
    urlPattern: /(www\.)?smes\.go\.kr\/venturein\/.+/,
    selectors: {
      companyName: '#real_contents .board_tab_con_box > div:first-child table tbody tr:first-child td',
    },
  },
];

export function detectSite(url: string): SiteConfig | null {
  for (const site of SITES) {
    if (site.urlPattern.test(url)) return site;
  }
  return null;
}

export function isSupportedSite(url: string): boolean {
  return detectSite(url) !== null;
}
