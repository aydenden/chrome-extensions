# UI 컴포넌트 기능 명세

## 1. 개요

"Editorial Intelligence" 디자인 시스템 기반 UI 컴포넌트 구현 가이드.

---

## 2. Company Card (회사 카드)

### 2.1 구조

```tsx
<CompanyCard>
  <CompanyCard.Name>회사명</CompanyCard.Name>
  <CompanyCard.Score>72</CompanyCard.Score>
  <CompanyCard.Sources>
    <SourceBadge source="wanted" />
    <SourceBadge source="jobplanet" />
  </CompanyCard.Sources>
  <CompanyCard.Date>2024.01.15</CompanyCard.Date>
</CompanyCard>
```

### 2.2 스타일

```css
/* 신문 기사 스니펫 스타일 */
.company-card {
  position: relative;
  background: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  padding: var(--space-5);

  /* 미묘한 종이 질감 */
  background-image: url("data:image/svg+xml,..."); /* 노이즈 텍스처 */

  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.company-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 10px 15px -3px rgba(0, 0, 0, 0.08);
}

/* 회사명 - 기사 제목 스타일 */
.company-card__name {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--ink);
  margin-bottom: var(--space-2);

  /* 밑줄 효과 */
  text-decoration: underline;
  text-decoration-color: var(--highlight-yellow);
  text-decoration-thickness: 0.15em;
  text-underline-offset: 0.1em;
}

/* 점수 - 대형 숫자 */
.company-card__score {
  font-family: var(--font-mono);
  font-size: var(--text-3xl);
  font-weight: 500;
  color: var(--ink);
  line-height: 1;
}

.company-card__score-label {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

---

## 3. Source Badge (데이터 소스 배지)

### 3.1 구조

```tsx
<SourceBadge source="wanted" />
<SourceBadge source="jobplanet" />
<SourceBadge source="dart" />
```

### 3.2 스타일

```css
.source-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: 2px;
  background: var(--surface-sunken);
}

.source-badge::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: currentColor;
}

/* 소스별 컬러 */
.source-badge--wanted { color: var(--source-wanted); }
.source-badge--jobplanet { color: var(--source-jobplanet); }
.source-badge--dart { color: var(--source-dart); }
.source-badge--innoforest { color: var(--source-innoforest); }
.source-badge--smes { color: var(--source-smes); }
.source-badge--blind { color: var(--source-blind); }
```

---

## 4. Analysis Card (분석 결과 카드)

### 4.1 구조

```tsx
<AnalysisCard>
  <AnalysisCard.Hero>
    <Score value={72} />
  </AnalysisCard.Hero>
  <AnalysisCard.Section title="RUNWAY">
    <p>현재 매출 성장률 기준 약 18개월 운영 가능</p>
  </AnalysisCard.Section>
  <AnalysisCard.Section title="재무 리스크">
    <RiskIndicator level="low" />
  </AnalysisCard.Section>
</AnalysisCard>
```

### 4.2 스타일

```css
/* 데이터 스토리 카드 */
.analysis-card {
  background: var(--surface-elevated);
  border: 1px solid var(--border-strong);
  overflow: hidden;
}

/* 점수 히어로 섹션 */
.analysis-card__hero {
  padding: var(--space-8) var(--space-6);
  text-align: center;
  background: linear-gradient(
    180deg,
    var(--paper) 0%,
    var(--paper-warm) 100%
  );
  border-bottom: 1px solid var(--border-subtle);
}

.analysis-card__score {
  font-family: var(--font-mono);
  font-size: var(--text-data-hero);
  font-weight: 500;
  color: var(--ink);
  line-height: 1;

  /* 숫자 그림자 효과 */
  text-shadow:
    2px 2px 0 var(--paper),
    4px 4px 0 var(--border-subtle);
}

/* 분석 섹션 */
.analysis-section {
  padding: var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
}

.analysis-section:last-child {
  border-bottom: none;
}

.analysis-section__title {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--space-3);
}

.analysis-section__content {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--ink);
  line-height: 1.5;
}
```

---

## 5. Risk Indicator (리스크 인디케이터)

### 5.1 구조

```tsx
<RiskIndicator level="low" label="안정적인 재무구조" />
<RiskIndicator level="medium" label="주의 필요" />
<RiskIndicator level="high" label="높은 리스크" />
```

### 5.2 스타일

```css
.risk-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: 4px;
}

.risk-indicator--low {
  background: var(--highlight-mint);
  color: var(--signal-positive);
}

.risk-indicator--medium {
  background: var(--highlight-yellow);
  color: var(--source-smes);
}

.risk-indicator--high {
  background: var(--highlight-coral);
  color: var(--signal-negative);
}
```

---

## 6. Image Gallery (이미지 갤러리)

### 6.1 구조

```tsx
<ImageGallery>
  <ImageItem
    id="img-1"
    category="revenue_trend"
    onClick={handleClick}
  />
  <ImageItem
    id="img-2"
    category="balance_sheet"
    onClick={handleClick}
  />
</ImageGallery>
```

### 6.2 스타일

```css
/* 사진 에세이 스타일 */
.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
}

.image-item {
  position: relative;
  aspect-ratio: 4/3;
  overflow: hidden;
  background: var(--surface-sunken);
  cursor: pointer;

  /* 필름 프레임 효과 */
  box-shadow: inset 0 0 0 1px var(--border-subtle);
}

.image-item::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent 60%,
    rgba(0, 0, 0, 0.4) 100%
  );
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-item:hover::after {
  opacity: 1;
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(20%);
  transition: filter 0.3s ease, transform 0.3s ease;
}

.image-item:hover img {
  filter: grayscale(0%);
  transform: scale(1.05);
}

/* 카테고리 배지 */
.image-item__category {
  position: absolute;
  bottom: var(--space-2);
  left: var(--space-2);
  z-index: 1;

  padding: var(--space-1) var(--space-2);
  background: var(--paper);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--ink);
}
```

---

## 7. Progress & Loading

### 7.1 Loading Text (타자기 스타일)

```css
.loading-text {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--ink-muted);
}

.loading-text::after {
  content: '|';
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}
```

### 7.2 Progress Bar

```css
.progress-bar {
  height: 4px;
  background: var(--surface-sunken);
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  background: var(--ink);
  transition: width 0.3s ease;
}
```

### 7.3 Analysis Progress

```css
.analysis-progress {
  padding: var(--space-6);
  background: var(--surface-elevated);
  border: 2px solid var(--ink);
}

.analysis-progress__phase {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.analysis-progress__phase-indicator {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;

  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;

  border: 2px solid var(--ink);
}

.analysis-progress__phase-indicator--active {
  background: var(--ink);
  color: var(--paper);
}

.analysis-progress__phase-indicator--complete {
  background: var(--signal-positive);
  border-color: var(--signal-positive);
  color: white;
}
```

---

## 8. Navigation & Tabs

### 8.1 Nav Tabs (신문 섹션 스타일)

```css
.nav-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--ink);
}

.nav-tab {
  padding: var(--space-3) var(--space-5);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  position: relative;

  transition: color 0.2s ease;
}

.nav-tab:hover {
  color: var(--ink);
}

.nav-tab--active {
  color: var(--ink);
  background: var(--ink);
  color: var(--paper);
}
```

### 8.2 Source Tabs (데이터 소스 필터)

```css
.source-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--border-subtle);
}

.source-tab {
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--ink-soft);
  background: transparent;
  border: 1px solid var(--border-subtle);
  cursor: pointer;

  transition: all 0.15s ease;
}

.source-tab:hover {
  border-color: var(--ink-muted);
}

.source-tab--active {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
```

---

## 9. Buttons

### 9.1 Primary Button

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);

  padding: var(--space-3) var(--space-5);

  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  color: var(--paper);
  background: var(--ink);
  border: 2px solid var(--ink);

  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: transparent;
  color: var(--ink);
}

.btn-primary:active {
  transform: translateY(1px);
}
```

### 9.2 Secondary Button

```css
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);

  padding: var(--space-3) var(--space-5);

  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;

  color: var(--ink);
  background: transparent;
  border: 1px solid var(--border-strong);

  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  border-color: var(--ink);
  background: var(--surface-sunken);
}
```

### 9.3 Ghost Button

```css
.btn-ghost {
  padding: var(--space-2) var(--space-3);

  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;

  color: var(--ink-muted);
  background: transparent;
  border: none;

  cursor: pointer;
  transition: color 0.15s ease;
}

.btn-ghost:hover {
  color: var(--ink);
}
```

### 9.4 Danger Button

```css
.btn-danger {
  color: var(--signal-negative);
  border-color: var(--signal-negative);
}

.btn-danger:hover {
  background: var(--signal-negative);
  color: white;
}
```

---

## 10. 애니메이션

### 10.1 페이지 진입 (Stagger Fade In)

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: fadeInUp 0.5s ease forwards;
  opacity: 0;
}

.animate-in:nth-child(1) { animation-delay: 0.05s; }
.animate-in:nth-child(2) { animation-delay: 0.1s; }
.animate-in:nth-child(3) { animation-delay: 0.15s; }
.animate-in:nth-child(4) { animation-delay: 0.2s; }
.animate-in:nth-child(5) { animation-delay: 0.25s; }
```

### 10.2 타이핑 효과

```css
@keyframes typewriter {
  from { width: 0; }
  to { width: 100%; }
}

.typewriter {
  overflow: hidden;
  white-space: nowrap;
  animation: typewriter 1s steps(20) forwards;
}
```

### 10.3 호버 하이라이트

```css
.hover-highlight {
  position: relative;
  display: inline;
}

.hover-highlight::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 0.2em;
  background: var(--highlight-yellow);
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.3s ease;
}

.hover-highlight:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}
```

### 10.4 이미지 줌

```css
.hover-zoom {
  overflow: hidden;
}

.hover-zoom img {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.hover-zoom:hover img {
  transform: scale(1.08);
}
```

---

## 11. Mini Popup (Extension)

### 11.1 구조

```tsx
<MiniPopup>
  <MiniPopup.Header>AI COMPANY ANALYZER</MiniPopup.Header>
  <MiniPopup.SiteInfo source="wanted" />
  <MiniPopup.Actions>
    <Button icon="camera">스크린샷 캡처</Button>
  </MiniPopup.Actions>
  <MiniPopup.Footer count={12} />
</MiniPopup>
```

### 11.2 스타일

```css
.mini-popup {
  width: 320px;
  background: var(--paper);
  font-family: var(--font-body);
}

.mini-popup__header {
  padding: var(--space-4);
  border-bottom: 2px solid var(--ink);
  text-align: center;
}

.mini-popup__logo {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.mini-popup__actions {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.mini-popup__footer {
  padding: var(--space-3) var(--space-4);
  background: var(--surface-sunken);
  border-top: 1px solid var(--border-subtle);

  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mini-popup__stat {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

.mini-popup__link {
  font-size: var(--text-sm);
  color: var(--ink-muted);
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

---

## 12. 구현 체크리스트

- [ ] CSS 변수 파일 생성 (`variables.css`)
- [ ] 기본 컴포넌트 구현
  - [ ] Button
  - [ ] Badge
  - [ ] Card
- [ ] 복합 컴포넌트 구현
  - [ ] CompanyCard
  - [ ] AnalysisCard
  - [ ] ImageGallery
  - [ ] ProgressBar
- [ ] 네비게이션 구현
  - [ ] NavTabs
  - [ ] SourceTabs
- [ ] 애니메이션 적용
  - [ ] fadeInUp
  - [ ] typewriter
  - [ ] hover effects
- [ ] 다크모드 지원
