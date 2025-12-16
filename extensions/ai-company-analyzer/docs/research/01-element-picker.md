# 요소 선택 모드 조사

> 조사일: 2025-12-15
> 관련 스펙: [02-data-extraction.md](../spec/02-data-extraction.md)

## 결정사항

- **선택**: 직접 구현 (라이브러리 X)
- **UI 격리**: Shadow DOM
- **이벤트 처리**: capture 단계에서 preventDefault + stopPropagation
- **이유**: 번들 크기 최소화, 익스텐션 특화 요구사항 대응

## 조사 대상

### npm 패키지

| 라이브러리 | 크기 | 특징 | 채택 |
|-----------|------|------|------|
| [html-element-picker](https://github.com/AlienKevin/html-element-picker) | ~15KB | Vanilla JS, CSS 선택자 필터링 | ❌ 참고만 |
| [pick-dom-element](https://github.com/hmarr/pick-dom-element) | ~8KB | TypeScript, 간결한 API | ❌ 참고만 |
| [js-element-picker](https://www.npmjs.com/package/js-element-picker) | ~10KB | 커스텀 오버레이 drawer | ❌ |

### Chrome Extension 참고 프로젝트

| 프로젝트 | 특징 |
|---------|------|
| [hover-inspect](https://github.com/ilyashubin/hover-inspect) | 박스 모델 시각화 |
| [chrome-element-inspector](https://github.com/gblikas/chrome-element-inspector) | DevTools 스타일 오버레이 |
| [devtools-highlighter](https://github.com/captainbrosset/devtools-highlighter) | DevTools 연동 하이라이터 |

## 상세 분석

### html-element-picker

**장점:**
- Vanilla JS, 의존성 없음
- CSS 선택자로 필터링 가능
- 커스텀 하이라이트 색상

**단점:**
- 익스텐션 특화 기능 없음
- Shadow DOM 격리 미지원

**API 예시:**
```typescript
new ElementPicker({
  container: document.body,
  selectors: '*',
  background: 'rgba(0, 0, 255, 0.2)',
  borderWidth: 2,
  action: {
    trigger: 'click',
    callback: (element) => console.log(element),
  },
});
```

### pick-dom-element

**장점:**
- TypeScript로 작성
- onHover/onClick 콜백 제공
- start()/stop() 메서드로 제어

**단점:**
- 스타일 커스터마이징 제한적

**API 예시:**
```typescript
const picker = new ElementPicker({ borderColor: '#0000ff' });
picker.start({
  onClick: (element) => console.log(element),
  onHover: (element) => console.log('hover:', element),
});
```

## 핵심 구현 기술

### Shadow DOM 격리

페이지 CSS와 충돌 방지:

```typescript
const host = document.createElement('div');
const shadow = host.attachShadow({ mode: 'open' });
shadow.innerHTML = `
  <style>
    .overlay {
      position: fixed;
      pointer-events: none;
      border: 2px solid #4285f4;
      background: rgba(66, 133, 244, 0.1);
      z-index: 2147483647;
    }
  </style>
  <div class="overlay"></div>
`;
document.body.appendChild(host);
```

**Shadow DOM 장점:**
- 스타일 격리: 페이지 CSS 영향 없음
- 스크립트 격리: 페이지 JS와 충돌 방지
- 보안: 내부 DOM 접근 제한

### 이벤트 가로채기

```typescript
// capture: true로 페이지 핸들러보다 먼저 실행
document.addEventListener('click', (e) => {
  e.preventDefault();       // 기본 동작 차단 (링크 이동 등)
  e.stopPropagation();      // 버블링 차단
  e.stopImmediatePropagation(); // 같은 요소의 다른 핸들러도 차단

  // 선택 로직
  handleElementSelect(e.target);
}, { capture: true });

document.addEventListener('mouseover', (e) => {
  // 하이라이트 표시
  highlightElement(e.target);
}, { capture: true });
```

### 하이라이트 구현

```typescript
function highlightElement(element: Element) {
  const rect = element.getBoundingClientRect();
  const overlay = shadow.querySelector('.overlay') as HTMLElement;

  overlay.style.top = `${rect.top + window.scrollY}px`;
  overlay.style.left = `${rect.left + window.scrollX}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}
```

## 미채택 사유

| 옵션 | 사유 |
|------|------|
| html-element-picker | 번들 크기 최소화, 직접 구현으로 커스터마이징 용이 |
| pick-dom-element | Shadow DOM 격리 미지원 |
| js-element-picker | 유지보수 불확실 |

## 참고 자료

- [MDN - Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [MDN - Event.stopPropagation](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation)
- [MDN - Event.preventDefault](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
- [Chrome Extensions and Shadow DOM](https://blog.railwaymen.org/chrome-extensions-shadow-dom)
- [CSS-Tricks - Dangers of Stopping Event Propagation](https://css-tricks.com/dangers-stopping-event-propagation/)
