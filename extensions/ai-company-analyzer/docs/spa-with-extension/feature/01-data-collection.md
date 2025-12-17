# 데이터 수집 기능 명세

## 1. 개요

Chrome Extension이 담당하는 데이터 수집 기능 명세.

## 2. 지원 사이트

| 사이트 | URL 패턴 | 수집 데이터 |
|--------|----------|------------|
| 원티드 | `wanted.co.kr/company/*` | 회사 정보, 채용 공고, 그래프 |
| 잡플래닛 | `jobplanet.co.kr/companies/*` | 회사 정보, 리뷰, 연봉 |
| 사람인 | `saramin.co.kr/zf_user/company-info/*` | 회사 정보 (향후) |

## 3. 수집 트리거

### 3.1 자동 수집

| 트리거 | 동작 |
|--------|------|
| 페이지 로드 | Content Script 자동 실행 |
| URL 변경 | SPA 네비게이션 감지 |

### 3.2 수동 수집

| 트리거 | UI | 동작 |
|--------|-----|------|
| 스크린샷 | 팝업 버튼 | 현재 화면 캡처 |
| 요소 선택 | 팝업 버튼 | 요소 선택 모드 |
| 전체 저장 | 팝업 버튼 | 모든 데이터 저장 |

## 4. 스크린샷 캡처

### 4.1 구현

```typescript
// extension/src/background/capture-service.ts
export async function captureScreenshot(tabId?: number): Promise<string> {
  const tab = tabId
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  if (!tab?.id) {
    throw new Error('활성 탭을 찾을 수 없습니다');
  }

  // 현재 화면 캡처
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: 'png',
    quality: 100,
  });

  return dataUrl;
}

export async function saveScreenshot(
  dataUrl: string,
  companyId: string
): Promise<string> {
  // Data URL → Blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  // ID 생성
  const imageId = crypto.randomUUID();

  // IndexedDB 저장
  await db.images.add({
    id: imageId,
    companyId,
    blob,
    mimeType: 'image/png',
    size: blob.size,
    createdAt: new Date(),
  });

  return imageId;
}
```

### 4.2 메시지 핸들러

```typescript
// extension/src/background/index.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_SCREENSHOT') {
    handleCaptureScreenshot(message.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

async function handleCaptureScreenshot(payload: {
  companyId?: string;
}): Promise<{ imageId: string }> {
  // 1. 현재 탭에서 회사 정보 확인
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const companyId = payload.companyId || await extractCompanyId(tab);

  // 2. 스크린샷 캡처
  const dataUrl = await captureScreenshot(tab.id);

  // 3. 저장
  const imageId = await saveScreenshot(dataUrl, companyId);

  // 4. 알림
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon128.png',
    title: '스크린샷 저장 완료',
    message: '분석 대시보드에서 확인하세요',
  });

  return { imageId };
}
```

## 5. DOM 스크래핑

### 5.1 회사 정보 추출

```typescript
// extension/src/content/scraper.ts
interface CompanyData {
  name: string;
  url: string;
  siteType: DataType;
  metadata?: {
    industry?: string;
    employeeCount?: string;
    foundedYear?: string;
    location?: string;
  };
}

export function scrapeCompanyData(): CompanyData | null {
  const url = window.location.href;
  const siteType = detectSiteType(url);

  if (!siteType) return null;

  switch (siteType) {
    case 'WANTED':
      return scrapeWanted();
    case 'JOBPLANET':
      return scrapeJobplanet();
    default:
      return null;
  }
}

function scrapeWanted(): CompanyData {
  const name = document.querySelector('h1.company-name')?.textContent?.trim();
  const industry = document.querySelector('.industry')?.textContent?.trim();

  return {
    name: name || '알 수 없음',
    url: window.location.href,
    siteType: 'WANTED',
    metadata: { industry },
  };
}

function scrapeJobplanet(): CompanyData {
  const name = document.querySelector('.company_name')?.textContent?.trim();
  const industry = document.querySelector('.company_industry')?.textContent?.trim();
  const employeeCount = document.querySelector('.employee_count')?.textContent?.trim();

  return {
    name: name || '알 수 없음',
    url: window.location.href,
    siteType: 'JOBPLANET',
    metadata: { industry, employeeCount },
  };
}
```

### 5.2 자동 실행

```typescript
// extension/src/content/index.ts
(function () {
  // 페이지 로드 시 자동 스크래핑
  const companyData = scrapeCompanyData();

  if (companyData) {
    chrome.runtime.sendMessage({
      type: 'SAVE_COMPANY_DATA',
      payload: companyData,
    });
  }

  // SPA 네비게이션 감지
  const observer = new MutationObserver(() => {
    const newData = scrapeCompanyData();
    if (newData && newData.url !== lastUrl) {
      lastUrl = newData.url;
      chrome.runtime.sendMessage({
        type: 'SAVE_COMPANY_DATA',
        payload: newData,
      });
    }
  });

  let lastUrl = window.location.href;
  observer.observe(document.body, { childList: true, subtree: true });
})();
```

## 6. 요소 선택 모드

### 6.1 UI

```typescript
// extension/src/content/element-picker.ts
export function enableElementPicker(): void {
  // 오버레이 생성
  const overlay = document.createElement('div');
  overlay.id = 'ai-analyzer-picker-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 999999;
    cursor: crosshair;
  `;

  // 하이라이트 박스
  const highlight = document.createElement('div');
  highlight.id = 'ai-analyzer-picker-highlight';
  highlight.style.cssText = `
    position: fixed;
    border: 2px solid #0ea5e9;
    background: rgba(14, 165, 233, 0.1);
    pointer-events: none;
    z-index: 999998;
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(highlight);

  // 마우스 이벤트
  overlay.addEventListener('mousemove', handleMouseMove);
  overlay.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleEscape);
}

function handleMouseMove(e: MouseEvent): void {
  const element = document.elementFromPoint(e.clientX, e.clientY);
  if (!element) return;

  const rect = element.getBoundingClientRect();
  const highlight = document.getElementById('ai-analyzer-picker-highlight');

  if (highlight) {
    highlight.style.top = `${rect.top}px`;
    highlight.style.left = `${rect.left}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
  }
}

function handleClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();

  const element = document.elementFromPoint(e.clientX, e.clientY);
  if (!element) return;

  // 선택된 요소 캡처
  captureElement(element);

  // 선택 모드 종료
  disableElementPicker();
}

async function captureElement(element: Element): Promise<void> {
  // html2canvas 사용
  const canvas = await html2canvas(element as HTMLElement);
  const dataUrl = canvas.toDataURL('image/png');

  chrome.runtime.sendMessage({
    type: 'CAPTURE_ELEMENT',
    payload: { dataUrl },
  });
}
```

## 7. 데이터 저장

### 7.1 회사 데이터 저장

```typescript
// extension/src/background/data-manager.ts
export async function saveCompanyData(data: CompanyData): Promise<string> {
  // 기존 회사 확인 (URL 기반)
  const existing = await db.companies
    .where('url')
    .equals(data.url)
    .first();

  if (existing) {
    // 업데이트
    await db.companies.update(existing.id, {
      ...data,
      updatedAt: new Date(),
    });
    return existing.id;
  }

  // 신규 생성
  const id = crypto.randomUUID();
  await db.companies.add({
    id,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return id;
}
```

### 7.2 이미지 저장

```typescript
export async function saveImage(
  companyId: string,
  blob: Blob
): Promise<string> {
  const id = crypto.randomUUID();

  await db.images.add({
    id,
    companyId,
    blob,
    mimeType: blob.type,
    size: blob.size,
    createdAt: new Date(),
  });

  return id;
}
```

## 8. 알림

### 8.1 저장 완료 알림

```typescript
export async function notifySaved(type: 'screenshot' | 'company'): Promise<void> {
  const messages = {
    screenshot: {
      title: '스크린샷 저장 완료',
      message: '분석 대시보드에서 확인하세요',
    },
    company: {
      title: '회사 정보 저장',
      message: '새 회사가 추가되었습니다',
    },
  };

  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon128.png',
    ...messages[type],
  });
}
```

## 9. 에러 처리

| 에러 | 원인 | 처리 |
|------|------|------|
| 캡처 권한 없음 | 특수 페이지 | 사용자 알림 |
| DOM 접근 실패 | 동적 로딩 | 재시도 |
| 저장 실패 | 스토리지 부족 | 오래된 데이터 삭제 제안 |

## 10. 테스트 체크리스트

- [ ] 원티드 회사 페이지 스크래핑
- [ ] 잡플래닛 회사 페이지 스크래핑
- [ ] 스크린샷 캡처 및 저장
- [ ] 요소 선택 및 캡처
- [ ] SPA 네비게이션 감지
- [ ] 중복 회사 처리
