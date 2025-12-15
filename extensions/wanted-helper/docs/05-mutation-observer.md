# MutationObserver

## 목차
- [MutationObserver란?](#mutationobserver란)
- [기본 사용법](#기본-사용법)
- [설정 옵션](#설정-옵션)
- [현재 프로젝트 예시](#현재-프로젝트-예시)
- [성능 최적화](#성능-최적화)
- [실전 패턴](#실전-패턴)
- [주의사항](#주의사항)

## MutationObserver란?

**MutationObserver**는 DOM 트리의 변경사항을 감시하는 Web API입니다. 요소의 추가/제거, 속성 변경, 텍스트 변경 등을 감지할 수 있습니다.

### 왜 필요한가?

```javascript
// ❌ 비효율적: 주기적으로 체크
setInterval(() => {
  const element = document.querySelector('.target');
  if (element) {
    doSomething(element);
  }
}, 100); // CPU 낭비!

// ✅ 효율적: 변경 시에만 반응
const observer = new MutationObserver((mutations) => {
  const element = document.querySelector('.target');
  if (element) {
    doSomething(element);
  }
});
observer.observe(document.body, { childList: true, subtree: true });
```

### 이전 방식과 비교

| 방식 | 성능 | 문제점 |
|------|------|--------|
| **Mutation Events** (구식) | 느림 | deprecated, 동기식 |
| **Polling (setInterval)** | 매우 느림 | CPU 낭비, 지연 발생 |
| **MutationObserver** | 빠름 (5-10배) | 없음 (권장) |

## 기본 사용법

### 1. Observer 생성

```javascript
const observer = new MutationObserver((mutations, observer) => {
  // mutations: 변경사항 배열
  // observer: observer 인스턴스 자체

  mutations.forEach(mutation => {
    console.log('Type:', mutation.type);
    console.log('Target:', mutation.target);
  });
});
```

### 2. 감시 시작

```javascript
const target = document.getElementById('container');

const config = {
  childList: true,      // 자식 노드 추가/제거 감지
  attributes: true,     // 속성 변경 감지
  characterData: true,  // 텍스트 변경 감지
  subtree: true         // 하위 모든 노드 감지
};

observer.observe(target, config);
```

### 3. 감시 중지

```javascript
// 일시 중지
observer.disconnect();

// 누적된 변경사항 가져오기 (콜백 실행 전)
const mutations = observer.takeRecords();
```

## 설정 옵션

### childList

자식 노드의 추가/제거를 감지합니다.

```javascript
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    // 추가된 노드
    mutation.addedNodes.forEach(node => {
      console.log('Added:', node);
    });

    // 제거된 노드
    mutation.removedNodes.forEach(node => {
      console.log('Removed:', node);
    });
  });
});

observer.observe(target, { childList: true });
```

### attributes

속성 변경을 감지합니다.

```javascript
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'attributes') {
      console.log('Attribute changed:', mutation.attributeName);
      console.log('Old value:', mutation.oldValue);
      console.log('New value:', mutation.target.getAttribute(mutation.attributeName));
    }
  });
});

observer.observe(target, {
  attributes: true,
  attributeOldValue: true, // 이전 값 저장
  attributeFilter: ['class', 'style'] // 특정 속성만 감지
});
```

### characterData

텍스트 노드의 내용 변경을 감지합니다.

```javascript
const textNode = document.createTextNode('Hello');
element.appendChild(textNode);

const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'characterData') {
      console.log('Text changed from:', mutation.oldValue);
      console.log('To:', mutation.target.textContent);
    }
  });
});

observer.observe(textNode, {
  characterData: true,
  characterDataOldValue: true
});

textNode.textContent = 'World'; // 감지됨
```

### subtree

하위 모든 자손 노드의 변경도 감지합니다.

```javascript
observer.observe(document.body, {
  childList: true,
  subtree: true // body 아래 모든 변경 감지
});
```

## 현재 프로젝트 예시

### URL 변경 감지

```typescript
// src/index.ts
const observer = new MutationObserver(
  debounce(() => {
    const currentPath = window.location.pathname;

    // 회사 페이지 감지
    const companyMatch = currentPath.match(/\/company\/(\d+)/);
    if (companyMatch) {
      const companyId = companyMatch[1];
      addButton('company', companyId);
    }

    // 채용 공고 페이지 감지
    const positionMatch = currentPath.match(/\/wd\/(\d+)/);
    if (positionMatch) {
      const positionId = positionMatch[1];
      addButton('position', positionId);
      checkAndAddCompletedApplication(positionId);
    }

    // 목록 페이지 감지
    updateCardStyles(companyIds, positionIds);
  }, 100)
);

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

### 무한 루프 방지

```typescript
const observer = new MutationObserver((mutations) => {
  // 자신이 추가한 요소는 무시
  const shouldIgnore = mutations.some(mutation => {
    return Array.from(mutation.addedNodes).some(node => {
      return node.id === 'action-button'; // 확장 프로그램이 추가한 버튼
    });
  });

  if (shouldIgnore) return;

  // 처리
  detectPageAndAct();
});
```

## 성능 최적화

### 1. Debounce 패턴

```typescript
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function (...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 사용
const observer = new MutationObserver(
  debounce(() => {
    // 100ms 내에 여러 변경이 일어나도 한 번만 실행
    heavyOperation();
  }, 100)
);
```

### 2. Throttle 패턴

```typescript
function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// 사용: 최소 100ms 간격으로 실행
const observer = new MutationObserver(
  throttle(() => {
    updateUI();
  }, 100)
);
```

### 3. 선택적 감시

```javascript
// ❌ 비효율: 전체 body 감시
observer.observe(document.body, {
  attributes: true,
  childList: true,
  subtree: true
});

// ✅ 효율적: 필요한 부분만 감시
const container = document.getElementById('main-content');
observer.observe(container, {
  childList: true // 속성 변경은 감시 안 함
});
```

### 4. 조건부 처리

```javascript
const observer = new MutationObserver((mutations) => {
  // 관련 있는 변경만 처리
  const relevantMutations = mutations.filter(mutation => {
    return mutation.target.matches('.product-list') ||
           mutation.target.closest('.product-list');
  });

  if (relevantMutations.length === 0) return;

  // 처리
  updateProductList();
});
```

### 5. 배치 처리

```javascript
let pendingUpdates = new Set();
let updateScheduled = false;

const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.matches?.('.item')) {
        pendingUpdates.add(node);
      }
    });
  });

  // 한 번만 스케줄링
  if (!updateScheduled) {
    updateScheduled = true;
    requestAnimationFrame(() => {
      processBatch(pendingUpdates);
      pendingUpdates.clear();
      updateScheduled = false;
    });
  }
});
```

## 실전 패턴

### 1. SPA 라우팅 감지

```javascript
// Next.js, React Router 등의 클라이언트 사이드 라우팅 감지
let lastUrl = window.location.href;

const observer = new MutationObserver(() => {
  const currentUrl = window.location.href;

  if (currentUrl !== lastUrl) {
    console.log('Route changed:', lastUrl, '→', currentUrl);
    lastUrl = currentUrl;
    onRouteChange(currentUrl);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

### 2. 동적 요소 대기

```javascript
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Timeout
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found`));
    }, timeout);
  });
}

// 사용
try {
  const button = await waitForElement('.submit-button');
  button.addEventListener('click', handleClick);
} catch (error) {
  console.error(error);
}
```

### 3. 무한 스크롤 감지

```javascript
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.matches?.('.post-item')) {
        console.log('New post loaded');
        processNewPost(node);
      }
    });
  });
});

const feed = document.querySelector('.feed');
observer.observe(feed, { childList: true });
```

### 4. 폼 변경 추적

```javascript
const form = document.querySelector('form');
let hasChanges = false;

const observer = new MutationObserver(() => {
  hasChanges = true;
});

// 모든 input 요소 감시
form.querySelectorAll('input, textarea').forEach(input => {
  observer.observe(input, {
    attributes: true,
    attributeFilter: ['value']
  });
});

window.addEventListener('beforeunload', (e) => {
  if (hasChanges) {
    e.preventDefault();
    e.returnValue = '변경사항이 저장되지 않았습니다.';
  }
});
```

## 주의사항

### 1. 메모리 누수 방지

```javascript
let observer;

function init() {
  observer = new MutationObserver(callback);
  observer.observe(target, config);
}

// 정리
function cleanup() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// 페이지 이탈 시 정리
window.addEventListener('beforeunload', cleanup);
```

### 2. 무한 루프 방지

```javascript
const observer = new MutationObserver((mutations) => {
  // ❌ 위험: 콜백 안에서 DOM 수정
  document.body.appendChild(document.createElement('div')); // 무한 루프!
});

observer.observe(document.body, { childList: true });

// ✅ 해결: 일시 중지 후 재개
const observer = new MutationObserver((mutations) => {
  observer.disconnect(); // 일시 중지

  // DOM 수정
  document.body.appendChild(document.createElement('div'));

  observer.observe(document.body, { childList: true }); // 재개
});
```

### 3. TextNode 감시 주의

```javascript
// TextNode는 직접 querySelector로 선택 불가
const textNode = element.firstChild;

if (textNode.nodeType === Node.TEXT_NODE) {
  observer.observe(textNode, {
    characterData: true
  });
}
```

### 4. 성능 문제

```javascript
// ❌ 성능 문제: subtree + 모든 옵션
observer.observe(document.documentElement, {
  attributes: true,
  childList: true,
  characterData: true,
  subtree: true // 전체 페이지의 모든 변경 감지!
});

// ✅ 개선: 필요한 것만
observer.observe(specificElement, {
  childList: true // 자식 추가/제거만
});
```

## 디버깅 팁

```javascript
const observer = new MutationObserver((mutations) => {
  console.group('Mutations');
  console.log('Count:', mutations.length);

  mutations.forEach((mutation, index) => {
    console.group(`Mutation ${index + 1}`);
    console.log('Type:', mutation.type);
    console.log('Target:', mutation.target);
    console.log('Added:', mutation.addedNodes.length);
    console.log('Removed:', mutation.removedNodes.length);
    console.groupEnd();
  });

  console.groupEnd();
});
```

## 참고 자료

- [MDN - MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
- [Mozilla Hacks - DOM MutationObserver](https://hacks.mozilla.org/2012/05/dom-mutationobserver-reacting-to-dom-changes-without-killing-browser-performance/)

## 다음 단계

- **[아키텍처 패턴](./06-architecture-patterns.md)** - 전체 구조 설계
- **[디버깅과 테스트](./07-debugging-testing.md)** - 개발 효율성 향상
