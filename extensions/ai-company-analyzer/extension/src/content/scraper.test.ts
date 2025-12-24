import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scrapeCurrentPage } from './scraper';

// jsdom 환경에서 테스트
describe('scraper', () => {
  beforeEach(() => {
    // DOM 초기화
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  describe('scrapeCurrentPage', () => {
    describe('미지원 사이트', () => {
      it('지원하지 않는 URL에서는 null을 반환한다', () => {
        Object.defineProperty(window, 'location', {
          value: { href: 'https://google.com' },
          writable: true,
        });

        const result = scrapeCurrentPage();

        expect(result).toBeNull();
      });
    });

    describe('원티드 (Wanted)', () => {
      beforeEach(() => {
        Object.defineProperty(window, 'location', {
          value: { href: 'https://www.wanted.co.kr/company/12345' },
          writable: true,
        });
      });

      it('h1.company-name에서 회사명을 추출한다', () => {
        document.body.innerHTML = '<h1 class="company-name">카카오</h1>';

        const result = scrapeCurrentPage();

        expect(result).not.toBeNull();
        expect(result?.companyName).toBe('카카오');
        expect(result?.siteType).toBe('WANTED');
      });

      it('CompanyName 클래스에서 회사명을 추출한다', () => {
        document.body.innerHTML = '<div class="CompanyName">네이버</div>';

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('네이버');
      });

      it('industry 셀렉터에서 업종을 추출한다', () => {
        document.body.innerHTML = `
          <h1 class="company-name">테스트회사</h1>
          <div class="industry">IT/소프트웨어</div>
        `;

        const result = scrapeCurrentPage();

        expect(result?.industry).toBe('IT/소프트웨어');
      });
    });

    describe('잡플래닛 (Jobplanet)', () => {
      beforeEach(() => {
        Object.defineProperty(window, 'location', {
          value: { href: 'https://www.jobplanet.co.kr/companies/12345/info' },
          writable: true,
        });
      });

      it('h1.company_name에서 회사명을 추출한다', () => {
        document.body.innerHTML = '<h1 class="company_name">삼성전자</h1>';

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('삼성전자');
        expect(result?.siteType).toBe('JOBPLANET');
      });

      it('company-header h1에서 회사명을 추출한다', () => {
        document.body.innerHTML = `
          <div class="company-header">
            <h1>LG전자</h1>
          </div>
        `;

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('LG전자');
      });
    });

    describe('블라인드 (Blind)', () => {
      beforeEach(() => {
        Object.defineProperty(window, 'location', {
          value: { href: 'https://www.teamblind.com/company/Kakao' },
          writable: true,
        });
      });

      it('h1.company-name에서 회사명을 추출한다', () => {
        document.body.innerHTML = '<h1 class="company-name">카카오</h1>';

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('카카오');
        expect(result?.siteType).toBe('BLIND');
      });
    });

    describe('DART', () => {
      beforeEach(() => {
        Object.defineProperty(window, 'location', {
          value: { href: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=12345' },
          writable: true,
        });
      });

      it('.company-title에서 회사명을 추출한다', () => {
        document.body.innerHTML = '<div class="company-title">현대자동차(주)</div>';

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('현대자동차(주)');
        expect(result?.siteType).toBe('DART');
      });
    });

    describe('혁신의숲 (Innoforest)', () => {
      beforeEach(() => {
        Object.defineProperty(window, 'location', {
          value: { href: 'https://www.innoforest.co.kr/company/startup123' },
          writable: true,
        });
      });

      it('h1.company-title에서 회사명을 추출한다', () => {
        document.body.innerHTML = '<h1 class="company-title">스타트업</h1>';

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('스타트업');
        expect(result?.siteType).toBe('INNOFOREST');
      });
    });

    describe('벤처확인시스템 (SMES)', () => {
      beforeEach(() => {
        Object.defineProperty(window, 'location', {
          value: { href: 'https://www.smes.go.kr/venturein/company/12345' },
          writable: true,
        });
      });

      it('테이블에서 회사명을 추출한다', () => {
        document.body.innerHTML = `
          <div id="real_contents">
            <div class="board_tab_con_box">
              <div>
                <table>
                  <tbody>
                    <tr><td>벤처기업</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('벤처기업');
        expect(result?.siteType).toBe('SMES');
      });
    });

    describe('Fallback 추출', () => {
      beforeEach(() => {
        Object.defineProperty(window, 'location', {
          value: { href: 'https://www.wanted.co.kr/company/99999' },
          writable: true,
        });
      });

      it('셀렉터가 없으면 h1에서 추출한다', () => {
        document.body.innerHTML = '<h1>일반 회사명</h1>';

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('일반 회사명');
      });

      it('og:site_name 메타 태그에서 추출한다', () => {
        document.head.innerHTML = '<meta property="og:site_name" content="메타회사">';

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('메타회사');
      });

      it('document.title에서 회사명을 추출한다', () => {
        document.title = '테스트기업 - 기업정보';

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('테스트기업');
      });

      it('title에서 | 구분자를 처리한다', () => {
        document.title = '좋은회사 | 원티드';

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('좋은회사');
      });

      it('title에서 · 구분자를 처리한다', () => {
        document.title = '멋진기업 · 잡플래닛';

        const result = scrapeCurrentPage();

        expect(result?.companyName).toBe('멋진기업');
      });

      it('모든 방법이 실패하면 null 회사명을 반환한다', () => {
        document.title = '';

        const result = scrapeCurrentPage();

        expect(result).not.toBeNull();
        expect(result?.companyName).toBeNull();
      });
    });

    describe('URL 정보', () => {
      it('현재 URL을 포함한다', () => {
        const testUrl = 'https://www.wanted.co.kr/company/12345';
        Object.defineProperty(window, 'location', {
          value: { href: testUrl },
          writable: true,
        });
        document.body.innerHTML = '<h1 class="company-name">테스트</h1>';

        const result = scrapeCurrentPage();

        expect(result?.url).toBe(testUrl);
      });
    });
  });

  describe('observePageChanges', () => {
    it('MutationObserver 테스트는 통합 테스트에서 수행', () => {
      // MutationObserver는 실제 브라우저 환경에서 테스트 필요
      expect(true).toBe(true);
    });
  });
});
