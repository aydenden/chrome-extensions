interface SiteInfo {
  name: string;
  url: string;
}

interface SiteCategory {
  emoji: string;
  label: string;
  sites: SiteInfo[];
}

const SITE_CATEGORIES: SiteCategory[] = [
  {
    emoji: '📋',
    label: '회사 정보',
    sites: [{ name: '원티드', url: 'https://www.wanted.co.kr' }],
  },
  {
    emoji: '💬',
    label: '리뷰',
    sites: [
      { name: '잡플래닛', url: 'https://www.jobplanet.co.kr' },
      { name: '블라인드', url: 'https://www.teamblind.com' },
    ],
  },
  {
    emoji: '📊',
    label: '재무/공시',
    sites: [
      { name: '혁신의숲', url: 'https://www.innoforest.co.kr' },
      { name: '벤처확인시스템', url: 'https://www.smes.go.kr/venturein' },
      { name: 'DART', url: 'https://dart.fss.or.kr' },
    ],
  },
];

export function SupportedSitesList() {
  return (
    <div className="supported-sites">
      {SITE_CATEGORIES.map((category, idx) => (
        <div key={idx} className="site-category">
          <span className="category-label">
            {category.emoji} {category.label}
          </span>
          <span className="category-sites">
            {category.sites.map((site, i) => (
              <span key={site.name}>
                <a href={site.url} target="_blank" rel="noopener noreferrer">
                  {site.name}
                </a>
                {i < category.sites.length - 1 && ', '}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
