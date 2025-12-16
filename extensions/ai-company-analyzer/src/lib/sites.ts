// 지원 사이트 정의

export const SUPPORTED_SITES = {
  wanted: {
    name: '원티드',
    pattern: /^https:\/\/www\.wanted\.co\.kr\//,
    hostname: 'www.wanted.co.kr',
  },
  innoforest: {
    name: '혁신의숲',
    pattern: /^https:\/\/www\.innoforest\.co\.kr\//,
    hostname: 'www.innoforest.co.kr',
  },
  dart: {
    name: 'DART',
    pattern: /^https:\/\/dart\.fss\.or\.kr\//,
    hostname: 'dart.fss.or.kr',
  },
  smes: {
    name: '중기부확인',
    pattern: /^https:\/\/sminfo\.mss\.go\.kr\//,
    hostname: 'sminfo.mss.go.kr',
  },
  blind: {
    name: '블라인드',
    pattern: /^https:\/\/www\.teamblind\.com\//,
    hostname: 'www.teamblind.com',
  },
  jobplanet: {
    name: '잡플래닛',
    pattern: /^https:\/\/www\.jobplanet\.co\.kr\//,
    hostname: 'www.jobplanet.co.kr',
  },
} as const;

export type SiteKey = keyof typeof SUPPORTED_SITES;

export function detectCurrentSite(url: string): SiteKey | null {
  for (const [key, site] of Object.entries(SUPPORTED_SITES)) {
    if (site.pattern.test(url)) {
      return key as SiteKey;
    }
  }
  return null;
}

export function isSupportedSite(url: string): boolean {
  return detectCurrentSite(url) !== null;
}
