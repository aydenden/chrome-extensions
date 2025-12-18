import { db } from '@/lib/db';
import type { DataType } from '@shared/constants/categories';

export interface CaptureResult {
  success: boolean;
  imageId?: string;
  companyId?: string;
  error?: string;
}

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

async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  bitmap.close();
  return { width, height };
}

export async function captureFullScreen(windowId: number): Promise<string> {
  return chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
}

async function findOrCreateCompany(companyName: string, companyUrl: string, siteType: DataType): Promise<string> {
  const existing = await db.companies.where('url').equals(companyUrl).first();
  if (existing) {
    await db.companies.update(existing.id, { name: companyName, updatedAt: new Date() });
    return existing.id;
  }

  const id = `company_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await db.companies.add({
    id,
    name: companyName,
    url: companyUrl,
    siteType,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

async function saveImageToDb(companyId: string, blob: Blob, siteType: DataType, dimensions: { width: number; height: number }): Promise<string> {
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const mimeType = blob.type || 'image/png';
  const size = blob.size;

  await db.images.add({
    id,
    companyId,
    siteType,
    blob,
    mimeType,
    size,
    width: dimensions.width,
    height: dimensions.height,
    createdAt: new Date(),
  });
  return id;
}

export async function captureAndSave(options: {
  tabId: number;
  windowId: number;
  companyName: string;
  companyUrl: string;
  siteType: DataType;
  existingCompanyId?: string;
}): Promise<CaptureResult> {
  try {
    const { windowId, companyName, companyUrl, siteType, existingCompanyId } = options;

    const dataUrl = await captureFullScreen(windowId);
    const blob = dataUrlToBlob(dataUrl);
    const dimensions = await getImageDimensions(blob);

    const companyId = existingCompanyId || await findOrCreateCompany(companyName, companyUrl, siteType);
    const imageId = await saveImageToDb(companyId, blob, siteType, dimensions);

    // Notification 에러가 캡처 결과에 영향을 주지 않도록 처리
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'AI Company Analyzer',
        message: `${companyName} 이미지 저장 완료`,
      });
    } catch (notificationError) {
      console.warn('[Capture Service] Notification error:', notificationError);
    }

    return { success: true, imageId, companyId };
  } catch (error) {
    console.error('[Capture Service] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

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

    const companyId = existingCompanyId || await findOrCreateCompany(companyName, companyUrl, siteType);
    const imageId = await saveImageToDb(companyId, blob, siteType, dimensions);

    return { success: true, imageId, companyId };
  } catch (error) {
    console.error('[Capture Service] Region capture error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
