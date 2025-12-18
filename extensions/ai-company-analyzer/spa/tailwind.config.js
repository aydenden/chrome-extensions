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
