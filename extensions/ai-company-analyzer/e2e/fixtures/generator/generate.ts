/**
 * Mock Fixture 이미지 생성 스크립트
 *
 * HTML 템플릿 + 프리셋 데이터 → PNG 스크린샷
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  companyInfoPresets,
  employmentPresets,
  financePresets,
  reviewPresets,
} from './presets';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const OUTPUT_DIR = path.join(__dirname, '..', 'generated');

/**
 * 템플릿 파일 읽기
 */
function readTemplate(name: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.html`), 'utf-8');
}

/**
 * 플레이스홀더 치환
 */
function fillTemplate(template: string, data: Record<string, unknown>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(placeholder, String(value ?? ''));
  }
  return result;
}

/**
 * 기업정보 HTML 생성
 */
function generateCompanyInfoHtml(variant: string, data: typeof companyInfoPresets.small): string {
  const template = readTemplate('company-info');
  return fillTemplate(template, data);
}

/**
 * 고용현황 HTML 생성 (차트 포함)
 */
function generateEmploymentHtml(variant: string, data: typeof employmentPresets.growing): string {
  const template = readTemplate('employment');
  let html = fillTemplate(template, data);

  // 차트 바 생성 스크립트 삽입
  const chartScript = `
    <script>
      const monthlyData = ${JSON.stringify(data.monthlyData)};
      const chart = document.getElementById('chart');
      const maxTotal = Math.max(...monthlyData.map(d => d.total));

      monthlyData.forEach(d => {
        const group = document.createElement('div');
        group.className = 'chart-bar-group';

        const bars = document.createElement('div');
        bars.className = 'bars';

        const hireBar = document.createElement('div');
        hireBar.className = 'bar hire';
        hireBar.style.height = (d.hires / 10 * 100) + 'px';

        const leaveBar = document.createElement('div');
        leaveBar.className = 'bar leave';
        leaveBar.style.height = (d.leaves / 10 * 100) + 'px';

        bars.appendChild(hireBar);
        bars.appendChild(leaveBar);

        const label = document.createElement('div');
        label.className = 'chart-label';
        label.textContent = d.month.slice(5);

        group.appendChild(bars);
        group.appendChild(label);
        chart.appendChild(group);
      });

      // 차트 렌더링 완료 마커
      chart.setAttribute('data-rendered', 'true');
    </script>
  `;

  return html.replace('</body>', chartScript + '</body>');
}

/**
 * 재무정보 HTML 생성 (차트 포함)
 */
function generateFinanceHtml(variant: string, data: typeof financePresets.good): string {
  const template = readTemplate('finance');
  let html = fillTemplate(template, data);

  const chartData = data.chartData;
  const chartScript = `
    <script>
      const chartData = ${JSON.stringify(chartData)};
      const years = ['${data.year1}', '${data.year2}', '${data.year3}'];

      // 손익 차트
      const plChart = document.getElementById('pl-chart');
      const plMax = Math.max(...chartData.revenue, ...chartData.operating.map(Math.abs), ...chartData.net.map(Math.abs));

      years.forEach((year, i) => {
        const group = document.createElement('div');
        group.className = 'bar-group';
        group.innerHTML = \`
          <div class="bar revenue" style="height: \${Math.abs(chartData.revenue[i]) / plMax * 150}px;"></div>
          <div class="bar operating \${chartData.operating[i] < 0 ? 'negative' : ''}"
               style="height: \${Math.abs(chartData.operating[i]) / plMax * 150}px;
                      \${chartData.operating[i] < 0 ? 'margin-top: auto;' : ''}"></div>
          <div class="bar net \${chartData.net[i] < 0 ? 'negative' : ''}"
               style="height: \${Math.abs(chartData.net[i]) / plMax * 150}px;
                      \${chartData.net[i] < 0 ? 'margin-top: auto;' : ''}"></div>
        \`;
        plChart.appendChild(group);
      });

      // 재무 차트
      const bsChart = document.getElementById('bs-chart');
      const bsMax = Math.max(...chartData.asset, ...chartData.debt, ...chartData.equity.map(Math.abs));

      years.forEach((year, i) => {
        const group = document.createElement('div');
        group.className = 'bar-group';
        group.innerHTML = \`
          <div class="bar asset" style="height: \${Math.abs(chartData.asset[i]) / bsMax * 150}px;"></div>
          <div class="bar debt" style="height: \${Math.abs(chartData.debt[i]) / bsMax * 150}px;"></div>
          <div class="bar equity \${chartData.equity[i] < 0 ? 'negative' : ''}"
               style="height: \${Math.abs(chartData.equity[i]) / bsMax * 150}px;
                      \${chartData.equity[i] < 0 ? 'margin-top: auto;' : ''}"></div>
        \`;
        bsChart.appendChild(group);
      });

      // 차트 렌더링 완료 마커
      bsChart.setAttribute('data-rendered', 'true');
    </script>
  `;

  return html.replace('</body>', chartScript + '</body>');
}

/**
 * 리뷰 HTML 생성 (별점 및 레이팅 바 포함)
 */
function generateReviewHtml(variant: string, data: typeof reviewPresets.positive): string {
  const template = readTemplate('review');
  let html = fillTemplate(template, data);

  const starsScript = `
    <script>
      // 별점 생성
      const starsContainer = document.getElementById('stars');
      const rating = ${data.stars};
      for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = 'star';
        if (i <= Math.floor(rating)) {
          star.className += ' filled';
          star.textContent = '★';
        } else if (i - 0.5 <= rating) {
          star.className += ' filled';
          star.textContent = '★';
        } else {
          star.className += ' empty';
          star.textContent = '☆';
        }
        starsContainer.appendChild(star);
      }

      // 레이팅 바 생성
      document.querySelectorAll('.rating-bars').forEach(container => {
        const rating = parseInt(container.dataset.rating) || 0;
        for (let i = 0; i < 5; i++) {
          const bar = document.createElement('div');
          bar.className = 'rating-bar' + (i < rating ? ' filled' : '');
          container.appendChild(bar);
        }
      });

      // 렌더링 완료 마커
      starsContainer.setAttribute('data-rendered', 'true');
    </script>
  `;

  return html.replace('</body>', starsScript + '</body>');
}

/**
 * 메인 생성 함수
 */
async function generateFixtures() {
  console.log('🎨 Mock Fixture 이미지 생성 시작...\n');

  // 출력 디렉토리 생성
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1. 기업정보 이미지 생성
  console.log('📋 기업정보 이미지 생성...');
  for (const [variant, data] of Object.entries(companyInfoPresets)) {
    const html = generateCompanyInfoHtml(variant, data);
    await page.setContent(html);
    await page.setViewportSize({ width: 600, height: 500 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `company-info-${variant}.png`),
    });
    console.log(`  ✓ company-info-${variant}.png`);
  }

  // 2. 고용현황 이미지 생성
  console.log('👥 고용현황 이미지 생성...');
  for (const [variant, data] of Object.entries(employmentPresets)) {
    const html = generateEmploymentHtml(variant, data);
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: 900, height: 500 });
    // 차트 렌더링 (page.evaluate로 직접 실행)
    await page.evaluate((monthlyData) => {
      const chart = document.getElementById('chart')!;
      monthlyData.forEach((d: { month: string; hires: number; leaves: number }) => {
        const group = document.createElement('div');
        group.className = 'chart-bar-group';
        const bars = document.createElement('div');
        bars.className = 'bars';
        const hireBar = document.createElement('div');
        hireBar.className = 'bar hire';
        hireBar.style.height = (d.hires / 10 * 100) + 'px';
        const leaveBar = document.createElement('div');
        leaveBar.className = 'bar leave';
        leaveBar.style.height = (d.leaves / 10 * 100) + 'px';
        bars.appendChild(hireBar);
        bars.appendChild(leaveBar);
        const label = document.createElement('div');
        label.className = 'chart-label';
        label.textContent = d.month.slice(5);
        group.appendChild(bars);
        group.appendChild(label);
        chart.appendChild(group);
      });
    }, data.monthlyData);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `employment-${variant}.png`),
    });
    console.log(`  ✓ employment-${variant}.png`);
  }

  // 3. 재무정보 이미지 생성
  console.log('💰 재무정보 이미지 생성...');
  for (const [variant, data] of Object.entries(financePresets)) {
    const html = generateFinanceHtml(variant, data);
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: 1200, height: 550 });
    // 차트 렌더링 (page.evaluate로 직접 실행)
    await page.evaluate((chartData) => {
      const years = ['2022', '2023', '2024'];
      // 손익 차트
      const plChart = document.getElementById('pl-chart')!;
      const plMax = Math.max(...chartData.revenue, ...chartData.operating.map(Math.abs), ...chartData.net.map(Math.abs));
      years.forEach((year, i) => {
        const group = document.createElement('div');
        group.className = 'bar-group';
        group.innerHTML = `
          <div class="bar revenue" style="height: ${Math.abs(chartData.revenue[i]) / plMax * 150}px;"></div>
          <div class="bar operating ${chartData.operating[i] < 0 ? 'negative' : ''}"
               style="height: ${Math.abs(chartData.operating[i]) / plMax * 150}px;"></div>
          <div class="bar net ${chartData.net[i] < 0 ? 'negative' : ''}"
               style="height: ${Math.abs(chartData.net[i]) / plMax * 150}px;"></div>
        `;
        plChart.appendChild(group);
      });
      // 재무 차트
      const bsChart = document.getElementById('bs-chart')!;
      const bsMax = Math.max(...chartData.asset, ...chartData.debt, ...chartData.equity.map(Math.abs));
      years.forEach((year, i) => {
        const group = document.createElement('div');
        group.className = 'bar-group';
        group.innerHTML = `
          <div class="bar asset" style="height: ${Math.abs(chartData.asset[i]) / bsMax * 150}px;"></div>
          <div class="bar debt" style="height: ${Math.abs(chartData.debt[i]) / bsMax * 150}px;"></div>
          <div class="bar equity ${chartData.equity[i] < 0 ? 'negative' : ''}"
               style="height: ${Math.abs(chartData.equity[i]) / bsMax * 150}px;"></div>
        `;
        bsChart.appendChild(group);
      });
    }, data.chartData);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `finance-${variant}.png`),
    });
    console.log(`  ✓ finance-${variant}.png`);
  }

  // 4. 리뷰 이미지 생성
  console.log('📝 리뷰 이미지 생성...');
  for (const [variant, data] of Object.entries(reviewPresets)) {
    const html = generateReviewHtml(variant, data);
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: 750, height: 750 });
    // 별점 및 레이팅 바 렌더링 (page.evaluate로 직접 실행)
    await page.evaluate((stars) => {
      const starsContainer = document.getElementById('stars')!;
      for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = 'star';
        if (i <= Math.floor(stars)) {
          star.className += ' filled';
          star.textContent = '★';
        } else if (i - 0.5 <= stars) {
          star.className += ' filled';
          star.textContent = '★';
        } else {
          star.className += ' empty';
          star.textContent = '☆';
        }
        starsContainer.appendChild(star);
      }
      // 레이팅 바 생성
      document.querySelectorAll('.rating-bars').forEach(container => {
        const rating = parseInt((container as HTMLElement).dataset.rating || '0');
        for (let i = 0; i < 5; i++) {
          const bar = document.createElement('div');
          bar.className = 'rating-bar' + (i < rating ? ' filled' : '');
          container.appendChild(bar);
        }
      });
    }, data.stars);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `review-${variant}.png`),
    });
    console.log(`  ✓ review-${variant}.png`);
  }

  await browser.close();

  console.log('\n✅ 총 12개 이미지 생성 완료!');
  console.log(`📁 출력 경로: ${OUTPUT_DIR}`);
}

// 스크립트 실행
generateFixtures().catch(console.error);
