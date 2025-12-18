import { detectSite, type SiteConfig } from '@/lib/sites';
import type { DataType } from '@shared/constants/categories';

export interface ScrapedData {
  companyName: string | null;
  industry?: string;
  employeeCount?: string;
  foundedYear?: string;
  url: string;
  siteType: DataType;
}

function extractText(selector: string): string | null {
  const element = document.querySelector(selector);
  return element?.textContent?.trim() || null;
}

function extractTextMulti(selectorStr: string): string | null {
  const selectors = selectorStr.split(',').map(s => s.trim());
  for (const selector of selectors) {
    const text = extractText(selector);
    if (text) return text;
  }
  return null;
}

function extractCompanyName(site: SiteConfig): string | null {
  if (site.selectors.companyName) {
    const name = extractTextMulti(site.selectors.companyName);
    if (name) return name;
  }
  const generalSelectors = ['h1', '[class*="company"][class*="name"]', 'meta[property="og:site_name"]'];
  for (const selector of generalSelectors) {
    if (selector.startsWith('meta')) {
      const meta = document.querySelector(selector) as HTMLMetaElement;
      if (meta?.content) return meta.content;
    } else {
      const text = extractText(selector);
      if (text) return text;
    }
  }
  const title = document.title;
  const match = title.match(/^(.+?)\s*[-|·]\s*/);
  if (match) return match[1];
  return null;
}

export function scrapeCurrentPage(): ScrapedData | null {
  const url = window.location.href;
  const site = detectSite(url);
  if (!site) return null;

  const data: ScrapedData = {
    companyName: extractCompanyName(site),
    url,
    siteType: site.type,
  };

  if (site.selectors.industry) data.industry = extractTextMulti(site.selectors.industry) || undefined;
  if (site.selectors.employeeCount) data.employeeCount = extractTextMulti(site.selectors.employeeCount) || undefined;
  if (site.selectors.foundedYear) data.foundedYear = extractTextMulti(site.selectors.foundedYear) || undefined;

  return data;
}

export function observePageChanges(callback: (data: ScrapedData) => void): void {
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      const data = scrapeCurrentPage();
      if (data) callback(data);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const data = scrapeCurrentPage();
  if (data) callback(data);
}
