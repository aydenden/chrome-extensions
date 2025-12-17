# 디자인 시스템 명세

## 1. 디자인 철학: "Editorial Intelligence"

### 컨셉

금융 매거진(Bloomberg, The Economist)과 데이터 저널리즘(The Pudding, NYT)의 결합.
**"데이터에 서사를 부여하는 인터페이스"**

### 차별화 포인트

| 원칙 | 설명 |
|------|------|
| No AI Slop | 보라색 그라디언트, Inter 폰트 금지 |
| 신문 편집 레이아웃 | 비대칭 그리드, 타이포그래피 중심 |
| 데이터 스토리텔링 | 숫자가 아닌 "인사이트"를 전달 |

---

## 2. 컬러 시스템

### 2.1 Primary Palette: "Ink & Paper"

```css
:root {
  /* Base - 오래된 신문지 질감 */
  --paper: #F7F5F0;
  --paper-warm: #EDE9E0;
  --paper-dark: #1C1917;

  /* Ink - 깊은 먹색 */
  --ink: #0F0F0F;
  --ink-soft: #3D3D3D;
  --ink-muted: #737373;

  /* Accent - 금융 데이터 강조 */
  --signal-positive: #059669;  /* 상승/긍정 - 에메랄드 */
  --signal-negative: #DC2626;  /* 하락/부정 - 진홍 */
  --signal-neutral: #0369A1;   /* 중립/정보 - 딥블루 */

  /* Highlight - 형광펜 효과 */
  --highlight-yellow: #FEF08A;
  --highlight-coral: #FECACA;
  --highlight-mint: #A7F3D0;

  /* Surface */
  --surface-elevated: #FFFFFF;
  --surface-sunken: #E7E5E0;
  --border-subtle: rgba(15, 15, 15, 0.08);
  --border-strong: rgba(15, 15, 15, 0.2);
}
```

### 2.2 Dark Theme (심야 에디션)

```css
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
```

### 2.3 데이터 소스 컬러

```css
:root {
  /* 각 소스별 시그니처 컬러 - 채도 낮추고 톤 통일 */
  --source-wanted: #2563EB;      /* 원티드 - 로얄블루 */
  --source-innoforest: #047857;  /* 혁신의숲 - 포레스트 */
  --source-dart: #1E293B;        /* DART - 슬레이트 */
  --source-smes: #C2410C;        /* 중기부 - 테라코타 */
  --source-blind: #CA8A04;       /* 블라인드 - 골드 */
  --source-jobplanet: #0D9488;   /* 잡플래닛 - 틸 */
}
```

---

## 3. 타이포그래피

### 3.1 폰트 선택

```css
/* Pretendard - 한국어 가독성 최적화 */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');

:root {
  /* Display & Body 통합 - Pretendard Variable */
  --font-display: 'Pretendard Variable', 'Pretendard', -apple-system, sans-serif;
  --font-body: 'Pretendard Variable', 'Pretendard', -apple-system, sans-serif;

  /* Mono - 데이터, 코드 */
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
}
```

| 용도 | 폰트 | 설명 |
|------|------|------|
| Display | Pretendard Variable | 헤드라인, 숫자 강조 (ExtraBold 800) |
| Body | Pretendard Variable | 본문, UI 요소 (Regular 400 / Medium 500) |
| Mono | JetBrains Mono | 데이터, 코드 |

**Pretendard 선택 이유:**
- 한국어 가독성 최적화
- Variable Font로 유연한 웨이트 조절
- 시스템 폰트 대비 일관된 렌더링

### 3.2 타입 스케일

```css
:root {
  /* Fluid Type Scale */
  --text-xs: clamp(0.7rem, 0.65rem + 0.25vw, 0.75rem);
  --text-sm: clamp(0.8rem, 0.75rem + 0.25vw, 0.875rem);
  --text-base: clamp(0.95rem, 0.9rem + 0.25vw, 1rem);
  --text-lg: clamp(1.1rem, 1rem + 0.5vw, 1.25rem);
  --text-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
  --text-2xl: clamp(1.5rem, 1.25rem + 1.25vw, 2rem);
  --text-3xl: clamp(2rem, 1.5rem + 2.5vw, 3rem);
  --text-4xl: clamp(2.5rem, 2rem + 3vw, 4rem);

  /* 숫자 전용 - 큰 데이터 표시 */
  --text-data-hero: clamp(3rem, 2.5rem + 4vw, 6rem);
}
```

### 3.3 타이포그래피 스타일

```css
/* 헤드라인 - 신문 1면 스타일 */
.headline {
  font-family: var(--font-display);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

/* 서브헤드 - 기사 리드 */
.subhead {
  font-family: var(--font-display);
  font-weight: 400;
  font-style: italic;
  letter-spacing: 0.01em;
  line-height: 1.4;
}

/* 데이터 숫자 - 강조 */
.data-figure {
  font-family: var(--font-mono);
  font-weight: 500;
  font-feature-settings: 'tnum' 1;  /* Tabular numbers */
  letter-spacing: -0.02em;
}

/* 본문 */
.body {
  font-family: var(--font-body);
  font-weight: 400;
  line-height: 1.6;
}

/* 라벨 */
.label {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--text-xs);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
```

---

## 4. 스페이싱

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.5rem;    /* 24px */
  --space-6: 2rem;      /* 32px */
  --space-8: 3rem;      /* 48px */
  --space-10: 4rem;     /* 64px */
  --space-12: 6rem;     /* 96px */
  --space-16: 8rem;     /* 128px */
}
```

---

## 5. 레이아웃 그리드

### 5.1 12컬럼 비대칭 그리드

```css
.editorial-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-4);
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 var(--space-6);
}

/* 주요 콘텐츠: 8컬럼 */
.main-content {
  grid-column: 1 / 9;
}

/* 사이드바: 4컬럼 */
.sidebar {
  grid-column: 9 / 13;
  border-left: 1px solid var(--border-subtle);
  padding-left: var(--space-6);
}

/* 전체 너비 섹션 */
.full-bleed {
  grid-column: 1 / -1;
}
```

### 5.2 반응형 브레이크포인트

```css
@media (max-width: 1024px) {
  .main-content,
  .sidebar {
    grid-column: 1 / -1;
  }
  .sidebar {
    border-left: none;
    border-top: 1px solid var(--border-subtle);
    padding-left: 0;
    padding-top: var(--space-6);
  }
}
```

---

## 6. 디자인 토큰 요약

| 카테고리 | 토큰 | 값 |
|----------|------|-----|
| **Primary** | --paper | #F7F5F0 |
| | --ink | #0F0F0F |
| **Display Font** | --font-display | Noto Serif KR |
| **Body Font** | --font-body | IBM Plex Sans |
| **Mono Font** | --font-mono | JetBrains Mono |
| **Radius** | cards | 0px (sharp) |
| | buttons | 0px (sharp) |
| | badges | 2px |
| **Shadow** | hover | 0 4px 6px rgba(0,0,0,0.05) |
| **Border** | strong | 2px solid var(--ink) |
| | subtle | 1px solid rgba(15,15,15,0.08) |

---

## 7. 적용 원칙

### 7.1 색상 사용

- **배경**: `--paper` (라이트), `--ink` (다크)
- **텍스트**: `--ink` (라이트), `--paper-dark` (다크)
- **강조**: Signal 컬러 사용 (positive/negative/neutral)
- **하이라이트**: 형광펜 효과로 중요 정보 표시

### 7.2 타이포그래피 계층

1. **헤드라인**: Display 폰트, 굵은 웨이트
2. **서브헤드**: Display 폰트, 이탤릭
3. **본문**: Body 폰트, 일반 웨이트
4. **데이터**: Mono 폰트, Tabular numbers
5. **라벨**: Body 폰트, 대문자, 작은 크기

### 7.3 레이아웃 패턴

- **비대칭 그리드**: 8:4 또는 9:3 비율
- **샤프한 엣지**: border-radius 최소화
- **뚜렷한 구분선**: 2px solid 테두리

---

## 8. 컴포넌트 스타일

### 8.1 삭제 버튼

이미지 카드 등에서 사용하는 인라인 삭제 버튼.

```css
.delete-button {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
}

/* 부모 카드 Hover 시 표시 */
.image-card:hover .delete-button,
.card:hover .delete-button {
  opacity: 1;
}

/* 삭제 버튼 Hover */
.delete-button:hover {
  background: var(--signal-negative);
}
```

| 속성 | 값 | 설명 |
|------|-----|------|
| 크기 | 24×24px | 터치 타겟 최소 크기 |
| 배경 | rgba(0,0,0,0.6) | 반투명 다크 |
| 호버 배경 | --signal-negative | 삭제 의미 강조 |
| 트랜지션 | 0.2s ease | 부드러운 표시/숨김 |
