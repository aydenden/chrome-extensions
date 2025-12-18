# Feature 10: 스크린샷/영역 캡처 서비스

## 개요

현재 탭의 스크린샷 또는 선택 영역을 캡처하는 서비스를 구현합니다.

## 범위

- chrome.tabs.captureVisibleTab()
- 영역 캡처 (Element Picker 연동)
- Blob 저장

## 의존성

- Feature 09: Extension Content Scraper

## 구현 상세

### extension/src/background/capture-service.ts

```typescript
import { saveImage, createCompany, findCompanyByUrl, updateCompany } from '@/lib/storage';
import { detectSite } from '@/lib/sites';
import type { DataType } from '@shared/constants/categories';

export interface CaptureResult {
  success: boolean;
  imageId?: string;
  companyId?: string;
  error?: string;
}

/** Data URL → Blob 변환 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.+);base64/);
  const mimeType = mimeMatch?.[1] || 'image/png';

  const byteString = atob(base64);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return new Blob([arrayBuffer], { type: mimeType });
}

/** 이미지 크기 정보 추출 */
async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  bitmap.close();
  return { width, height };
}

/** 전체 화면 캡처 */
export async function captureFullScreen(tabId: number): Promise<string> {
  const dataUrl = await chrome.tabs.captureVisibleTab(
    undefined,
    { format: 'png' }
  );
  return dataUrl;
}

/** 캡처 및 저장 */
export async function captureAndSave(options: {
  tabId: number;
  companyName: string;
  companyUrl: string;
  siteType: DataType;
  existingCompanyId?: string;
}): Promise<CaptureResult> {
  try {
    const { tabId, companyName, companyUrl, siteType, existingCompanyId } = options;

    // 1. 스크린샷 캡처
    const dataUrl = await captureFullScreen(tabId);
    const blob = dataUrlToBlob(dataUrl);
    const dimensions = await getImageDimensions(blob);

    // 2. 회사 생성 또는 기존 회사 사용
    let companyId = existingCompanyId;

    if (!companyId) {
      // 기존 회사 검색
      const existing = await findCompanyByUrl(companyUrl);

      if (existing) {
        companyId = existing.id;
        // 메타데이터 업데이트
        await updateCompany(companyId, { name: companyName });
      } else {
        // 새 회사 생성
        const company = await createCompany({
          name: companyName,
          url: companyUrl,
          siteType,
        });
        companyId = company.id;
      }
    }

    // 3. 이미지 저장
    const image = await saveImage(companyId, blob, siteType, dimensions);

    // 4. 알림 표시
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'AI Company Analyzer',
      message: `${companyName} 이미지 저장 완료`,
    });

    return {
      success: true,
      imageId: image.id,
      companyId,
    };
  } catch (error) {
    console.error('[Capture Service] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** 영역 캡처 (Content Script에서 전달받은 데이터) */
export async function captureRegion(options: {
  dataUrl: string;
  companyName: string;
  companyUrl: string;
  siteType: DataType;
  existingCompanyId?: string;
}): Promise<CaptureResult> {
  try {
    const { dataUrl, companyName, companyUrl, siteType, existingCompanyId } = options;

    const blob = dataUrlToBlob(dataUrl);
    const dimensions = await getImageDimensions(blob);

    // 회사 처리
    let companyId = existingCompanyId;

    if (!companyId) {
      const existing = await findCompanyByUrl(companyUrl);

      if (existing) {
        companyId = existing.id;
      } else {
        const company = await createCompany({
          name: companyName,
          url: companyUrl,
          siteType,
        });
        companyId = company.id;
      }
    }

    // 이미지 저장
    const image = await saveImage(companyId, blob, siteType, dimensions);

    return {
      success: true,
      imageId: image.id,
      companyId,
    };
  } catch (error) {
    console.error('[Capture Service] Region capture error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

### extension/src/background/index.ts 업데이트

```typescript
import { captureAndSave, captureRegion } from './capture-service';

// 내부 메시지 핸들러
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_SCREENSHOT') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID' });
      return;
    }

    captureAndSave({
      tabId,
      companyName: message.payload.companyName,
      companyUrl: message.payload.companyUrl,
      siteType: message.payload.siteType,
      existingCompanyId: message.payload.existingCompanyId,
    }).then(sendResponse);

    return true;
  }

  if (message.type === 'CAPTURE_REGION') {
    captureRegion({
      dataUrl: message.payload.dataUrl,
      companyName: message.payload.companyName,
      companyUrl: message.payload.companyUrl,
      siteType: message.payload.siteType,
      existingCompanyId: message.payload.existingCompanyId,
    }).then(sendResponse);

    return true;
  }
});
```

## 완료 기준

- [ ] 전체 화면 캡처 성공
- [ ] 캡처된 이미지 Blob으로 변환
- [ ] 이미지 크기 정보 추출
- [ ] 회사 자동 생성 또는 기존 회사에 추가
- [ ] IndexedDB에 이미지 저장
- [ ] 캡처 완료 알림 표시

## 참조 문서

- spec/04-data-flow.md Section 2.1 (스크린샷 캡처)
