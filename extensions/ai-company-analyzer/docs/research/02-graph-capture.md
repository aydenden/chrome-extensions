# 그래프 캡처 조사

> 조사일: 2025-12-15
> 관련 스펙: [02-data-extraction.md](../spec/02-data-extraction.md)

## 결정사항

| 대상 | 선택 | 이유 |
|------|------|------|
| **SVG 그래프** | canvg v4.0.3 | SVG → Canvas 변환 특화 |
| **일반 영역** | captureVisibleTab + crop | 픽셀 정확도, 빠름 |
| **영역 선택 UI** | 직접 구현 | 단순한 요구사항 |

## 조사 대상

### SVG 캡처 라이브러리

| 라이브러리 | 크기 | 특징 | 채택 |
|-----------|------|------|------|
| [canvg](https://www.npmjs.com/package/canvg) | ~312KB | SVG → Canvas, Rust 기반 | ⭐ 채택 |
| Native SVG serialization | 0KB | XMLSerializer 사용 | ❌ 이미지 변환 불가 |

### 영역 캡처 방식

| 방식 | 정확도 | 속도 | Cross-origin | 채택 |
|------|--------|------|--------------|------|
| [captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/tabs/#method-captureVisibleTab) | ⭐⭐⭐ 픽셀 정확 | 빠름 | ✅ | ⭐ 채택 |
| [html2canvas](https://html2canvas.hertzen.com/) | ⭐⭐ DOM 재구성 | 느림 | ❌ 프록시 필요 | ❌ |
| [modern-screenshot](https://www.npmjs.com/package/modern-screenshot) | ⭐⭐ | 중간 | ❌ | ❌ |

### 영역 선택 UI

| 라이브러리 | 특징 | 채택 |
|-----------|------|------|
| [region-screenshot-js](https://github.com/weijun-lab/region-screenshot-js) | WebRTC 기반 | ❌ HTTPS 필요 |
| [Cropper.js](https://github.com/fengyuanchen/cropperjs) | 이미지 크롭 전용 | ❌ |
| 직접 구현 | 드래그 선택 | ⭐ 채택 |

## 상세 분석

### canvg (SVG 캡처용)

**장점:**
- SVG를 Canvas로 정확하게 변환
- 애니메이션 지원
- OffscreenCanvas 지원 (Web Worker)

**단점:**
- 번들 크기 ~312KB

**코드 예시:**
```typescript
import { Canvg } from 'canvg';

async function captureSvg(svgElement: SVGElement): Promise<Blob> {
  const svgString = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // SVG 크기 설정
  const rect = svgElement.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // canvg로 렌더링
  const v = Canvg.fromString(ctx, svgString);
  await v.render();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
```

### captureVisibleTab (영역 캡처용)

**장점:**
- 픽셀 그대로 캡처
- 빠름
- Cross-origin 콘텐츠도 캡처 가능

**단점:**
- 화면에 보이는 부분만 캡처
- `tabs` 권한 필요

**코드 예시:**
```typescript
// Background Script (Service Worker)
async function captureAndCrop(rect: DOMRect): Promise<string> {
  const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
    format: 'png',
  });

  // Content Script에서 crop 처리
  return dataUrl;
}

// Content Script
async function cropImage(dataUrl: string, rect: DOMRect): Promise<Blob> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve) => (img.onload = resolve));

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    img,
    rect.left * dpr,
    rect.top * dpr,
    rect.width * dpr,
    rect.height * dpr,
    0,
    0,
    rect.width * dpr,
    rect.height * dpr
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
```

### html2canvas vs captureVisibleTab

| 항목 | html2canvas | captureVisibleTab |
|------|-------------|-------------------|
| **원리** | DOM 재구성 후 Canvas 렌더링 | 브라우저 렌더링 결과 캡처 |
| **정확도** | 불완전 (CSS 일부 미지원) | 픽셀 정확 |
| **속도** | 느림 (복잡한 DOM에서 21초+) | 빠름 |
| **Cross-origin** | ❌ 프록시 필요 | ✅ |
| **MV3 호환** | ⚠️ CSP 에러 가능 | ✅ |
| **범위** | 전체 페이지 가능 | 화면에 보이는 부분만 |

### 영역 선택 UI 구현

```typescript
interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

class RegionSelector {
  private overlay: HTMLDivElement;
  private selection: HTMLDivElement;
  private rect: SelectionRect | null = null;

  start(): Promise<DOMRect> {
    return new Promise((resolve, reject) => {
      this.createOverlay();

      document.addEventListener('mousedown', this.onMouseDown);
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', () => {
        if (this.rect) {
          resolve(this.getRect());
        }
        this.cleanup();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          reject(new Error('Cancelled'));
          this.cleanup();
        }
      });
    });
  }

  private getRect(): DOMRect {
    const { startX, startY, endX, endY } = this.rect!;
    return new DOMRect(
      Math.min(startX, endX),
      Math.min(startY, endY),
      Math.abs(endX - startX),
      Math.abs(endY - startY)
    );
  }
}
```

## 미채택 사유

| 옵션 | 사유 |
|------|------|
| html2canvas | DOM 재구성 방식으로 정확도 낮음, 속도 느림, MV3 CSP 이슈 |
| modern-screenshot | html2canvas 대비 빠르지만 여전히 DOM 재구성 방식 |
| region-screenshot-js | WebRTC 의존, HTTPS 필수 |
| Cropper.js | 이미지 크롭 전용, 화면 캡처 기능 없음 |

## 참고 자료

- [canvg](https://www.npmjs.com/package/canvg) - npm
- [canvg Documentation](https://canvg.js.org/)
- [captureVisibleTab API](https://developer.chrome.com/docs/extensions/reference/tabs/#method-captureVisibleTab)
- [html2canvas](https://html2canvas.hertzen.com/)
- [Best HTML to Canvas Solutions in 2025](https://portalzine.de/best-html-to-canvas-solutions-in-2025/)
- [Capturing DOM as Image - monday.com](https://engineering.monday.com/capturing-dom-as-image-is-harder-than-you-think-how-we-solved-it-at-monday-com/)
