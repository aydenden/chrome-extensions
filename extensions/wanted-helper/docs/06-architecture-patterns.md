# 크롬 익스텐션 아키텍처 패턴

## 목차
- [컴포넌트 구조](#컴포넌트-구조)
- [코드 구조화](#코드-구조화)
- [현재 프로젝트 개선](#현재-프로젝트-개선)
- [일반적인 아키텍처 패턴](#일반적인-아키텍처-패턴)

## 컴포넌트 구조

크롬 익스텐션은 여러 독립적인 컴포넌트로 구성됩니다.

### 주요 컴포넌트

```
┌─────────────────────────────────────────────┐
│         Chrome Extension                     │
│                                              │
│  ┌────────────────────────────────────────┐│
│  │  Service Worker (background.js)        ││
│  │  - 이벤트 처리                         ││
│  │  - 데이터 관리                         ││
│  │  - API 호출                            ││
│  └────────────────────────────────────────┘│
│                    ▲                         │
│                    │ Messages                │
│                    ▼                         │
│  ┌────────────────────────────────────────┐│
│  │  Content Scripts                       ││
│  │  - DOM 조작                            ││
│  │  - 페이지 상호작용                     ││
│  └────────────────────────────────────────┘│
│                                              │
│  ┌─────────────┐  ┌─────────────┐          │
│  │   Popup     │  │  Options    │          │
│  │   (UI)      │  │   Page      │          │
│  └─────────────┘  └─────────────┘          │
│                                              │
└──────────────────────────────────────────────┘
```

### 1. Service Worker (Background Script)

**역할**: 확장 프로그램의 중앙 제어 센터

```javascript
// background.js
// - 이벤트 리스너
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  initializeSettings();
});

// - 메시지 처리
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true;
});

// - 스토리지 관리
async function saveData(data) {
  await chrome.storage.local.set(data);
}

// - API 호출
async function fetchExternalData(url) {
  const response = await fetch(url);
  return response.json();
}
```

### 2. Content Scripts

**역할**: 웹 페이지와 직접 상호작용

```javascript
// content.js
// - DOM 조작
function highlightElements() {
  document.querySelectorAll('.target').forEach(el => {
    el.style.backgroundColor = 'yellow';
  });
}

// - 페이지 데이터 추출
function extractData() {
  return {
    title: document.title,
    url: window.location.href,
    items: Array.from(document.querySelectorAll('.item')).map(el => el.textContent)
  };
}

// - 메시지 전송
chrome.runtime.sendMessage({ action: 'dataExtracted', data: extractData() });
```

### 3. Popup

**역할**: 사용자 인터페이스

```javascript
// popup.js
document.getElementById('toggleBtn').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ action: 'toggle' });
  updateUI(response);
});
```

### 4. Options Page

**역할**: 설정 페이지

```javascript
// options.js
document.getElementById('saveBtn').addEventListener('click', async () => {
  const settings = {
    theme: document.getElementById('theme').value,
    enabled: document.getElementById('enabled').checked
  };
  await chrome.storage.sync.set({ settings });
  alert('설정이 저장되었습니다');
});
```

## 코드 구조화

### 기본 구조

```
extension/
├── manifest.json
├── src/
│   ├── background/
│   │   └── index.ts
│   ├── content/
│   │   ├── index.ts
│   │   ├── dom.ts
│   │   └── observers.ts
│   ├── popup/
│   │   ├── index.html
│   │   ├── index.ts
│   │   └── styles.css
│   ├── options/
│   │   ├── index.html
│   │   └── index.ts
│   ├── shared/
│   │   ├── storage.ts
│   │   ├── messages.ts
│   │   ├── constants.ts
│   │   └── types.ts
│   └── utils/
│       ├── debounce.ts
│       └── logger.ts
├── dist/
├── assets/
│   └── icons/
├── package.json
└── tsconfig.json
```

### 모듈 분리 예시

```typescript
// src/shared/types.ts
export interface BlockedItem {
  id: string;
  addedAt: number;
  reason?: string;
}

export interface Settings {
  enabled: boolean;
  theme: 'light' | 'dark';
}

// src/shared/storage.ts
export async function getBlockedIds(): Promise<BlockedItem[]> {
  const result = await chrome.storage.sync.get(['blockedItems']);
  return result.blockedItems || [];
}

export async function addBlockedId(item: BlockedItem): Promise<void> {
  const items = await getBlockedIds();
  items.push(item);
  await chrome.storage.sync.set({ blockedItems: items });
}

// src/shared/messages.ts
export type Message =
  | { type: 'GET_BLOCKED_IDS' }
  | { type: 'ADD_BLOCKED_ID'; payload: BlockedItem }
  | { type: 'REMOVE_BLOCKED_ID'; payload: string };

export async function sendMessage<T>(message: Message): Promise<T> {
  return await chrome.runtime.sendMessage(message);
}

// src/content/dom.ts
export function updateCardStyles(blockedIds: string[]): void {
  const cards = document.querySelectorAll('[data-id]');
  cards.forEach(card => {
    const id = card.getAttribute('data-id');
    if (id && blockedIds.includes(id)) {
      (card as HTMLElement).style.opacity = '0.5';
    }
  });
}

// src/content/index.ts
import { getBlockedIds } from '../shared/storage';
import { updateCardStyles } from './dom';
import { initObserver } from './observers';

async function init() {
  const blocked = await getBlockedIds();
  const ids = blocked.map(item => item.id);
  updateCardStyles(ids);
  initObserver(ids);
}

init();
```

## 현재 프로젝트 개선

### 현재 구조

```
wanted_helper/
├── manifest.json
├── src/
│   └── index.ts          # 모든 로직이 하나의 파일에
├── dist/
│   └── index.js
└── tsconfig.json
```

### 개선된 구조 제안

```
wanted_helper/
├── manifest.json
├── src/
│   ├── content/
│   │   ├── index.ts           # 메인 진입점
│   │   ├── pageDetector.ts    # URL 패턴 감지
│   │   ├── buttonManager.ts   # 버튼 추가/업데이트
│   │   ├── cardFilter.ts      # 카드 필터링
│   │   └── observer.ts        # MutationObserver
│   ├── shared/
│   │   ├── storage.ts         # Storage 유틸리티
│   │   ├── types.ts           # 타입 정의
│   │   └── constants.ts       # 상수
│   └── utils/
│       ├── debounce.ts        # Debounce 함수
│       └── selectors.ts       # CSS 선택자
├── dist/
└── tsconfig.json
```

### 리팩토링 예시

```typescript
// src/shared/types.ts
export interface PageType {
  type: 'company' | 'position' | 'list' | 'other';
  id?: string;
}

export interface BlockedData {
  companyIds: string[];
  positionIds: string[];
}

// src/shared/constants.ts
export const SELECTORS = {
  COMPANY_SIDEBAR: '#__next > div > div > aside',
  POSITION_SIDEBAR: '#__next > main > div > div > aside',
  CARD_LIST: '#__next > div > div > ul > li > div > a',
  ACTION_BUTTON: '#action-button'
} as const;

export const PATTERNS = {
  COMPANY: /\/company\/(\d+)/,
  POSITION: /\/wd\/(\d+)/
} as const;

// src/shared/storage.ts
import { BlockedData } from './types';

export async function getBlockedData(): Promise<BlockedData> {
  const result = await chrome.storage.sync.get(['companyIds', 'positionIds']);
  return {
    companyIds: result.companyIds || [],
    positionIds: result.positionIds || []
  };
}

export async function addCompanyId(companyId: string): Promise<void> {
  const { companyIds } = await getBlockedData();
  if (!companyIds.includes(companyId)) {
    companyIds.push(companyId);
    await chrome.storage.sync.set({ companyIds });
  }
}

export async function removeCompanyId(companyId: string): Promise<void> {
  const { companyIds } = await getBlockedData();
  const filtered = companyIds.filter(id => id !== companyId);
  await chrome.storage.sync.set({ companyIds: filtered });
}

// src/content/pageDetector.ts
import { PATTERNS } from '../shared/constants';
import { PageType } from '../shared/types';

export function detectCurrentPage(): PageType {
  const path = window.location.pathname;

  const companyMatch = path.match(PATTERNS.COMPANY);
  if (companyMatch) {
    return { type: 'company', id: companyMatch[1] };
  }

  const positionMatch = path.match(PATTERNS.POSITION);
  if (positionMatch) {
    return { type: 'position', id: positionMatch[1] };
  }

  if (path.includes('/search') || path === '/') {
    return { type: 'list' };
  }

  return { type: 'other' };
}

// src/content/buttonManager.ts
import { SELECTORS } from '../shared/constants';
import { getBlockedData, addCompanyId, removeCompanyId } from '../shared/storage';

export async function addButton(pageType: 'company' | 'position', id: string): Promise<void> {
  const sidebar = document.querySelector(
    pageType === 'company' ? SELECTORS.COMPANY_SIDEBAR : SELECTORS.POSITION_SIDEBAR
  );

  if (!sidebar) return;

  let button = document.querySelector(SELECTORS.ACTION_BUTTON) as HTMLButtonElement;

  if (!button) {
    button = document.createElement('button');
    button.id = 'action-button';
    button.style.cssText = 'padding: 10px; margin: 10px 0; width: 100%;';
    sidebar.appendChild(button);
  }

  const { companyIds, positionIds } = await getBlockedData();
  const ids = pageType === 'company' ? companyIds : positionIds;
  const isBlocked = ids.includes(id);

  button.textContent = isBlocked ? '관심 없음 제거' : '관심 없음 추가';

  button.onclick = async () => {
    if (isBlocked) {
      await (pageType === 'company' ? removeCompanyId(id) : removePositionId(id));
    } else {
      await (pageType === 'company' ? addCompanyId(id) : addPositionId(id));
    }
    // 버튼 텍스트 업데이트
    await addButton(pageType, id);
  };
}

// src/content/index.ts
import { detectCurrentPage } from './pageDetector';
import { addButton } from './buttonManager';
import { initObserver } from './observer';
import { filterCards } from './cardFilter';
import { getBlockedData } from '../shared/storage';

async function init() {
  const page = detectCurrentPage();
  const blockedData = await getBlockedData();

  if (page.type === 'company' || page.type === 'position') {
    await addButton(page.type, page.id!);
  }

  if (page.type === 'list') {
    filterCards(blockedData);
  }

  initObserver();
}

init();
```

## 일반적인 아키텍처 패턴

### 1. MVC 패턴

```typescript
// Model
class BlockedItemsModel {
  async getAll() { }
  async add(id: string) { }
  async remove(id: string) { }
}

// View
class CardView {
  update(blockedIds: string[]) {
    // DOM 업데이트
  }
}

// Controller
class CardController {
  constructor(
    private model: BlockedItemsModel,
    private view: CardView
  ) {}

  async init() {
    const ids = await this.model.getAll();
    this.view.update(ids);
  }
}
```

### 2. 이벤트 기반 아키텍처

```typescript
class EventBus {
  private listeners = new Map<string, Function[]>();

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }
}

const bus = new EventBus();

// 컴포넌트 A
bus.on('blockedItemAdded', (id: string) => {
  updateUI(id);
});

// 컴포넌트 B
function addItem(id: string) {
  // ... 저장 로직
  bus.emit('blockedItemAdded', id);
}
```

### 3. 서비스 레이어 패턴

```typescript
// services/StorageService.ts
export class StorageService {
  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.sync.get([key]);
    return result[key] || null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.sync.set({ [key]: value });
  }
}

// services/DOMService.ts
export class DOMService {
  querySelector<T extends Element>(selector: string): T | null {
    return document.querySelector<T>(selector);
  }

  updateStyles(elements: Element[], styles: Partial<CSSStyleDeclaration>): void {
    elements.forEach(el => {
      Object.assign((el as HTMLElement).style, styles);
    });
  }
}

// 사용
const storageService = new StorageService();
const domService = new DOMService();

async function updateCards() {
  const blockedIds = await storageService.get<string[]>('blockedIds');
  const cards = Array.from(document.querySelectorAll('.card'));
  domService.updateStyles(cards, { opacity: '0.5' });
}
```

## 참고 자료

- [Chrome Extension Samples](https://github.com/GoogleChrome/chrome-extensions-samples)
- [Clean Architecture for Extensions](https://medium.com/@lucas.abgodoy/chrome-extension-development-with-clean-architecture-a-poc-22e861aa4ede)

## 다음 단계

- **[디버깅과 테스트](./07-debugging-testing.md)** - 개발 효율성 향상
- **[보안과 권한](./08-security-permissions.md)** - 안전한 확장 프로그램
