# Feature 16: 디자인 시스템 기반

## 개요

Editorial Intelligence 디자인 시스템의 CSS 변수와 TailwindCSS 설정을 구성합니다.

## 범위

- globals.css (CSS 변수)
- tailwind.config.js (커스텀 컬러, 폰트)
- Pretendard, JetBrains Mono 폰트 설정

## 의존성

- Feature 02: SPA Project Setup

## 구현 상세

### spa/src/styles/globals.css

```css
/* Pretendard Variable Font */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');

/* JetBrains Mono */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* === Base Colors: Ink & Paper === */
  --paper: #F7F5F0;
  --paper-warm: #EDE9E0;
  --paper-dark: #1C1917;

  --ink: #0F0F0F;
  --ink-soft: #3D3D3D;
  --ink-muted: #737373;

  /* === Signal Colors === */
  --signal-positive: #059669;
  --signal-negative: #DC2626;
  --signal-neutral: #0369A1;

  /* === Highlight Colors === */
  --highlight-yellow: #FEF08A;
  --highlight-coral: #FECACA;
  --highlight-mint: #A7F3D0;

  /* === Surface === */
  --surface-elevated: #FFFFFF;
  --surface-sunken: #E7E5E0;
  --border-subtle: rgba(15, 15, 15, 0.08);
  --border-strong: rgba(15, 15, 15, 0.2);

  /* === Data Source Colors === */
  --source-wanted: #2563EB;
  --source-innoforest: #047857;
  --source-dart: #1E293B;
  --source-smes: #C2410C;
  --source-blind: #CA8A04;
  --source-jobplanet: #0D9488;
  --source-saramin: #7C3AED;
  --source-other: #6B7280;

  /* === Typography === */
  --font-display: 'Pretendard Variable', 'Pretendard', -apple-system, sans-serif;
  --font-body: 'Pretendard Variable', 'Pretendard', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;

  /* === Fluid Type Scale === */
  --text-xs: clamp(0.7rem, 0.65rem + 0.25vw, 0.75rem);
  --text-sm: clamp(0.8rem, 0.75rem + 0.25vw, 0.875rem);
  --text-base: clamp(0.95rem, 0.9rem + 0.25vw, 1rem);
  --text-lg: clamp(1.1rem, 1rem + 0.5vw, 1.25rem);
  --text-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
  --text-2xl: clamp(1.5rem, 1.25rem + 1.25vw, 2rem);
  --text-3xl: clamp(2rem, 1.5rem + 2.5vw, 3rem);
  --text-4xl: clamp(2.5rem, 2rem + 3vw, 4rem);
  --text-data-hero: clamp(3rem, 2.5rem + 4vw, 6rem);

  /* === Spacing === */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-8: 3rem;
  --space-10: 4rem;
  --space-12: 6rem;
}

/* Dark Theme */
[data-theme="dark"] {
  --paper: #0F0F0F;
  --paper-warm: #1A1917;
  --paper-dark: #F7F5F0;

  --ink: #EDEDED;
  --ink-soft: #B0B0B0;
  --ink-muted: #6B6B6B;

  --surface-elevated: #1C1C1C;
  --surface-sunken: #0A0A0A;
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-strong: rgba(255, 255, 255, 0.15);
}

/* === Base Styles === */
body {
  font-family: var(--font-body);
  background-color: var(--paper);
  color: var(--ink);
  line-height: 1.6;
}

/* === Typography Classes === */
.headline {
  font-family: var(--font-display);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.subhead {
  font-family: var(--font-display);
  font-weight: 400;
  font-style: italic;
  letter-spacing: 0.01em;
  line-height: 1.4;
}

.data-figure {
  font-family: var(--font-mono);
  font-weight: 500;
  font-feature-settings: 'tnum' 1;
  letter-spacing: -0.02em;
}

.label {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--text-xs);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* === Editorial Grid === */
.editorial-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-4);
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 var(--space-6);
}

@media (max-width: 1024px) {
  .editorial-grid {
    padding: 0 var(--space-4);
  }
}
```

### spa/tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: 'var(--paper)',
          warm: 'var(--paper-warm)',
          dark: 'var(--paper-dark)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          soft: 'var(--ink-soft)',
          muted: 'var(--ink-muted)',
        },
        signal: {
          positive: 'var(--signal-positive)',
          negative: 'var(--signal-negative)',
          neutral: 'var(--signal-neutral)',
        },
        highlight: {
          yellow: 'var(--highlight-yellow)',
          coral: 'var(--highlight-coral)',
          mint: 'var(--highlight-mint)',
        },
        surface: {
          elevated: 'var(--surface-elevated)',
          sunken: 'var(--surface-sunken)',
        },
        source: {
          wanted: 'var(--source-wanted)',
          innoforest: 'var(--source-innoforest)',
          dart: 'var(--source-dart)',
          smes: 'var(--source-smes)',
          blind: 'var(--source-blind)',
          jobplanet: 'var(--source-jobplanet)',
          saramin: 'var(--source-saramin)',
          other: 'var(--source-other)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        none: '0',
        sm: '2px',
      },
      boxShadow: {
        card: '0 4px 6px rgba(0, 0, 0, 0.05)',
        modal: '0 20px 60px rgba(0, 0, 0, 0.2)',
      },
      borderWidth: {
        strong: '2px',
      },
    },
  },
  plugins: [],
};
```

### 사용 예시

```tsx
// 컴포넌트에서 TailwindCSS 클래스 사용
<div className="bg-paper text-ink">
  <h1 className="headline text-3xl">헤드라인</h1>
  <p className="text-ink-muted">설명 텍스트</p>
  <span className="text-signal-positive">+25%</span>
  <span className="text-signal-negative">-10%</span>
  <span className="bg-source-wanted text-white px-2 py-1">원티드</span>
  <span className="data-figure text-4xl">72</span>
</div>

// 레이아웃
<div className="editorial-grid">
  <div className="col-span-8">메인 콘텐츠</div>
  <div className="col-span-4 border-l border-ink/10 pl-6">사이드바</div>
</div>
```

## 완료 기준

- [ ] CSS 변수 정의 (colors, typography, spacing)
- [ ] Pretendard 폰트 로드
- [ ] JetBrains Mono 폰트 로드
- [ ] TailwindCSS 커스텀 테마 설정
- [ ] Editorial Grid 클래스
- [ ] Typography 유틸리티 클래스 (.headline, .subhead, .data-figure, .label)
- [ ] 다크 테마 변수 설정

## 참조 문서

- spec/05-design-system.md (전체)
